"use client"

import { motion } from "framer-motion"
import type { Message } from "@/types"
import { computeOpacity } from "@/lib/fade"
import { ReactionPicker } from "./reaction-picker"

interface DraggableMessageProps {
  message: Message
  screenX: number
  screenY: number
  isOwn: boolean
  onDragStart?: (id: string, x: number, y: number) => void
  onDragEnd?: (id: string) => void
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
        x: "-50%",
        y: "-50%",
      }}
      drag={isOwn}
      dragMomentum={false}
      onDragStart={() => onDragStart?.(message.id, screenX, screenY)}
      onDragEnd={() => onDragEnd?.(message.id)}
      whileDrag={{ scale: 1.05, cursor: "grabbing" }}
    >
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
    </motion.div>
  )
}
