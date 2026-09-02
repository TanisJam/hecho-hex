"use client"

import { useRef, useCallback } from "react"
import { toast } from "sonner"
import { LocateFixed, LocateOff, Loader2, Crosshair } from "lucide-react"
import Map, { MapProvider, type MapRef } from "react-map-gl/mapbox"
import { useGeolocation, type GeoError } from "@/hooks/use-geolocation"
import { useViewportHexes } from "@/hooks/use-viewport-hexes"
import { useMapStore } from "@/store/map-store"
import { Button } from "@/components/ui/button"
import { HexGridLayer } from "./hex-grid-layer"
import { WordCloudLayer } from "./word-cloud-layer"
import { MessageLayer } from "../messages/message-layer"
import { ComposeBubble } from "../messages/compose-bubble"
import { useRealtimeMessages } from "@/hooks/use-realtime-messages"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

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
  const bumpViewportVersion = useMapStore((s) => s.bumpViewportVersion)
  const { error: geoError, isLoading: geoLoading } = useGeolocation()
  const { updateViewport } = useViewportHexes(mapRef)
  useRealtimeMessages()

  const handleMove = useCallback(() => {
    // Undebounced: screen-space layers must reproject every camera frame.
    bumpViewportVersion()
    // Debounced internally: recomputing the visible hex set is expensive.
    updateViewport()
  }, [bumpViewportVersion, updateViewport])

  const handleLoad = useCallback(() => {
    updateViewport()
  }, [updateViewport])

  // Recenter button: reads the location the geolocation hook already tracks and
  // flies the camera there. It never requests geolocation itself, so there is a
  // single watcher and a single permission prompt for the whole app.
  const handleRecenter = useCallback(() => {
    if (userLocation) {
      mapRef.current?.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 15,
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
      </Map>

      {/* Center reticle: notes drop at the hex under this point — the
          "Write here" button reads the viewport center (see ComposeBubble). */}
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <Crosshair
          className="size-8 text-white/60 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
          strokeWidth={1.5}
        />
      </div>

      <MessageLayer />
      <WordCloudLayer />
      <ComposeBubble />

      <Button
        type="button"
        variant="secondary"
        size="icon"
        onClick={handleRecenter}
        aria-label="Center map on my location"
        className="absolute bottom-4 right-4 z-10 shadow-lg"
      >
        {recenterIcon}
      </Button>
    </MapProvider>
  )
}

export default MapView
