"use client"

import { Marker } from "react-map-gl/mapbox"
import { useMapStore } from "@/store/map-store"

/**
 * "You are here" marker: a brand-teal dot with a repeating pulse ring, shown
 * once geolocation resolves. Uses the `user-marker-pulse` keyframe (globals.css)
 * — which respects prefers-reduced-motion — and only renders inside <Map>.
 */
export function UserLocationMarker() {
  const userLocation = useMapStore((s) => s.userLocation)
  if (!userLocation) return null

  return (
    <Marker
      longitude={userLocation.lng}
      latitude={userLocation.lat}
      anchor="center"
    >
      <div
        role="img"
        aria-label="Your location"
        className="relative flex size-3 items-center justify-center"
      >
        <span
          aria-hidden
          className="user-marker-pulse absolute inset-0 rounded-full bg-brand"
        />
        <span className="relative size-3 rounded-full bg-brand ring-2 ring-black/50" />
      </div>
    </Marker>
  )
}
