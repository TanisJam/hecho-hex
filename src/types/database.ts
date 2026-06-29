export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string
          h3_index: string
          content: string
          pos_relative: { x: number; y: number }
          reactions: Record<string, number>
          created_at: string
          temp_user_id: string
        }
        Insert: {
          id?: string
          h3_index: string
          content: string
          pos_relative?: { x: number; y: number }
          reactions?: Record<string, number>
          created_at?: string
          temp_user_id: string
        }
        Update: {
          id?: string
          h3_index?: string
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
