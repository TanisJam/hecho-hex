import { create } from "zustand"
import type { Message } from "@/types"
import { fetchMessagesByHexes } from "@/lib/messages"
import { isMessageExpired } from "@/lib/fade"

interface MessageState {
  messages: Map<string, Message>
  messagesByHex: Map<string, Set<string>>
  isLoading: boolean

  fetchForHexes: (h3Indices: string[]) => Promise<void>
  addMessage: (msg: Message) => void
  removeMessage: (id: string) => void
  updateMessage: (msg: Message) => void
  getMessagesInHex: (h3Index: string) => Message[]
  getVisibleMessages: () => Message[]
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: new Map(),
  messagesByHex: new Map(),
  isLoading: false,

  fetchForHexes: async (h3Indices) => {
    set({ isLoading: true })
    try {
      const fetched = await fetchMessagesByHexes(h3Indices)
      const messages = new Map<string, Message>()
      const messagesByHex = new Map<string, Set<string>>()

      for (const msg of fetched) {
        if (isMessageExpired(msg)) continue
        messages.set(msg.id, msg)
        const hexSet = messagesByHex.get(msg.h3_index) ?? new Set()
        hexSet.add(msg.id)
        messagesByHex.set(msg.h3_index, hexSet)
      }

      set({ messages, messagesByHex, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  addMessage: (msg) => {
    if (isMessageExpired(msg)) return
    set((state) => {
      const messages = new Map(state.messages)
      messages.set(msg.id, msg)
      const messagesByHex = new Map(state.messagesByHex)
      const hexSet = new Set(messagesByHex.get(msg.h3_index) ?? [])
      hexSet.add(msg.id)
      messagesByHex.set(msg.h3_index, hexSet)
      return { messages, messagesByHex }
    })
  },

  removeMessage: (id) => {
    set((state) => {
      const msg = state.messages.get(id)
      if (!msg) return state
      const messages = new Map(state.messages)
      messages.delete(id)
      const messagesByHex = new Map(state.messagesByHex)
      const hexSet = new Set(messagesByHex.get(msg.h3_index) ?? [])
      hexSet.delete(id)
      if (hexSet.size === 0) messagesByHex.delete(msg.h3_index)
      else messagesByHex.set(msg.h3_index, hexSet)
      return { messages, messagesByHex }
    })
  },

  updateMessage: (msg) => {
    set((state) => {
      const messages = new Map(state.messages)
      messages.set(msg.id, msg)
      return { messages }
    })
  },

  getMessagesInHex: (h3Index) => {
    const { messages, messagesByHex } = get()
    const ids = messagesByHex.get(h3Index)
    if (!ids) return []
    return Array.from(ids)
      .map((id) => messages.get(id))
      .filter((m): m is Message => m != null && !isMessageExpired(m))
  },

  getVisibleMessages: () => {
    const { messages } = get()
    return Array.from(messages.values()).filter((m) => !isMessageExpired(m))
  },
}))
