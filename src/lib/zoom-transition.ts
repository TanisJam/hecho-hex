import { WORD_CLOUD_MAX_ZOOM } from "@/store/map-store"
import { ZOOM_TRANSITION_BAND } from "./constants"

// The word cloud and the message bubbles used to hard-swap at exactly
// WORD_CLOUD_MAX_ZOOM. Instead, they crossfade across a band straddling that
// threshold: below LOW it's all word cloud, above HIGH it's all bubbles, and in
// between both render with complementary opacities so words visually "resolve"
// into readable notes as you zoom in. This is the app's signature transition.
export const ZOOM_TRANSITION_LOW = WORD_CLOUD_MAX_ZOOM - ZOOM_TRANSITION_BAND / 2
export const ZOOM_TRANSITION_HIGH = WORD_CLOUD_MAX_ZOOM + ZOOM_TRANSITION_BAND / 2

/** 0 at/below LOW (full cloud) → 1 at/above HIGH (full bubbles). */
function progress(zoom: number): number {
  if (zoom <= ZOOM_TRANSITION_LOW) return 0
  if (zoom >= ZOOM_TRANSITION_HIGH) return 1
  return (
    (zoom - ZOOM_TRANSITION_LOW) /
    (ZOOM_TRANSITION_HIGH - ZOOM_TRANSITION_LOW)
  )
}

export function messageOpacity(zoom: number): number {
  return progress(zoom)
}

export function wordCloudOpacity(zoom: number): number {
  return 1 - progress(zoom)
}

/** Whether each layer should render at all across the (band-inclusive) range. */
export function messageLayerActive(zoom: number): boolean {
  return zoom > ZOOM_TRANSITION_LOW
}

export function wordCloudActive(zoom: number): boolean {
  return zoom < ZOOM_TRANSITION_HIGH
}
