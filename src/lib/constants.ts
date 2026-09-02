// Single source of truth for tunables that were previously duplicated or
// buried as inline magic numbers across the app. Import from here instead of
// re-typing a literal so the two sides of a rule can never drift apart.

// --- Messages ---------------------------------------------------------------

/** Max length of a note. Enforced client-side (compose) and in the API layer. */
export const MAX_MESSAGE_CHARS = 200

// --- Fade / lifetime --------------------------------------------------------

/** A note fully fades out this many hours after it was created. */
export const MESSAGE_LIFETIME_HOURS = 24
/** Each reaction buys the note this many extra hours of life ("oxygen"). */
export const REACTION_OXYGEN_HOURS_EACH = 1
/** Cap on the total life a note can gain from reactions. */
export const REACTION_OXYGEN_CAP_HOURS = 24
/** Below this opacity a note is treated as expired and not rendered. */
export const FADE_HIDDEN_THRESHOLD = 0.02

// --- Viewport / hex computation --------------------------------------------

/** Below this zoom the viewport hex set is left empty (too coarse to be useful). */
export const MIN_HEX_ZOOM = 8
/** Guardrail: skip hex computation when the viewport would yield more cells. */
export const HEX_VIEWPORT_CAP = 2000
/** Debounce for the (expensive) visible-hex recomputation on camera move. */
export const VIEWPORT_DEBOUNCE_MS = 300

// --- Zoom transition band (word cloud <-> message bubbles) ------------------

// The two layers used to hard-swap at exactly WORD_CLOUD_MAX_ZOOM. This band
// (centered on that threshold) is the zoom range over which the word cloud
// crossfades into readable bubbles instead of popping. See map-store.ts for
// the threshold itself and lib/zoom-transition.ts for the crossfade math.
export const ZOOM_TRANSITION_BAND = 1.25

// --- Hex grid ---------------------------------------------------------------

/** Duration (ms) of the hex grid fading in/out via Mapbox paint transitions. */
export const HEX_FADE_MS = 300
