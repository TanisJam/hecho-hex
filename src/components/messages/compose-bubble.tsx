"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useMapStore } from "@/store/map-store"
import { useMessageStore } from "@/store/message-store"
import { createMessage } from "@/lib/messages"
import { toast } from "sonner"

const MAX_CHARS = 200

export function ComposeBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)

  const userH3Index = useMapStore((s) => s.userH3Index)
  const userLocation = useMapStore((s) => s.userLocation)
  const tempUserId = useMapStore((s) => s.tempUserId)
  const addMessage = useMessageStore((s) => s.addMessage)

  if (!userH3Index || !userLocation) return null

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    setSending(true)
    try {
      const msg = await createMessage(trimmed, userH3Index, tempUserId, userLocation)
      addMessage(msg)
      setText("")
      setIsOpen(false)
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
      setIsOpen(false)
    }
  }

  return (
    <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="compose"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="flex w-[320px] flex-col gap-2 rounded-xl bg-black/80 p-3 backdrop-blur-md"
          >
            <textarea
              value={text}
              onChange={(e) =>
                setText(e.target.value.slice(0, MAX_CHARS))
              }
              onKeyDown={handleKeyDown}
              placeholder="Write on the wall..."
              autoFocus
              rows={3}
              className="resize-none rounded-lg bg-white/5 p-2 font-mono text-sm text-white placeholder-white/30 outline-none"
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-xs ${
                  text.length >= MAX_CHARS
                    ? "text-red-400"
                    : "text-white/30"
                }`}
              >
                {text.length}/{MAX_CHARS}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg px-3 py-1 text-xs text-white/40 hover:text-white/60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim() || sending}
                  className="rounded-lg bg-emerald-500/80 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-30"
                >
                  {sending ? "..." : "Post"}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="trigger"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="rounded-full bg-emerald-500/80 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-500"
          >
            Write here
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
