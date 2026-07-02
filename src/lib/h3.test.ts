import { describe, it, expect } from "vitest"
import { latLngToCell, cellToParent } from "h3-js"
import { LngLatBounds } from "mapbox-gl"
import {
  H3_RESOLUTION,
  H3_RESOLUTION_MID,
  H3_RESOLUTION_LOW,
  cellAtResolution,
  columnForResolution,
  getResolutionForZoom,
  locationToH3,
  isUserInHex,
  hexCenterToLngLat,
  hexagonsToGeoJSON,
  getViewportHexagons,
} from "@/lib/h3"
import type { GeoPosition } from "@/types"

// Buenos Aires (clearly distinguishable lat/lng: lat ~ -34, lng ~ -58).
const BUENOS_AIRES: GeoPosition = { lat: -34.6037, lng: -58.3816 }
// A distant location (New York), used for "not in hex" assertions.
const NEW_YORK: GeoPosition = { lat: 40.7128, lng: -74.006 }

describe("cellAtResolution", () => {
  const h3Res9 = latLngToCell(BUENOS_AIRES.lat, BUENOS_AIRES.lng, H3_RESOLUTION)

  it("returns the index unchanged when resolution >= H3_RESOLUTION", () => {
    expect(cellAtResolution(h3Res9, H3_RESOLUTION)).toBe(h3Res9)
    expect(cellAtResolution(h3Res9, H3_RESOLUTION + 1)).toBe(h3Res9)
  })

  it("returns the correct parent cell at resolution 8", () => {
    const expected = cellToParent(h3Res9, H3_RESOLUTION_MID)
    expect(cellAtResolution(h3Res9, H3_RESOLUTION_MID)).toBe(expected)
    expect(cellAtResolution(h3Res9, H3_RESOLUTION_MID)).toBe(
      latLngToCell(BUENOS_AIRES.lat, BUENOS_AIRES.lng, H3_RESOLUTION_MID)
    )
  })

  it("returns the correct parent cell at resolution 7", () => {
    const expected = cellToParent(h3Res9, H3_RESOLUTION_LOW)
    expect(cellAtResolution(h3Res9, H3_RESOLUTION_LOW)).toBe(expected)
    expect(cellAtResolution(h3Res9, H3_RESOLUTION_LOW)).toBe(
      latLngToCell(BUENOS_AIRES.lat, BUENOS_AIRES.lng, H3_RESOLUTION_LOW)
    )
  })
})

describe("columnForResolution", () => {
  it("maps resolution 9 and above to h3_index", () => {
    expect(columnForResolution(9)).toBe("h3_index")
    expect(columnForResolution(10)).toBe("h3_index")
  })

  it("maps resolution 8 to h3_res8", () => {
    expect(columnForResolution(8)).toBe("h3_res8")
  })

  it("maps resolution 7 and below to h3_res7", () => {
    expect(columnForResolution(7)).toBe("h3_res7")
    expect(columnForResolution(6)).toBe("h3_res7")
  })
})

describe("getResolutionForZoom", () => {
  // Actual thresholds in the implementation: zoom >= 14 -> 9, zoom >= 11 -> 8, else -> 7.
  it("returns H3_RESOLUTION_LOW below zoom 11", () => {
    expect(getResolutionForZoom(7.9)).toBe(H3_RESOLUTION_LOW)
    expect(getResolutionForZoom(8)).toBe(H3_RESOLUTION_LOW)
    expect(getResolutionForZoom(10.9)).toBe(H3_RESOLUTION_LOW)
  })

  it("returns H3_RESOLUTION_MID between zoom 11 (inclusive) and 14 (exclusive)", () => {
    expect(getResolutionForZoom(11)).toBe(H3_RESOLUTION_MID)
    expect(getResolutionForZoom(13.9)).toBe(H3_RESOLUTION_MID)
  })

  it("returns H3_RESOLUTION at zoom 14 and above", () => {
    expect(getResolutionForZoom(14)).toBe(H3_RESOLUTION)
    expect(getResolutionForZoom(20)).toBe(H3_RESOLUTION)
  })
})

describe("locationToH3 / isUserInHex", () => {
  it("round-trips: a location's own cell contains that location", () => {
    const cell = locationToH3(BUENOS_AIRES)
    expect(isUserInHex(BUENOS_AIRES, cell)).toBe(true)
  })

  it("returns false for a distant location", () => {
    const cell = locationToH3(BUENOS_AIRES)
    expect(isUserInHex(NEW_YORK, cell)).toBe(false)
  })
})

describe("hexCenterToLngLat", () => {
  it("returns coordinates in [lng, lat] order", () => {
    const cell = locationToH3(BUENOS_AIRES)
    const [lng, lat] = hexCenterToLngLat(cell)

    // Buenos Aires: lng ~ -58 (clearly not the latitude ~ -34).
    expect(lng).toBeLessThan(-50)
    expect(lat).toBeGreaterThan(-40)
    expect(lat).toBeLessThan(-30)
    expect(lng).toBeCloseTo(BUENOS_AIRES.lng, 0)
    expect(lat).toBeCloseTo(BUENOS_AIRES.lat, 0)
  })
})

