import { cellToParent } from "h3-js"
import { supabase } from "./supabase"
import type { Message, GeoPosition } from "@/types"
import {
  isUserInHex,
  H3_RESOLUTION,
  H3_RESOLUTION_MID,
  H3_RESOLUTION_LOW,
} from "./h3"

export async function createMessage(
  content: string,
  h3Index: string,
  tempUserId: string,
  userLocation: GeoPosition
): Promise<Message> {
  if (!isUserInHex(userLocation, h3Index)) {
    throw new Error("You can only post in your current hexagon")
  }

  if (content.length > 200) {
    throw new Error("Message must be 200 characters or less")
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      h3_index: h3Index,
      // Precomputed parent cells so viewport queries at lower zoom levels
      // (coarser display resolutions) can match on the resolution actually
      // rendered instead of comparing h3_index strings across resolutions.
      h3_res7: cellToParent(h3Index, H3_RESOLUTION_LOW),
      h3_res8: cellToParent(h3Index, H3_RESOLUTION_MID),
      content: content.trim(),
      pos_relative: {
        x: 0.1 + Math.random() * 0.8,
        y: 0.1 + Math.random() * 0.8,
      },
      temp_user_id: tempUserId,
    })
    .select()
    .single()

  if (error) throw error
  return data as Message
}

export async function fetchMessagesByHexes(
  h3Indices: string[],
  resolution: number = H3_RESOLUTION
): Promise<Message[]> {
  if (h3Indices.length === 0) return []

  // Calls the messages_in_hexes RPC (POST) instead of building a
  // supabase-js `.in(column, h3Indices)` filter (GET). At zoom 8-10 the
  // hex list can be large enough that a GET querystring exceeds the
  // self-hosted proxy's header-buffer limit (see
  // supabase/migrations/20260701000001_add_messages_in_hexes_rpc.sql).
  // The 48h cutoff, ordering, and row limit now live in that function.
  const { data, error } = await supabase.rpc("messages_in_hexes", {
    hexes: h3Indices,
    res: resolution,
  })

  if (error) throw error
  return (data ?? []) as Message[]
}

export async function addReaction(
  messageId: string,
  emoji: string
): Promise<void> {
  const { error } = await supabase.rpc("increment_reaction", {
    msg_id: messageId,
    emoji,
  })
  if (error) throw error
}
