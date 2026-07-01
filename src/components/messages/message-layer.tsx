"use client"

import { useMemo } from "react"
import { useMap } from "react-map-gl/mapbox"
import { useMessageStore } from "@/store/message-store"
import { useMapStore } from "@/store/map-store"
import { hexCenterToLngLat } from "@/lib/h3"
import { cellToBoundary } from "h3-js"
import { DraggableMessage } from "./draggable-message"
import { useForceSimulation } from "@/hooks/use-force-simulation"

export function MessageLayer() {
  const { "echohex-map": mapInstance } = useMap()
  const messagesMap = useMessageStore((s) => s.messages)
  const messages = useMemo(
    () => Array.from(messagesMap.values()),
    [messagesMap]
  )
  const tempUserId = useMapStore((s) => s.tempUserId)
  const viewportVersion = useMapStore((s) => s.viewportVersion)

  // Expensive: camera-invariant geo math (hex center/boundary lookups and the
  // hex-relative offset) only needs to run when the messages themselves
  // change, not on every camera frame.
  const geoPositioned = useMemo(() => {
    return messages.map((msg) => {
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
  }, [messages, tempUserId])

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

  const { positions, pinNode, unpinNode } = useForceSimulation({
    messages: positioned,
  })

  return (
    <div className="pointer-events-none absolute inset-0">
      {positioned.map((p) => {
        const pos = positions.get(p.message.id)
        return (
          <DraggableMessage
            key={p.message.id}
            message={p.message}
            screenX={pos?.x ?? p.screenX}
            screenY={pos?.y ?? p.screenY}
            isOwn={p.isOwn}
            onDragStart={(id, x, y) => pinNode(id, x, y)}
            onDragEnd={(id) => unpinNode(id)}
          />
        )
      })}
    </div>
  )
}
