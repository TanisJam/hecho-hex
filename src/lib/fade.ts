import type { Message } from "@/types"
import {
  MESSAGE_LIFETIME_HOURS,
  REACTION_OXYGEN_HOURS_EACH,
  REACTION_OXYGEN_CAP_HOURS,
  FADE_HIDDEN_THRESHOLD,
} from "./constants"

export function computeOpacity(message: Message): number {
  const ageMs = Date.now() - new Date(message.created_at).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  const totalReactions = Object.values(message.reactions).reduce(
    (a, b) => a + b,
    0
  )
  // Each reaction adds oxygen (extra life), capped at REACTION_OXYGEN_CAP_HOURS.
  const oxygenHours = Math.min(
    totalReactions * REACTION_OXYGEN_HOURS_EACH,
    REACTION_OXYGEN_CAP_HOURS
  )
  const effectiveAge = Math.max(0, ageHours - oxygenHours)
  return Math.max(0, 1 - effectiveAge / MESSAGE_LIFETIME_HOURS)
}

export function isMessageExpired(message: Message): boolean {
  return computeOpacity(message) <= FADE_HIDDEN_THRESHOLD
}
