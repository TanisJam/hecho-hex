import { create } from "zustand"
import type { GeoPosition, H3Index } from "@/types"
import { locationToH3 } from "@/lib/h3"
import { getTempUserId } from "@/lib/session"

interface MapState {
  userLocation: GeoPosition | null
  userH3Index: H3Index | null
  visibleH3Indices: H3Index[]
  zoom: number
  tempUserId: string

  setUserLocation: (pos: GeoPosition) => void
  setVisibleH3Indices: (indices: H3Index[]) => void
  setZoom: (zoom: number) => void
}

export const useMapStore = create<MapState>((set) => ({
  userLocation: null,
  userH3Index: null,
  visibleH3Indices: [],
  zoom: 2,
  tempUserId: typeof window !== "undefined" ? getTempUserId() : "",

  setUserLocation: (pos) =>
    set({
      userLocation: pos,
      userH3Index: locationToH3(pos),
    }),

  setVisibleH3Indices: (indices) =>
    set({ visibleH3Indices: indices }),

  setZoom: (zoom) =>
    set({ zoom }),
}))
