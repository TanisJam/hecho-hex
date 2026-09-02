"use client"

/* eslint-disable react-hooks/set-state-in-effect --
   The fade is a small state machine (incoming cells fade in, then settle into
   the base layer); those transitions are inherently effect-driven. */

import { useEffect, useMemo, useState } from "react"
import { Source, Layer } from "react-map-gl/mapbox"
import { useMapStore } from "@/store/map-store"
import { hexagonsToGeoJSON, getResolutionForZoom } from "@/lib/h3"
import { brandGlow, whiteAlpha } from "@/lib/theme"
import { HEX_FADE_MS } from "@/lib/constants"
import type {
  ExpressionSpecification,
  FillLayerSpecification,
  LineLayerSpecification,
} from "mapbox-gl"

// Shared color/width expressions (user hex is highlighted in brand teal).
const FILL_COLOR: ExpressionSpecification = [
  "case",
  ["get", "isUserHex"],
  brandGlow(0.12),
  whiteAlpha(0.03),
]
const LINE_COLOR: ExpressionSpecification = [
  "case",
  ["get", "isUserHex"],
  brandGlow(0.6),
  whiteAlpha(0.1),
]
const LINE_WIDTH: ExpressionSpecification = [
  "case",
  ["get", "isUserHex"],
  2,
  0.5,
]

// Base layer: already-settled cells, painted at full opacity (no animation).
const baseFill: Omit<FillLayerSpecification, "source"> = {
  id: "hex-base-fill",
  type: "fill",
  paint: { "fill-color": FILL_COLOR, "fill-opacity": 1 },
}
const baseLine: Omit<LineLayerSpecification, "source"> = {
  id: "hex-base-line",
  type: "line",
  paint: { "line-color": LINE_COLOR, "line-width": LINE_WIDTH, "line-opacity": 1 },
}

/**
 * The hex grid, with cells that fade in individually as they enter the viewport
 * instead of popping. Newly-visible cells render in an "incoming" layer whose
 * scalar opacity transitions 0 → 1 (a reliably-animated Mapbox paint change,
 * unlike feature-state); once faded, they settle into the always-on base layer.
 * Cells that leave the viewport simply drop out (their exit happens at the
 * screen edge, where it isn't noticeable).
 */
export function HexGridLayer() {
  const visibleH3Indices = useMapStore((s) => s.visibleH3Indices)
  const userH3Index = useMapStore((s) => s.userH3Index)
  const zoom = useMapStore((s) => s.zoom)
  const displayResolution = getResolutionForZoom(zoom)

  // Cells whose intro has finished. Split the visible set into settled (base)
  // and brand-new (incoming) purely by membership here.
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set())
  const [incomingOn, setIncomingOn] = useState(false)

  const baseIndices = useMemo(
    () => visibleH3Indices.filter((id) => settledIds.has(id)),
    [visibleH3Indices, settledIds]
  )
  const incomingIndices = useMemo(
    () => visibleH3Indices.filter((id) => !settledIds.has(id)),
    [visibleH3Indices, settledIds]
  )

  const baseData = useMemo(
    () => hexagonsToGeoJSON(baseIndices, displayResolution, userH3Index),
    [baseIndices, displayResolution, userH3Index]
  )
  const incomingData = useMemo(
    () => hexagonsToGeoJSON(incomingIndices, displayResolution, userH3Index),
    [incomingIndices, displayResolution, userH3Index]
  )

  // Drop settled cells that have left the viewport so the set tracks only
  // what's on screen instead of every cell ever seen (unbounded growth over a
  // long panning session). Returning the same ref when nothing left keeps this
  // from triggering a re-render. A cell that later re-enters simply fades in
  // again, which is the desired behavior.
  useEffect(() => {
    setSettledIds((prev) => {
      const visible = new Set(visibleH3Indices)
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visible.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [visibleH3Indices])

  // Fade the incoming batch in, then fold it into the settled set so the base
  // layer takes over at full opacity and `incoming` empties on the next render.
  useEffect(() => {
    if (incomingIndices.length === 0) {
      setIncomingOn(false)
      return
    }
    setIncomingOn(false)
    const raf = requestAnimationFrame(() => setIncomingOn(true))
    const settle = setTimeout(() => {
      setSettledIds((prev) => {
        const next = new Set(prev)
        for (const id of incomingIndices) next.add(id)
        return next
      })
    }, HEX_FADE_MS)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(settle)
    }
  }, [incomingIndices])

  const incomingOpacity = incomingOn ? 1 : 0

  return (
    <>
      <Source id="hex-base" type="geojson" data={baseData}>
        <Layer {...baseFill} />
        <Layer {...baseLine} />
      </Source>

      <Source id="hex-incoming" type="geojson" data={incomingData}>
        <Layer
          id="hex-incoming-fill"
          type="fill"
          paint={{
            "fill-color": FILL_COLOR,
            "fill-opacity": incomingOpacity,
            "fill-opacity-transition": { duration: HEX_FADE_MS, delay: 0 },
          }}
        />
        <Layer
          id="hex-incoming-line"
          type="line"
          paint={{
            "line-color": LINE_COLOR,
            "line-width": LINE_WIDTH,
            "line-opacity": incomingOpacity,
            "line-opacity-transition": { duration: HEX_FADE_MS, delay: 0 },
          }}
        />
      </Source>
    </>
  )
}
