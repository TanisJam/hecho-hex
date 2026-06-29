"use client"

import { useMemo } from "react"
import { Source, Layer } from "react-map-gl/mapbox"
import { useMapStore } from "@/store/map-store"
import { hexagonsToGeoJSON } from "@/lib/h3"
import type { FillLayerSpecification, LineLayerSpecification } from "mapbox-gl"

const hexFillLayer: Omit<FillLayerSpecification, "source"> = {
  id: "hex-fill",
  type: "fill",
  paint: {
    "fill-color": [
      "case",
      ["get", "isUserHex"],
      "rgba(0, 255, 200, 0.12)",
      "rgba(255, 255, 255, 0.03)",
    ],
    "fill-opacity": 1,
  },
}

const hexLineLayer: Omit<LineLayerSpecification, "source"> = {
  id: "hex-line",
  type: "line",
  paint: {
    "line-color": [
      "case",
      ["get", "isUserHex"],
      "rgba(0, 255, 200, 0.6)",
      "rgba(255, 255, 255, 0.1)",
    ],
    "line-width": [
      "case",
      ["get", "isUserHex"],
      2,
      0.5,
    ],
  },
}

export function HexGridLayer() {
  const visibleH3Indices = useMapStore((s) => s.visibleH3Indices)
  const userH3Index = useMapStore((s) => s.userH3Index)

  const geojson = useMemo(
    () => hexagonsToGeoJSON(visibleH3Indices, userH3Index),
    [visibleH3Indices, userH3Index]
  )

  if (visibleH3Indices.length === 0) return null

  return (
    <Source id="hex-grid" type="geojson" data={geojson}>
      <Layer {...hexFillLayer} />
      <Layer {...hexLineLayer} />
    </Source>
  )
}
