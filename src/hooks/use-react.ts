"use client"

import { useCallback } from "react"
import { addReaction } from "@/lib/messages"
import { useMessageStore } from "@/store/message-store"
import { toast } from "sonner"

/**
 * Returns a fire-and-stack reaction handler shared by the emoji picker and the
 * existing reaction pills. Each call bumps the count immediately (optimistic)
 * and sends its own request with no in-flight lock, so rapid taps all land; a
 * failed one rolls back just its own increment and the realtime UPDATE
 * reconciles the authoritative total.
 */
export function useReact() {
  const applyReaction = useMessageStore((s) => s.applyReaction)

  return useCallback(
    (messageId: string, emoji: string) => {
      applyReaction(messageId, emoji, 1)
      addReaction(messageId, emoji).catch(() => {
        applyReaction(messageId, emoji, -1)
        toast.error("Failed to react")
      })
    },
    [applyReaction]
  )
}
