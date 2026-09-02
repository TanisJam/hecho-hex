"use client"

import { useMemo } from "react"
import { useMap } from "react-map-gl/mapbox"
import { AnimatePresence, motion } from "framer-motion"
import { useMapStore } from "@/store/map-store"
import { useMessageStore } from "@/store/message-store"
import { hexCenterToLngLat, getResolutionForZoom, cellAtResolution } from "@/lib/h3"
import { extractWordFrequencies } from "@/lib/word-cloud"
import { wordCloudActive, wordCloudOpacity } from "@/lib/zoom-transition"
import type { Message } from "@/types"

export function WordCloudLayer() {
  const { "echohex-map": mapInstance } = useMap()
  const zoom = useMapStore((s) => s.zoom)
  const viewportVersion = useMapStore((s) => s.viewportVersion)
  const visibleH3Indices = useMapStore((s) => s.visibleH3Indices)
  const messagesMap = useMessageStore((s) => s.messages)

  // Live zoom (recomputed each viewportVersion) drives the crossfade so the
  // cloud fades out smoothly as bubbles fade in, instead of hard-swapping.
  const liveZoom = mapInstance ? mapInstance.getZoom() : zoom
  const isActive = wordCloudActive(liveZoom)
  const layerOpacity = wordCloudOpacity(liveZoom)
  const displayResolution = getResolutionForZoom(zoom)

  // Expensive: group messages per visible hex and extract word frequencies.
  // Messages always carry a resolution-9 h3_index, but below zoom 14 the
  // visible hexes are coarser parent cells — group by the message's parent
  // at the display resolution instead of its raw h3_index.
  const wordClouds = useMemo(() => {
    if (!isActive) return []

    const visibleSet = new Set(visibleH3Indices)
    const grouped = new Map<string, Message[]>()

    for (const msg of messagesMap.values()) {
      const parentHex = cellAtResolution(msg.h3_index, displayResolution)
      if (!visibleSet.has(parentHex)) continue

      const bucket = grouped.get(parentHex) ?? []
      bucket.push(msg)
      grouped.set(parentHex, bucket)
    }

    const result: {
      h3Index: string
      words: { word: string; count: number }[]
    }[] = []

    for (const [h3Index, msgs] of grouped) {
      const words = extractWordFrequencies(msgs, 5)
      if (words.length === 0) continue
      result.push({ h3Index, words })
    }

    return result
  }, [isActive, visibleH3Indices, messagesMap, displayResolution])

  // Cheap: project hex centers to screen space. Depends on viewportVersion
  // (bumped on every camera move) so clouds reproject every frame instead of
  // only when the debounced visible-hex set changes.
  const clouds = useMemo(() => {
    if (!isActive || !mapInstance) return []

    return wordClouds.map((cloud) => {
      const center = hexCenterToLngLat(cloud.h3Index)
      const point = mapInstance.project(center)
      return {
        ...cloud,
        screenX: point.x,
        screenY: point.y,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, mapInstance, wordClouds, viewportVersion])

  return (
    <div
      className="pointer-events-none absolute inset-0 transition-opacity duration-150"
      style={{ opacity: layerOpacity }}
    >
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
                    className="text-glow-sm whitespace-nowrap font-mono text-white/70"
                    style={{ fontSize: `${scale * 14}px` }}
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
