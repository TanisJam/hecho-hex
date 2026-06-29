"use client"

import { useMemo } from "react"
import { useMap } from "react-map-gl/mapbox"
import { AnimatePresence, motion } from "framer-motion"
import { useMapStore } from "@/store/map-store"
import { useMessageStore } from "@/store/message-store"
import { hexCenterToLngLat } from "@/lib/h3"
import { extractWordFrequencies } from "@/lib/word-cloud"

export function WordCloudLayer() {
  const { "echohex-map": mapInstance } = useMap()
  const zoom = useMapStore((s) => s.zoom)
  const visibleH3Indices = useMapStore((s) => s.visibleH3Indices)
  const messagesMap = useMessageStore((s) => s.messages)
  const messagesByHex = useMessageStore((s) => s.messagesByHex)

  const isActive = zoom < 12

  const clouds = useMemo(() => {
    if (!isActive || !mapInstance) return []

    const result: {
      h3Index: string
      words: { word: string; count: number }[]
      screenX: number
      screenY: number
    }[] = []

    for (const h3Index of visibleH3Indices) {
      const ids = messagesByHex.get(h3Index)
      if (!ids || ids.size === 0) continue
      const messages = Array.from(ids)
        .map((id) => messagesMap.get(id))
        .filter((m) => m != null)

      const words = extractWordFrequencies(messages, 5)
      if (words.length === 0) continue

      const center = hexCenterToLngLat(h3Index)
      const point = mapInstance.project(center)

      result.push({
        h3Index,
        words,
        screenX: point.x,
        screenY: point.y,
      })
    }

    return result
  }, [isActive, mapInstance, visibleH3Indices, messagesMap, messagesByHex])

  return (
    <div className="pointer-events-none absolute inset-0">
      <AnimatePresence>
        {isActive &&
          clouds.map((cloud) => (
            <motion.div
              key={cloud.h3Index}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute flex flex-wrap justify-center gap-1"
              style={{
                left: cloud.screenX,
                top: cloud.screenY,
                transform: "translate(-50%, -50%)",
              }}
            >
              {cloud.words.map(({ word, count }) => {
                const maxCount = cloud.words[0].count
                const scale = 0.7 + (count / maxCount) * 0.6
                return (
                  <span
                    key={word}
                    className="whitespace-nowrap font-mono text-white/70"
                    style={{
                      fontSize: `${scale * 14}px`,
                      textShadow:
                        "0 0 6px rgba(0, 255, 200, 0.3)",
                    }}
                  >
                    {word}
                  </span>
                )
              })}
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  )
}
