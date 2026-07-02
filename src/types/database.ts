export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string
          h3_index: string
          // Parent cells at display resolutions 7/8 (see src/lib/h3.ts).
          // Nullable: rows written before this column existed have no
          // parent and simply won't match viewport queries below zoom 14.
          h3_res7: string | null
          h3_res8: string | null
          content: string
          pos_relative: { x: number; y: number }
          reactions: Record<string, number>
          created_at: string
          temp_user_id: string
        }
        Insert: {
          id?: string
          h3_index: string
          h3_res7?: string | null
          h3_res8?: string | null
          content: string
          pos_relative?: { x: number; y: number }
          reactions?: Record<string, number>
          created_at?: string
          temp_user_id: string
        }
        Update: {
          id?: string
          h3_index?: string
          h3_res7?: string | null
          h3_res8?: string | null
          content?: string
          pos_relative?: { x: number; y: number }
          reactions?: Record<string, number>
          created_at?: string
          temp_user_id?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_reaction: {
        Args: { msg_id: string; emoji: string }
        Returns: undefined
      }
      // Backs fetchMessagesByHexes (src/lib/messages.ts). Called via
      // supabase.rpc(...) (POST) instead of `.in(column, h3Indices)` (GET)
      // so large viewport hex lists never end up in a URL querystring —
      // see supabase/migrations/20260701000001_add_messages_in_hexes_rpc.sql.
      messages_in_hexes: {
        Args: { hexes: string[]; res: number }
        Returns: Database["public"]["Tables"]["messages"]["Row"][]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
