"use client"

import { useEffect, useRef, useState } from "react"
import { useMapStore } from "@/store/map-store"
import { locationToH3 } from "@/lib/h3"

// Standard GeolocationPositionError codes, decoupled from the DOM class so
// consumers (e.g. the recenter button) can map a code to user-facing copy
// without constructing a GeolocationPositionError themselves.
export type GeoError = {
  code: number // 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
  message: string
}

/**
 * Single source of truth for the user's position. Runs one watchPosition and
 * feeds the map store (userLocation + userH3Index). The map's recenter button
 * only reads this state and flies the camera — it never requests geolocation
 * again, so there is exactly one permission prompt and one watcher.
 */
export function useGeolocation() {
  const setUserLocation = useMapStore((s) => s.setUserLocation)
  const [error, setError] = useState<GeoError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pendingH3Ref = useRef<string | null>(null)
  const hysteresisTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setIsLoading(false)
      setError({ code: 2, message: "Geolocation not supported" })
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setIsLoading(false)
        setError(null)
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }

        const newH3 = locationToH3(pos)
        const currentH3 = useMapStore.getState().userH3Index

        // Hysteresis: only change hex after 3s sustained in new cell
        if (newH3 !== currentH3) {
          if (pendingH3Ref.current !== newH3) {
            pendingH3Ref.current = newH3
            if (hysteresisTimer.current) clearTimeout(hysteresisTimer.current)
            hysteresisTimer.current = setTimeout(() => {
              setUserLocation(pos)
              pendingH3Ref.current = null
            }, 3000)
          }
        } else {
          // Still in same hex, just update coords
          if (hysteresisTimer.current) {
            clearTimeout(hysteresisTimer.current)
            pendingH3Ref.current = null
          }
          // Update location without changing hex (coords only)
          useMapStore.setState({ userLocation: pos })
        }

        // First location - set immediately
        if (!currentH3) {
          if (hysteresisTimer.current) clearTimeout(hysteresisTimer.current)
          pendingH3Ref.current = null
          setUserLocation(pos)
        }
      },
      (err) => {
        setIsLoading(false)
        setError({ code: err.code, message: err.message })
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
      if (hysteresisTimer.current) clearTimeout(hysteresisTimer.current)
    }
  }, [setUserLocation])

  return { error, isLoading }
}
