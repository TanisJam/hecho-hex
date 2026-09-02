"use client"

import { useState } from "react"
import { motion, useMotionValue } from "framer-motion"
import type { Message } from "@/types"
import { computeOpacity } from "@/lib/fade"
import { FADE_HIDDEN_THRESHOLD } from "@/lib/constants"
import { bubbleInOut, pressTap } from "@/lib/motion"
import { useReact } from "@/hooks/use-react"
import { ReactionPicker } from "./reaction-picker"

// Ids whose entrance has already played this session. Viewport culling remounts
// the component when a bubble scrolls back into view — that must NOT replay the
// intro; only a genuinely new note animates in.
const introPlayed = new Set<string>()

interface DraggableMessageProps {
  message: Message
  screenX: number
  screenY: number
  isOwn: boolean
  onDragStart?: (id: string, x: number, y: number) => void
  // dragDeltaX/dragDeltaY are the total screen-pixel displacement accumulated
  // during the drag gesture (framer motion value deltas), NOT an absolute
  // position. The parent is responsible for combining this delta with the
  // bubble's current anchor to compute a new world position.
  onDragEnd?: (id: string, dragDeltaX: number, dragDeltaY: number) => void
}

export function DraggableMessage({
  message,
  screenX,
  screenY,
  isOwn,
  onDragStart,
  onDragEnd,
}: DraggableMessageProps) {
  // Lifetime fade (hours-scale). Applied to an inner wrapper so it never fights
  // the outer enter/exit animation, which owns the outer element's opacity.
  const opacity = computeOpacity(message)
  const react = useReact()

  // Clean numeric drag deltas starting at 0 on every drag gesture. These are
  // framer's own transform channel (motion.div's x/y), kept separate from the
  // CSS centering transform below so the two never fight over the same
  // transform property.
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  // Play the intro only the first time this note is ever mounted this session.
  const [isNew] = useState(() => {
    if (introPlayed.has(message.id)) return false
    introPlayed.add(message.id)
    return true
  })

  if (opacity <= FADE_HIDDEN_THRESHOLD) return null

  const totalReactions = Object.values(message.reactions).reduce(
    (a, b) => a + b,
    0
  )

  return (
    <motion.div
      className="pointer-events-auto absolute max-w-[200px] cursor-default select-none"
      style={{
        left: screenX,
        top: screenY,
        x,
        y,
        // Own notes are draggable, so claim the gesture (touchAction: none).
        // Other notes must let the touch fall through to the map so you can
        // still pan even when your finger starts on a bubble.
        touchAction: isOwn ? "none" : "pan-x pan-y",
      }}
      variants={bubbleInOut}
      initial={isNew ? "initial" : false}
      animate="animate"
      exit="exit"
      drag={isOwn}
      dragMomentum={false}
      onDragStart={() => onDragStart?.(message.id, screenX, screenY)}
      onDragEnd={() => {
        // Fire the parent's re-anchor first (it commits a new screenX/screenY
        // derived from world coordinates), then zero out the local drag
        // transform in the same handler so both settle together without an
        // intermediate frame showing the old screen position plus a leftover
        // transform.
        onDragEnd?.(message.id, x.get(), y.get())
        x.set(0)
        y.set(0)
      }}
      whileDrag={{ scale: 1.05, cursor: "grabbing" }}
    >
      <div className="-translate-x-1/2 -translate-y-1/2" style={{ opacity }}>
        <p className="text-glow font-mono text-sm leading-tight text-white">
          {message.content}
        </p>

        {totalReactions > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(message.reactions).map(([emoji, count]) =>
              // Others' notes: each pill is a tap-to-add button (stack by
              // spamming it). Own notes: display only (you can't react to your
              // own). The count remounts on change to replay the pop.
              isOwn ? (
                <span
                  key={emoji}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs"
                >
                  <span>{emoji}</span>
                  <motion.span
                    key={count}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    className="tabular-nums"
                  >
                    {count}
                  </motion.span>
                </span>
              ) : (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => react(message.id, emoji)}
                  aria-label={`Add ${emoji} reaction, currently ${count}`}
                  {...pressTap}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:outline-none"
                >
                  <span aria-hidden>{emoji}</span>
                  <motion.span
                    key={count}
                    initial={{ scale: 0.6 }}
                    animate={{ scale: 1 }}
                    className="tabular-nums"
                  >
                    {count}
                  </motion.span>
                </motion.button>
              )
            )}
          </div>
        )}

        <ReactionPicker messageId={message.id} isOwn={isOwn} />
      </div>
    </motion.div>
  )
}
