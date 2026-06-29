"use client"

import type { Message } from "@/types"
import { computeOpacity } from "@/lib/fade"
import { ReactionPicker } from "./reaction-picker"

interface FloatingMessageProps {
  message: Message
  screenX: number
  screenY: number
  isOwn: boolean
}

export function FloatingMessage({
  message,
  screenX,
  screenY,
  isOwn,
}: FloatingMessageProps) {
  const opacity = computeOpacity(message)

  if (opacity <= 0.02) return null

  const totalReactions = Object.values(message.reactions).reduce(
    (a, b) => a + b,
    0
  )

  return (
    <div
      className="pointer-events-auto absolute max-w-[200px] cursor-default select-none"
      style={{
        left: screenX,
        top: screenY,
        opacity,
        transform: "translate(-50%, -50%)",
      }}
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
    </div>
  )
}
