"use client"

import { useId, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useMap } from "react-map-gl/mapbox"
import { useMapStore } from "@/store/map-store"
import { useMessageStore } from "@/store/message-store"
import { createMessage } from "@/lib/messages"
import { locationToH3, posRelativeForPoint } from "@/lib/h3"
import { MAX_MESSAGE_CHARS } from "@/lib/constants"
import { toast } from "sonner"

const TRIGGER_ID = "compose-trigger"

export function ComposeBubble() {
  const { "echohex-map": mapInstance } = useMap()
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const counterId = useId()

  const tempUserId = useMapStore((s) => s.tempUserId)
  const bumpDropPing = useMapStore((s) => s.bumpDropPing)
  const addMessage = useMessageStore((s) => s.addMessage)

  // Return keyboard focus to the trigger when the composer closes, so tab order
  // doesn't jump to the top of the document after posting/cancelling.
  const close = () => {
    setIsOpen(false)
    requestAnimationFrame(() => document.getElementById(TRIGGER_ID)?.focus())
  }

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending || !mapInstance) return

    setSending(true)
    try {
      // Drop the note where the center crosshair points: the hex under the
      // current viewport center, placed at that exact point within the hex.
      const center = mapInstance.getCenter()
      const h3Index = locationToH3({ lat: center.lat, lng: center.lng })
      const posRelative = posRelativeForPoint(h3Index, center.lng, center.lat)

      const msg = await createMessage(trimmed, h3Index, tempUserId, posRelative)
      addMessage(msg)
      // Spatial confirmation: pulse a ring at the crosshair where it landed.
      bumpDropPing()
      setText("")
      close()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to post message"
      )
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      close()
    }
  }

  const atLimit = text.length >= MAX_MESSAGE_CHARS

  return (
    <div
      className="absolute left-1/2 z-10 -translate-x-1/2"
      style={{ bottom: "max(1.5rem, calc(env(safe-area-inset-bottom) + 0.75rem))" }}
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key="compose"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="flex w-[min(320px,calc(100vw-2rem))] flex-col gap-2 rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur-md"
          >
            <label htmlFor="compose-text" className="sr-only">
              Write a note to drop at this spot
            </label>
            <textarea
              id="compose-text"
              value={text}
              onChange={(e) =>
                setText(e.target.value.slice(0, MAX_MESSAGE_CHARS))
              }
              onKeyDown={handleKeyDown}
              placeholder="Write on the wall..."
              autoFocus
              rows={3}
              aria-describedby={counterId}
              className="resize-none rounded-lg bg-white/5 p-2 font-mono text-sm text-white placeholder-white/30 outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            />
            <div className="flex items-center justify-between">
              <span
                id={counterId}
                aria-live="polite"
                className={`text-xs tabular-nums ${
                  atLimit ? "text-red-400" : "text-white/30"
                }`}
              >
                {text.length}/{MAX_MESSAGE_CHARS}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-white/50 transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!text.trim() || sending}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-black transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none disabled:opacity-30"
                >
                  {sending ? "Posting…" : "Post"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="trigger"
            id={TRIGGER_ID}
            type="button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsOpen(true)}
            aria-label="Write a note to drop at this spot"
            className="inline-flex min-h-11 items-center rounded-full bg-brand px-6 text-sm font-semibold text-black shadow-lg shadow-brand/20 transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none"
          >
            Write here
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
