"use client"

import { useMemo } from "react"
import { useMap } from "react-map-gl/mapbox"
import { useMessageStore } from "@/store/message-store"
import { useMapStore, MESSAGE_LAYER_MIN_ZOOM } from "@/store/map-store"
import { hexCenterToLngLat } from "@/lib/h3"
import { cellToBoundary } from "h3-js"
import { DraggableMessage } from "./draggable-message"
import { useForceSimulation } from "@/hooks/use-force-simulation"

// Stable identity for the gated-off state: passing a fresh [] on every render
// would re-run the simulation effect each render, and its empty-branch
// setState would then loop (maximum update depth exceeded on load).
const NO_MESSAGES: never[] = []

export function MessageLayer() {
  const { "echohex-map": mapInstance } = useMap()
  const messagesMap = useMessageStore((s) => s.messages)
  const messages = useMemo(
    () => Array.from(messagesMap.values()),
    [messagesMap]
  )
  const tempUserId = useMapStore((s) => s.tempUserId)
  const viewportVersion = useMapStore((s) => s.viewportVersion)
  const positionOverrides = useMessageStore((s) => s.positionOverrides)
  const setPositionOverride = useMessageStore((s) => s.setPositionOverride)

  // Expensive: camera-invariant geo math (hex center/boundary lookups and the
  // hex-relative offset) only needs to run when the messages themselves
  // change, not on every camera frame. Also depends on `positionOverrides` so
  // a dragged-and-dropped bubble is re-anchored at its new world position
  // (see the onDragEnd handler below) instead of snapping back to its
  // hex-derived spot on the next camera move.
  const geoPositioned = useMemo(() => {
    return messages.map((msg) => {
      const override = positionOverrides.get(msg.id)
      if (override) {
        return {
          message: msg,
          msgLng: override.lng,
          msgLat: override.lat,
          isOwn: msg.temp_user_id === tempUserId,
        }
      }

      const center = hexCenterToLngLat(msg.h3_index)
      const boundary = cellToBoundary(msg.h3_index)

      // Compute hex bounding box in lat/lng
      const lats = boundary.map(([lat]) => lat)
      const lngs = boundary.map(([, lng]) => lng)
      const latRange = Math.max(...lats) - Math.min(...lats)
      const lngRange = Math.max(...lngs) - Math.min(...lngs)

      // Message world position = hex center + offset from pos_relative
      const msgLng = center[0] + (msg.pos_relative.x - 0.5) * lngRange
      const msgLat = center[1] + (msg.pos_relative.y - 0.5) * latRange

      return {
        message: msg,
        msgLng,
        msgLat,
        isOwn: msg.temp_user_id === tempUserId,
      }
    })
  }, [messages, tempUserId, positionOverrides])

  // Cheap: project world coordinates to screen space. Depends on
  // viewportVersion (bumped on every camera move) so bubbles reproject every
  // frame instead of freezing at stale screen coordinates.
  const positioned = useMemo(() => {
    if (!mapInstance) return []

    return geoPositioned
      .map((p) => {
        const point = mapInstance.project([p.msgLng, p.msgLat])

        return {
          message: p.message,
          screenX: point.x,
          screenY: point.y,
          isOwn: p.isOwn,
        }
      })
      .filter(
        (p) =>
          p.screenX > -100 &&
          p.screenX < window.innerWidth + 100 &&
          p.screenY > -100 &&
          p.screenY < window.innerHeight + 100
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoPositioned, mapInstance, viewportVersion])

  // Read alongside `positioned` (same render, same camera-frame cadence) so
  // the force simulation can rescale separation offsets when zoom changes —
  // a fixed pixel offset represents a different geographic distance at each
  // zoom level (see use-force-simulation.ts).
  const zoom = mapInstance ? mapInstance.getZoom() : 0

  // Below MESSAGE_LAYER_MIN_ZOOM, WordCloudLayer takes over — render nothing
  // here so both layers don't compete for the same screen space.
  const isActive = zoom >= MESSAGE_LAYER_MIN_ZOOM

  // The simulation only owns the collision/separation offset. Render position
  // is always this render's fresh projected anchor (p.screenX/screenY) plus
  // that offset, so bubbles track the camera in the same render pass instead
  // of waiting on the next async d3 tick + setState.
  const { offsets, pinNode, resetNode } = useForceSimulation({
    messages: isActive ? positioned : NO_MESSAGES,
    zoom,
  })

  if (!isActive) return null

  return (
    <div className="pointer-events-none absolute inset-0">
      {positioned.map((p) => {
        const offset = offsets.get(p.message.id)
        return (
          <DraggableMessage
            key={p.message.id}
            message={p.message}
            screenX={p.screenX + (offset?.dx ?? 0)}
            screenY={p.screenY + (offset?.dy ?? 0)}
            isOwn={p.isOwn}
            // Pin the node at its current screen position while dragging so
            // neighboring bubbles still collide/repel against it during the
            // gesture (approximate — the pinned point doesn't track the
            // pointer, only the drag start position).
            onDragStart={(id, x, y) => pinNode(id, x, y)}
            onDragEnd={(id, dragDeltaX, dragDeltaY) => {
              if (!mapInstance) return

              // Final on-screen position = base projected anchor + any
              // force-simulation separation offset + the drag delta reported
              // by the child (framer's own transform, reset to 0 by the
              // child right after this call).
              const finalX = p.screenX + (offset?.dx ?? 0) + dragDeltaX
              const finalY = p.screenY + (offset?.dy ?? 0) + dragDeltaY
              const lngLat = mapInstance.unproject([finalX, finalY])

              // Commit the drop as a world anchor (lng/lat), not a screen
              // transform, so it tracks the map correctly on pan/zoom.
              setPositionOverride(p.message.id, {
                lng: lngLat.lng,
                lat: lngLat.lat,
              })

              // Unpin and clear the accumulated separation offset for this
              // node so it doesn't re-apply on top of the freshly committed
              // anchor. Synchronous even if the simulation is asleep.
              resetNode(id)
            }}
          />
        )
      })}
    </div>
  )
}
