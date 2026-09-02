"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Loader2 } from "lucide-react"
import { useMapStore, MESSAGE_LAYER_MIN_ZOOM } from "@/store/map-store"
import { useMessageStore } from "@/store/message-store"
import { MIN_HEX_ZOOM } from "@/lib/constants"

/**
 * Non-interactive contextual guidance layered over the map:
 *  - a top status pill (loading, or "zoom in" nudge for the bare world view),
 *  - a centered empty-state prompt when a readable spot has no notes yet.
 * Everything here is derived from store state; it never intercepts pointers.
 */
export function MapOverlays() {
  const zoom = useMapStore((s) => s.zoom)
  const isLoading = useMessageStore((s) => s.isLoading)
  const count = useMessageStore((s) => s.messages.size)

  let status: string | null = null
  let showSpinner = false
  if (isLoading && count === 0) {
    status = "Loading echoes…"
    showSpinner = true
  } else if (zoom < MIN_HEX_ZOOM) {
    status = "Zoom in to find echoes"
  }

  const showEmpty =
    !isLoading && zoom >= MESSAGE_LAYER_MIN_ZOOM && count === 0

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center"
        style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
      >
        <AnimatePresence mode="wait">
          {status && (
            <motion.div
              key={status}
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md"
            >
              {showSpinner && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              )}
              <span aria-live="polite">{status}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showEmpty && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-32 z-0 flex justify-center px-6"
          >
            <p className="max-w-xs text-center text-sm text-white/45">
              No echoes here yet. Frame this spot and be the first to leave one.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
