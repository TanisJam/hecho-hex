import {
  latLngToCell,
  cellToBoundary,
  polygonToCells,
  cellToLatLng,
  cellToParent,
} from "h3-js"
import type { GeoPosition, H3Index } from "@/types"
import type { LngLatBounds } from "mapbox-gl"

// Resolution messages are written (and stored) at.
export const H3_RESOLUTION = 9
// Display resolutions used for the visible hex grid at lower zoom levels
// (see getResolutionForZoom). Messages carry precomputed parent cells at
// these resolutions (h3_res7 / h3_res8) so viewport queries can match the
// resolution actually rendered on screen.
export const H3_RESOLUTION_MID = 8
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
  displayResolution: number = H3_RESOLUTION,
  userH3Index?: H3Index | null
): GeoJSON.FeatureCollection {
  // userH3Index is always stored at H3_RESOLUTION (9). Below zoom 14 the
  // grid is rendered at a coarser resolution, so it must be compared
  // against the matching parent cell instead of the raw index.
  const userDisplayHex =
    userH3Index == null ? null : cellAtResolution(userH3Index, displayResolution)

  return {
    type: "FeatureCollection",
    features: indices.map((h3Index) => ({
      type: "Feature" as const,
      properties: {
        h3Index,
        isUserHex: h3Index === userDisplayHex,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [hexBoundaryToCoords(h3Index)],
      },
    })),
  }
}

// polygonToCells expects [lat, lng] pairs by default
function hexagonsForBBox(
  swLat: number,
  swLng: number,
  neLat: number,
  neLng: number,
  resolution: number
): H3Index[] {
  const polygon: [number, number][] = [
    [swLat, swLng],
    [swLat, neLng],
    [neLat, neLng],
    [neLat, swLng],
    [swLat, swLng],
  ]

  try {
    return polygonToCells(polygon, resolution)
  } catch {
    return []
  }
}

// mapbox-gl's LngLatBounds does not wrap longitudes for viewports that span
// multiple world copies — e.g. a viewport straddling the antimeridian comes
// back as sw.lng=175, ne.lng=185 (raw, unwrapped), never as sw.lng > ne.lng.
// Normalize into (-180, 180] first so the crossing can actually be detected.
function normalizeLng(lng: number): number {
  return (((lng + 180) % 360) + 360) % 360 - 180
}

export function getViewportHexagons(
  bounds: LngLatBounds,
  resolution = H3_RESOLUTION
): H3Index[] {
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const swLng = normalizeLng(sw.lng)
  const neLng = normalizeLng(ne.lng)

  if (swLng > neLng) {
    // Viewport straddles the antimeridian (+/-180) — split into a
    // west-of-180 and an east-of-180 polygon and merge/dedupe the results.
    const west = hexagonsForBBox(sw.lat, swLng, ne.lat, 180, resolution)
    const east = hexagonsForBBox(sw.lat, -180, ne.lat, neLng, resolution)
    return Array.from(new Set([...west, ...east]))
  }

  return hexagonsForBBox(sw.lat, swLng, ne.lat, neLng, resolution)
}

export function getResolutionForZoom(zoom: number): number {
  if (zoom >= 14) return H3_RESOLUTION
  if (zoom >= 11) return H3_RESOLUTION_MID
  return H3_RESOLUTION_LOW
}

// Messages are always stored at H3_RESOLUTION (9). Below that resolution the
// grid/visible-hex set uses coarser parent cells, so callers must compare
// against the matching parent cell instead of the raw index.
export function cellAtResolution(h3Index: H3Index, resolution: number): H3Index {
  return resolution >= H3_RESOLUTION ? h3Index : cellToParent(h3Index, resolution)
}

export function columnForResolution(
  resolution: number
): "h3_index" | "h3_res8" | "h3_res7" {
  if (resolution >= H3_RESOLUTION) return "h3_index"
  if (resolution === H3_RESOLUTION_MID) return "h3_res8"
  return "h3_res7"
}
