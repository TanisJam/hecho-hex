import { describe, it, expect } from "vitest"
import { shiftAndScaleOffset } from "./use-force-simulation"

describe("shiftAndScaleOffset", () => {
  it("is a no-op when the target hasn't moved and k is 1", () => {
    expect(shiftAndScaleOffset(120, 100, 100, 1)).toBe(120)
  })

  it("shifts the value by the target delta when k is 1 (pure pan)", () => {
    // Target moved from 100 to 150 (+50 pan), offset from target (20) is
    // preserved: 120 -> 170.
    expect(shiftAndScaleOffset(120, 100, 150, 1)).toBe(170)
  })

  it("scales the offset around the new target on zoom-in (k > 1)", () => {
    // Offset from target is 20 (120 - 100). No pan (target stays at 100).
    // Zooming in by one level doubles the offset: 100 + 20 * 2 = 140.
    expect(shiftAndScaleOffset(120, 100, 100, 2)).toBe(140)
  })

  it("scales the offset around the new target on zoom-out (k < 1)", () => {
    // Offset from target is 20. Zooming out by one level halves it:
    // 100 + 20 * 0.5 = 110.
    expect(shiftAndScaleOffset(120, 100, 100, 0.5)).toBe(110)
  })

  it("combines a pan shift and a zoom rescale", () => {
    // Target pans from 100 to 150 (offset stays 20), then zoom-in (k=2)
    // doubles it around the new target: 150 + 20 * 2 = 190.
    expect(shiftAndScaleOffset(120, 100, 150, 2)).toBe(190)
  })

  it("collapses the offset to zero at the target regardless of k", () => {
    expect(shiftAndScaleOffset(100, 100, 100, 2)).toBe(100)
    expect(shiftAndScaleOffset(100, 100, 100, 0.5)).toBe(100)
  })
})
