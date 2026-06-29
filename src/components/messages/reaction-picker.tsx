"use client"

import { useState } from "react"
import { addReaction } from "@/lib/messages"
import { toast } from "sonner"

const EMOJIS = ["🔥", "❤️", "💀", "👀", "💯", "✨", "😂", "👋"]

interface ReactionPickerProps {
  messageId: string
  isOwn: boolean
}

export function ReactionPicker({ messageId, isOwn }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const handleReact = async (emoji: string) => {
    setSending(true)
    try {
      await addReaction(messageId, emoji)
      setIsOpen(false)
    } catch {
      toast.error("Failed to react")
    } finally {
      setSending(false)
    }
  }

  if (isOwn) return null

  return (
    <div className="mt-1">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/40 transition-colors hover:bg-white/10 hover:text-white/60"
        >
          +
        </button>
      ) : (
        <div className="flex gap-0.5 rounded-full bg-black/60 px-1 py-0.5 backdrop-blur-sm">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              disabled={sending}
              className="rounded-full px-1 py-0.5 text-sm transition-transform hover:scale-125 disabled:opacity-50"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
