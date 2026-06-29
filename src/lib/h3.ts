import {
  latLngToCell,
  cellToBoundary,
  polygonToCells,
  cellToLatLng,
} from "h3-js"
import type { GeoPosition, H3Index } from "@/types"
import type { LngLatBounds } from "mapbox-gl"

export const H3_RESOLUTION = 9
export const H3_RESOLUTION_LOW = 7

export function locationToH3(pos: GeoPosition, resolution = H3_RESOLUTION): H3Index {
  return latLngToCell(pos.lat, pos.lng, resolution)
}

export function isUserInHex(location: GeoPosition, h3Index: H3Index): boolean {
  return latLngToCell(location.lat, location.lng, H3_RESOLUTION) === h3Index
}

export function hexCenterToLngLat(h3Index: H3Index): [number, number] {
  const [lat, lng] = cellToLatLng(h3Index)
  return [lng, lat]
}

/** h3-js returns [lat, lng], GeoJSON needs [lng, lat] */
function hexBoundaryToCoords(h3Index: H3Index): [number, number][] {
  const boundary = cellToBoundary(h3Index)
  const coords = boundary.map(([lat, lng]) => [lng, lat] as [number, number])
  coords.push(coords[0]) // close the polygon
  return coords
}

export function hexagonsToGeoJSON(
  indices: H3Index[],
  userH3Index?: H3Index | null
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: indices.map((h3Index) => ({
      type: "Feature" as const,
      properties: {
        h3Index,
        isUserHex: h3Index === userH3Index,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [hexBoundaryToCoords(h3Index)],
      },
    })),
  }
}

export function getViewportHexagons(
  bounds: LngLatBounds,
  resolution = H3_RESOLUTION
): H3Index[] {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()

  // polygonToCells expects [lat, lng] pairs by default
  const polygon: [number, number][] = [
    [sw.lat, sw.lng],
    [sw.lat, ne.lng],
    [ne.lat, ne.lng],
    [ne.lat, sw.lng],
    [sw.lat, sw.lng],
  ]

  try {
    return polygonToCells(polygon, resolution)
  } catch {
    return []
  }
}

export function getResolutionForZoom(zoom: number): number {
  if (zoom >= 14) return 9
  if (zoom >= 11) return 8
  return 7
}
