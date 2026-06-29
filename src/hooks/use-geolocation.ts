"use client"

import { useEffect, useRef, useState } from "react"
import { useMapStore } from "@/store/map-store"
import { locationToH3 } from "@/lib/h3"

export function useGeolocation() {
  const setUserLocation = useMapStore((s) => s.setUserLocation)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pendingH3Ref = useRef<string | null>(null)
  const hysteresisTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported")
      setIsLoading(false)
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setIsLoading(false)
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
        setError(err.message)
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
