import { create } from "zustand"
import type { Message } from "@/types"
import { fetchMessagesByHexes } from "@/lib/messages"
import { isMessageExpired } from "@/lib/fade"

interface MessageState {
  messages: Map<string, Message>
  isLoading: boolean
  // Local-session-only UI overrides for messages the current user has
  // dragged. There is no Supabase UPDATE policy for anon users, so these are
  // never persisted server-side — they only re-anchor the bubble on screen
  // for the lifetime of this session/tab.
  positionOverrides: Map<string, { lng: number; lat: number }>

  fetchForHexes: (h3Indices: string[], resolution?: number) => Promise<void>
  addMessage: (msg: Message) => void
  removeMessage: (id: string) => void
  updateMessage: (msg: Message) => void
  getVisibleMessages: () => Message[]
  setPositionOverride: (id: string, lngLat: { lng: number; lat: number }) => void
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: new Map(),
  isLoading: false,
  positionOverrides: new Map(),

  fetchForHexes: async (h3Indices, resolution) => {
    set({ isLoading: true })
    try {
      const fetched = await fetchMessagesByHexes(h3Indices, resolution)
      const messages = new Map<string, Message>()

      for (const msg of fetched) {
        if (isMessageExpired(msg)) continue
        messages.set(msg.id, msg)
      }

      set({ messages, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  addMessage: (msg) => {
    if (isMessageExpired(msg)) return
    set((state) => {
      const messages = new Map(state.messages)
      messages.set(msg.id, msg)
      return { messages }
    })
  },

  removeMessage: (id) => {
    set((state) => {
      const msg = state.messages.get(id)
      if (!msg) return state
      const messages = new Map(state.messages)
      messages.delete(id)
      return { messages }
    })
  },

  updateMessage: (msg) => {
    set((state) => {
      const messages = new Map(state.messages)
      messages.set(msg.id, msg)
      return { messages }
    })
  },

  getVisibleMessages: () => {
    const { messages } = get()
    return Array.from(messages.values()).filter((m) => !isMessageExpired(m))
  },

  setPositionOverride: (id, lngLat) => {
    set((state) => {
      const positionOverrides = new Map(state.positionOverrides)
      positionOverrides.set(id, lngLat)
      return { positionOverrides }
    })
  },
}))
