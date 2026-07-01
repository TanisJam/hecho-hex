"use client"

import { useRef, useCallback } from "react"
import Map, { GeolocateControl, MapProvider, type MapRef } from "react-map-gl/mapbox"
import { useGeolocation } from "@/hooks/use-geolocation"
import { useViewportHexes } from "@/hooks/use-viewport-hexes"
import { useMapStore } from "@/store/map-store"
import { HexGridLayer } from "./hex-grid-layer"
import { WordCloudLayer } from "./word-cloud-layer"
import { MessageLayer } from "../messages/message-layer"
import { ComposeBubble } from "../messages/compose-bubble"
import { useRealtimeMessages } from "@/hooks/use-realtime-messages"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const MapView = () => {
  const mapRef = useRef<MapRef>(null)
  const userLocation = useMapStore((s) => s.userLocation)
  const bumpViewportVersion = useMapStore((s) => s.bumpViewportVersion)
  const { error: geoError } = useGeolocation()
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
        <GeolocateControl
          position="bottom-right"
          trackUserLocation
          showUserHeading
        />
        <HexGridLayer />
      </Map>

      <MessageLayer />
      <WordCloudLayer />
      <ComposeBubble />

      {geoError && (
        <div className="absolute bottom-4 left-4 rounded-lg bg-red-900/80 px-3 py-2 text-sm text-red-200">
          GPS: {geoError}
        </div>
      )}
    </MapProvider>
  )
}

export default MapView
