import type { Transition, Variants } from "framer-motion"

// Shared motion vocabulary. Import from here so every animation in the app
// speaks the same rhythm (durations, springs, enter/exit shapes) instead of
// each component inventing its own timing. The global default transition is
// wired once via <MotionConfig transition={SPRING.soft}> in map-view.

/** Tween durations in seconds. Micro-interactions live in fast/base. */
export const DURATION = { fast: 0.15, base: 0.22, slow: 0.32 } as const

/** Physics presets — the default feel of the app. */
export const SPRING = {
  soft: { type: "spring", stiffness: 260, damping: 26, mass: 0.9 },
  snappy: { type: "spring", stiffness: 420, damping: 30 },
} satisfies Record<string, Transition>

/** Fade + rise: menus, sheets, the composer. */
export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8, transition: { duration: DURATION.fast } },
} satisfies Variants

/** Fade + grow: pills, small pop-ins (word-cloud words, chips). */
export const scaleIn = {
  initial: { opacity: 0, scale: 0.7 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.7, transition: { duration: DURATION.fast } },
} satisfies Variants

/** A note arriving on / leaving the map. Slightly deeper scale than scaleIn. */
export const bubbleInOut = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.6, transition: { duration: DURATION.fast } },
} satisfies Variants

/** Press feedback for tappable controls. Spread onto a motion element. */
export const pressTap = { whileTap: { scale: 0.96 } } as const
