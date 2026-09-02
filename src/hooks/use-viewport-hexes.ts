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

  const updateViewport = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    debounceTimer.current = setTimeout(() => {
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
    }, VIEWPORT_DEBOUNCE_MS)
  }, [mapRef, setVisibleH3Indices, setZoom])

  return { updateViewport }
}
