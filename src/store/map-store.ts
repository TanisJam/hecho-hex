import { create } from "zustand"
import type { GeoPosition, H3Index } from "@/types"
import { locationToH3 } from "@/lib/h3"
import { getTempUserId } from "@/lib/session"

// Shared zoom breakpoint between MessageLayer and WordCloudLayer: below this
// zoom, WordCloudLayer takes over and MessageLayer renders nothing (bubbles
// would be too dense/small to read at that scale, and showing both amplifies
// visual clutter). Defined once so the two thresholds cannot drift apart —
// import both named exports instead of hardcoding 12 in either layer.
export const WORD_CLOUD_MAX_ZOOM = 12
export const MESSAGE_LAYER_MIN_ZOOM = WORD_CLOUD_MAX_ZOOM

interface MapState {
  userLocation: GeoPosition | null
  userH3Index: H3Index | null
  visibleH3Indices: H3Index[]
  zoom: number
  tempUserId: string
  // Monotonic counter bumped on every camera move (pan/zoom), undebounced —
  // lets screen-space layers (message bubbles, word clouds) reproject every
  // frame instead of only when the debounced visible-hex set changes.
  viewportVersion: number

  setUserLocation: (pos: GeoPosition) => void
  setVisibleH3Indices: (indices: H3Index[]) => void
  setZoom: (zoom: number) => void
  bumpViewportVersion: () => void
}

// Coalesces bumpViewportVersion calls to at most one store update per
// animation frame. handleMove (map-view.tsx) calls bumpViewportVersion
// synchronously on every 'move'/'moveend' camera event; without this guard,
// any re-entrant call to onMove during the same synchronous pass (whichever
// mechanism causes it — the exact chain wasn't reproducible from static
// source alone, see investigation notes) would call zustand's set()
// repeatedly with no yield to the browser in between, which is exactly the
// shape of update that trips React's "Maximum update depth exceeded" guard.
// Routing the actual set() through requestAnimationFrame means a second
// synchronous call in the same tick just finds a pending frame and returns,
// structurally capping the update rate regardless of the trigger.
let bumpRafId: number | null = null

export const useMapStore = create<MapState>((set) => ({
  userLocation: null,
  userH3Index: null,
  visibleH3Indices: [],
  zoom: 2,
  tempUserId: typeof window !== "undefined" ? getTempUserId() : "",
  viewportVersion: 0,

  setUserLocation: (pos) =>
    set({
      userLocation: pos,
      userH3Index: locationToH3(pos),
    }),

  setVisibleH3Indices: (indices) =>
    set({ visibleH3Indices: indices }),

  setZoom: (zoom) =>
    set({ zoom }),

  bumpViewportVersion: () => {
    if (bumpRafId != null) return
    bumpRafId = requestAnimationFrame(() => {
      bumpRafId = null
      set((state) => ({ viewportVersion: state.viewportVersion + 1 }))
    })
  },
}))
