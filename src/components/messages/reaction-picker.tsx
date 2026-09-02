"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import { useReact } from "@/hooks/use-react"
import { pressTap } from "@/lib/motion"

// Label each emoji for screen readers / assistive tech.
const EMOJIS: { char: string; label: string }[] = [
  { char: "🔥", label: "Fire" },
  { char: "❤️", label: "Love" },
  { char: "💀", label: "Skull" },
  { char: "👀", label: "Eyes" },
  { char: "💯", label: "Hundred" },
  { char: "✨", label: "Sparkles" },
  { char: "😂", label: "Laughing" },
  { char: "👋", label: "Wave" },
]

interface ReactionPickerProps {
  messageId: string
  isOwn: boolean
}

export function ReactionPicker({ messageId, isOwn }: ReactionPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const react = useReact()

  // Esc closes the emoji row (parity with the composer's keyboard handling).
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isOpen])

  // Picking an emoji adds it and closes the row. To add more of the same, tap
  // the reaction pill under the note (see DraggableMessage) — those stack.
  const handleReact = (emoji: string) => {
    react(messageId, emoji)
    setIsOpen(false)
  }

  if (isOwn) return null

  return (
    <div className="relative mt-1">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Add a reaction"
          className="inline-flex size-11 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white/70 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      ) : (
        <div
          role="group"
          aria-label="Pick a reaction"
          className="absolute top-full left-1/2 z-10 mt-1 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap justify-center gap-0.5 rounded-2xl border border-white/10 bg-black/70 p-1 backdrop-blur-md"
        >
          {EMOJIS.map(({ char, label }) => (
            <motion.button
              key={char}
              type="button"
              onClick={() => handleReact(char)}
              aria-label={label}
              {...pressTap}
              className="inline-flex size-11 items-center justify-center rounded-full text-lg transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none"
            >
              {char}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}
