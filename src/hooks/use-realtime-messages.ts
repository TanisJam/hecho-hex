"use client"

import { useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useMapStore } from "@/store/map-store"
import { useMessageStore } from "@/store/message-store"
import type { Message } from "@/types"

export function useRealtimeMessages() {
  const visibleH3Indices = useMapStore((s) => s.visibleH3Indices)
  const { addMessage, removeMessage, updateMessage, fetchForHexes } =
    useMessageStore()
  const visibleHexSetRef = useRef(new Set<string>())
  const batchRef = useRef<Message[]>([])
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep visible hex set in sync
  useEffect(() => {
    visibleHexSetRef.current = new Set(visibleH3Indices)
  }, [visibleH3Indices])

  // Fetch messages when visible hexes change
  useEffect(() => {
    if (visibleH3Indices.length > 0) {
      fetchForHexes(visibleH3Indices)
    }
  }, [visibleH3Indices, fetchForHexes])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const msg = (payload.new ?? payload.old) as Message | undefined
          if (!msg) return

          // Only process if the message is in a visible hex
          if (!visibleHexSetRef.current.has(msg.h3_index)) return

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
            case "DELETE":
              if (payload.old && "id" in payload.old) {
                removeMessage(payload.old.id as string)
              }
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
