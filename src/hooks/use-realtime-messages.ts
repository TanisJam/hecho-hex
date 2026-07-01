"use client"

import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useMapStore } from "@/store/map-store"
import { useMessageStore } from "@/store/message-store"
import { getResolutionForZoom, cellAtResolution, H3_RESOLUTION } from "@/lib/h3"
import type { Message } from "@/types"

export function useRealtimeMessages() {
  const visibleH3Indices = useMapStore((s) => s.visibleH3Indices)
  const zoom = useMapStore((s) => s.zoom)
  const { addMessage, removeMessage, updateMessage, fetchForHexes } =
    useMessageStore()
  const visibleHexSetRef = useRef(new Set<string>())
  const resolutionRef = useRef(H3_RESOLUTION)
  const batchRef = useRef<Message[]>([])
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resolution = getResolutionForZoom(zoom)

  // Keep visible hex set and display resolution in sync
  useEffect(() => {
    visibleHexSetRef.current = new Set(visibleH3Indices)
  }, [visibleH3Indices])

  useEffect(() => {
    resolutionRef.current = resolution
  }, [resolution])

  // Fetch messages when visible hexes (or the display resolution) change
  useEffect(() => {
    if (visibleH3Indices.length > 0) {
      fetchForHexes(visibleH3Indices, resolution)
    }
  }, [visibleH3Indices, resolution, fetchForHexes])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          // Supabase DELETE events only carry the primary key in
          // payload.old (no REPLICA IDENTITY FULL configured), so
          // payload.old.h3_index is never present. Handle DELETE first and
          // unconditionally — removing an already-absent id is a safe
          // no-op, so there's no need for a visibility filter check here.
          if (payload.eventType === "DELETE") {
            if (payload.old && "id" in payload.old) {
              removeMessage(payload.old.id as string)
            }
            return
          }

          const msg = payload.new as Message | undefined
          if (!msg) return

          // Messages always carry a resolution-9 h3_index; below zoom 14
          // the visible set holds coarser parent cells, so compare against
          // the message's parent at the current display resolution.
          const msgDisplayHex = cellAtResolution(
            msg.h3_index,
            resolutionRef.current
          )

          // Only process if the message is in a visible hex
          if (!visibleHexSetRef.current.has(msgDisplayHex)) return

          switch (payload.eventType) {
            case "INSERT":
              // Batch inserts for performance
              batchRef.current.push(msg)
              if (!batchTimerRef.current) {
                batchTimerRef.current = setTimeout(() => {
                  const batch = batchRef.current
                  batchRef.current = []
                  batchTimerRef.current = null
                  for (const m of batch) addMessage(m)
                }, 100)
              }
              break
            case "UPDATE":
              updateMessage(msg)
              break
          }
        }
      )
      .subscribe()

    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current)
      supabase.removeChannel(channel)
    }
  }, [addMessage, removeMessage, updateMessage])
}
