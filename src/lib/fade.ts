import type { Message } from "@/types"

export function computeOpacity(message: Message): number {
  const ageMs = Date.now() - new Date(message.created_at).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  const totalReactions = Object.values(message.reactions).reduce(
    (a, b) => a + b,
    0
  )
  // Each reaction adds 1h of life, capped at 24h bonus
  const oxygenHours = Math.min(totalReactions, 24)
  const effectiveAge = Math.max(0, ageHours - oxygenHours)
  return Math.max(0, 1 - effectiveAge / 24)
}

export function isMessageExpired(message: Message): boolean {
  return computeOpacity(message) <= 0.02
}
