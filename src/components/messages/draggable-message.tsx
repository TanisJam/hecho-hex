"use client"

import { motion, useMotionValue } from "framer-motion"
import type { Message } from "@/types"
import { computeOpacity } from "@/lib/fade"
import { ReactionPicker } from "./reaction-picker"

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
  const opacity = computeOpacity(message)

  // Clean numeric drag deltas starting at 0 on every drag gesture. These are
  // framer's own transform channel (motion.div's x/y), kept separate from the
  // CSS centering transform below so the two never fight over the same
  // transform property.
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  if (opacity <= 0.02) return null

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
        opacity,
        x,
        y,
      }}
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
      <div className="-translate-x-1/2 -translate-y-1/2">
        <p
          className="font-mono text-sm leading-tight text-white"
          style={{
            textShadow:
              "0 0 8px rgba(0, 255, 200, 0.5), 0 0 16px rgba(0, 255, 200, 0.2)",
          }}
        >
          {message.content}
        </p>

        {totalReactions > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(message.reactions).map(([emoji, count]) => (
              <span
                key={emoji}
                className="rounded-full bg-white/10 px-1.5 py-0.5 text-xs"
              >
                {emoji} {count}
              </span>
            ))}
          </div>
        )}

        <ReactionPicker messageId={message.id} isOwn={isOwn} />
      </div>
    </motion.div>
  )
}