describe("hexagonsToGeoJSON polygon geometry", () => {
  const cell = locationToH3(BUENOS_AIRES)

  it("emits ring coordinates in [lng, lat] order", () => {
    const geojson = hexagonsToGeoJSON([cell])
    const geometry = geojson.features[0]?.geometry as GeoJSON.Polygon
    const ring = geometry.coordinates[0]

    // A non-pentagon H3 hexagon boundary has exactly 6 vertices, plus the
    // closing point that duplicates the first vertex.
    expect(ring.length).toBe(7)
    for (const [lng, lat] of ring) {
      expect(lng).toBeLessThan(-50)
      expect(lat).toBeGreaterThan(-40)
      expect(lat).toBeLessThan(-30)
    }
  })

  it("closes the polygon ring (first coordinate === last coordinate)", () => {
    const geojson = hexagonsToGeoJSON([cell])
    const geometry = geojson.features[0]?.geometry as GeoJSON.Polygon
    const ring = geometry.coordinates[0]

    expect(ring[0]).toEqual(ring[ring.length - 1])
  })
})

describe("hexagonsToGeoJSON isUserHex flag", () => {
  const userH3Index = locationToH3(BUENOS_AIRES)
  const otherH3Index = locationToH3(NEW_YORK)

  it("flags the res-7 parent of the user's cell when displayResolution=7", () => {
    const userParent = cellToParent(userH3Index, H3_RESOLUTION_LOW)
    const otherParent = cellToParent(otherH3Index, H3_RESOLUTION_LOW)

    const geojson = hexagonsToGeoJSON(
      [userParent, otherParent],
      H3_RESOLUTION_LOW,
      userH3Index
    )

    const userFeature = geojson.features.find((f) => f.properties?.h3Index === userParent)
    const otherFeature = geojson.features.find((f) => f.properties?.h3Index === otherParent)

    expect(userFeature?.properties?.isUserHex).toBe(true)
    expect(otherFeature?.properties?.isUserHex).toBe(false)
  })

  it("flags the exact matching cell when displayResolution=9", () => {
    const geojson = hexagonsToGeoJSON(
      [userH3Index, otherH3Index],
      H3_RESOLUTION,
      userH3Index
    )

    const userFeature = geojson.features.find((f) => f.properties?.h3Index === userH3Index)
    const otherFeature = geojson.features.find((f) => f.properties?.h3Index === otherH3Index)

    expect(userFeature?.properties?.isUserHex).toBe(true)
    expect(otherFeature?.properties?.isUserHex).toBe(false)
  })
})

describe("getViewportHexagons", () => {
  it("returns a non-empty set of cells for a normal viewport", () => {
    const bounds = new LngLatBounds([-58.6, -34.7], [-58.3, -34.5])
    const cells = getViewportHexagons(bounds, H3_RESOLUTION_LOW)

    expect(cells.length).toBeGreaterThan(0)

    // Cell centers should lie within/near the bbox. Hex cells near the edge
    // can extend slightly beyond the requested bounds since the grid isn't
    // clipped to the exact polygon, so allow a small tolerance.
    const tolerance = 0.5
    for (const cell of cells) {
      const [lng, lat] = hexCenterToLngLat(cell)
      expect(lng).toBeGreaterThan(-58.6 - tolerance)
      expect(lng).toBeLessThan(-58.3 + tolerance)
      expect(lat).toBeGreaterThan(-34.7 - tolerance)
      expect(lat).toBeLessThan(-34.5 + tolerance)
    }
  })

  it("returns cells on both sides of the antimeridian for a wrapped viewport", () => {
    // sw.lng=179.5, ne.lng=-179.5 — both already normalized into (-180, 180],
    // so swLng (179.5) > neLng (-179.5) triggers the antimeridian split.
    const bounds = new LngLatBounds([179.5, -1], [-179.5, 1])
    const cells = getViewportHexagons(bounds, H3_RESOLUTION_LOW)

    expect(cells.length).toBeGreaterThan(0)

    const lngs = cells.map((cell) => hexCenterToLngLat(cell)[0])
    expect(lngs.some((lng) => lng > 179)).toBe(true)
    expect(lngs.some((lng) => lng < -179)).toBe(true)
  })

  it("returns cells on both sides of the antimeridian for an unwrapped viewport", () => {
    // sw.lng=175, ne.lng=185 (raw, unwrapped, as mapbox-gl provides for a
    // viewport spanning multiple world copies). normalizeLng maps 185 to
    // -175, so swLng (175) > neLng (-175) triggers the same split, this
    // time covering [175, 180] and [-180, -175].
    const bounds = new LngLatBounds([175, -1], [185, 1])
    const cells = getViewportHexagons(bounds, H3_RESOLUTION_LOW)

    expect(cells.length).toBeGreaterThan(0)

    const lngs = cells.map((cell) => hexCenterToLngLat(cell)[0])
    expect(lngs.some((lng) => lng > 170)).toBe(true)
    expect(lngs.some((lng) => lng < -170)).toBe(true)
  })
})
