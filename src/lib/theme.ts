// The signature "echo glow" teal — the app's single brand color.
//
// This is the JS/Mapbox-facing source. Mapbox GL paint expressions can't read
// CSS custom properties, so DOM glows (text-shadow, borders) mirror the same
// channels as `--brand-glow-rgb` in globals.css. Keep the two in sync: this
// file is comma-separated for rgba(), the CSS side is space-separated for the
// modern rgb(x y z / a) syntax. Same teal, two required formats.
export const BRAND_GLOW_RGB = "0, 255, 200"

/** rgba() string for the brand glow at a given alpha (for Mapbox paint, etc.). */
export const brandGlow = (alpha: number): string =>
  `rgba(${BRAND_GLOW_RGB}, ${alpha})`

/** Neutral white overlay at a given alpha (grid lines, faint surfaces). */
export const whiteAlpha = (alpha: number): string =>
  `rgba(255, 255, 255, ${alpha})`
