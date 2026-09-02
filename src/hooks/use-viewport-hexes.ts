"use client"

import { useCallback, useRef } from "react"
import { useMapStore } from "@/store/map-store"
import { getViewportHexagons, getResolutionForZoom } from "@/lib/h3"
import {
  MIN_HEX_ZOOM,
  HEX_VIEWPORT_CAP,
  VIEWPORT_DEBOUNCE_MS,
} from "@/lib/constants"
import type { MapRef } from "react-map-gl/mapbox"

export function useViewportHexes(mapRef: React.RefObject<MapRef | null>) {
  const setVisibleH3Indices = useMapStore((s) => s.setVisibleH3Indices)
  const setZoom = useMapStore((s) => s.setZoom)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Guards against stacking multiple one-shot `idle` listeners when the
  // debounce fires repeatedly while the camera is still animating.
  const idlePending = useRef(false)

  // The actual (synchronous, main-thread) recompute. Kept separate so it can be
  // deferred to the map's `idle` event when the camera is still animating.
  const recompute = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const bounds = map.getBounds()
    const zoom = map.getZoom()
    setZoom(zoom)

    if (!bounds) return

    const resolution = getResolutionForZoom(zoom)

    // Limit hex computation to reasonable zoom levels
    if (zoom < MIN_HEX_ZOOM) {
      setVisibleH3Indices([])
      return
    }

    const hexes = getViewportHexagons(bounds, resolution)

    // Cap to prevent performance issues
    if (hexes.length > HEX_VIEWPORT_CAP) {
      setVisibleH3Indices([])
      return
    }

    setVisibleH3Indices(hexes)
  }, [mapRef, setVisibleH3Indices, setZoom])

  const updateViewport = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(() => {
      const map = mapRef.current?.getMap()
      if (!map) return

      // Wheel-zoom is a main-thread-eased animation; running the hex rebuild
      // while it is still easing steals frames and visibly stalls the zoom.
      // If the camera is still moving/zooming when the debounce fires, wait for
      // the map to go idle and rebuild then — off the animation's critical path.
      if (map.isMoving() || map.isZooming() || map.isRotating()) {
        if (idlePending.current) return
        idlePending.current = true
        map.once("idle", () => {
          idlePending.current = false
          recompute()
        })
        return
      }

      recompute()
    }, VIEWPORT_DEBOUNCE_MS)
  }, [mapRef, recompute])

  return { updateViewport }
}
