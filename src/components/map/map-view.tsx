"use client"

import { useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"
import { motion, MotionConfig } from "framer-motion"
import { LocateFixed, LocateOff, Loader2, Crosshair } from "lucide-react"
import Map, { MapProvider, type MapRef } from "react-map-gl/mapbox"
import { useGeolocation, type GeoError } from "@/hooks/use-geolocation"
import { useViewportHexes } from "@/hooks/use-viewport-hexes"
import { useMapStore } from "@/store/map-store"
import { MIN_HEX_ZOOM } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { HexGridLayer } from "./hex-grid-layer"
import { WordCloudLayer } from "./word-cloud-layer"
import { UserLocationMarker } from "./user-location-marker"
import { MapOverlays } from "./map-overlays"
import { MessageLayer } from "../messages/message-layer"
import { ComposeBubble } from "../messages/compose-bubble"
import { Onboarding } from "../onboarding"
import { useRealtimeMessages } from "@/hooks/use-realtime-messages"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// Zoom the camera flies to when it auto-centers / recenters on the user.
const FOCUS_ZOOM = 15

function geoErrorMessage(e: GeoError): string {
  switch (e.code) {
    case 1: // PERMISSION_DENIED
      return "Location permission denied. Enable it in your browser to center the map on you."
    case 3: // TIMEOUT
      return "Couldn't get your location in time. On a desktop without GPS this often fails — try a device with location services."
    default: // POSITION_UNAVAILABLE / unsupported
      return "Your location is unavailable right now."
  }
}

const MapView = () => {
  const mapRef = useRef<MapRef>(null)
  const userLocation = useMapStore((s) => s.userLocation)
  const dropPing = useMapStore((s) => s.dropPing)
  const bumpViewportVersion = useMapStore((s) => s.bumpViewportVersion)
  const { error: geoError, isLoading: geoLoading } = useGeolocation()
  const { updateViewport } = useViewportHexes(mapRef)
  useRealtimeMessages()

  // Pull the camera to the user once, on first fix — but only if they haven't
  // already zoomed in themselves (so a bare world view becomes a real place
  // instead of stranding a new visitor at zoom 2 where nothing renders).
  const hasAutoZoomed = useRef(false)
  const maybeAutoZoom = useCallback(() => {
    if (hasAutoZoomed.current) return
    const map = mapRef.current
    if (!map || !userLocation) return
    hasAutoZoomed.current = true
    if (map.getZoom() >= MIN_HEX_ZOOM) return
    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: FOCUS_ZOOM,
      duration: 2000,
    })
  }, [userLocation])

  useEffect(() => {
    maybeAutoZoom()
  }, [maybeAutoZoom])

  const handleMove = useCallback(() => {
    // Undebounced: screen-space layers must reproject every camera frame.
    bumpViewportVersion()
    // Debounced internally: recomputing the visible hex set is expensive.
    updateViewport()
  }, [bumpViewportVersion, updateViewport])

  const handleLoad = useCallback(() => {
    updateViewport()
    maybeAutoZoom()
  }, [updateViewport, maybeAutoZoom])

  // Recenter button: reads the location the geolocation hook already tracks and
  // flies the camera there. It never requests geolocation itself, so there is a
  // single watcher and a single permission prompt for the whole app.
  const handleRecenter = useCallback(() => {
    if (userLocation) {
      mapRef.current?.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: FOCUS_ZOOM,
        duration: 1200,
      })
    } else if (geoError) {
      toast.error(geoErrorMessage(geoError))
    } else {
      toast("Getting your location…")
    }
  }, [userLocation, geoError])

  const recenterIcon = geoError ? (
    <LocateOff />
  ) : !userLocation && geoLoading ? (
    <Loader2 className="animate-spin" />
  ) : (
    <LocateFixed />
  )

  return (
    <MotionConfig reducedMotion="user">
      <MapProvider>
        <Map
          id="echohex-map"
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={{
            longitude: userLocation?.lng ?? -3.7,
            latitude: userLocation?.lat ?? 40.4,
            zoom: 2,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          onMove={handleMove}
          onMoveEnd={handleMove}
          onLoad={handleLoad}
          attributionControl={false}
        >
          <HexGridLayer />
          <UserLocationMarker />
        </Map>

        {/* Center reticle: notes drop at the hex under this point — the
            "Write here" button reads the viewport center (see ComposeBubble).
            The keyed ring pulses once each time a note is posted here. */}
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          {dropPing > 0 && (
            <motion.span
              key={dropPing}
              initial={{ scale: 0.3, opacity: 0.8 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="absolute size-16 rounded-full border-2 border-brand"
            />
          )}
          <Crosshair
            className="size-8 text-white/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>

        <MessageLayer />
        <WordCloudLayer />
        <MapOverlays />
        <ComposeBubble />

        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={handleRecenter}
          aria-label="Center map on my location"
          className="absolute z-10 size-11 shadow-lg"
          style={{
            bottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))",
            right: "max(1rem, calc(env(safe-area-inset-right) + 0.5rem))",
          }}
        >
          {recenterIcon}
        </Button>

        <Onboarding />
      </MapProvider>
    </MotionConfig>
  )
}

export default MapView
