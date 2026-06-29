export type H3Index = string

export interface GeoPosition {
  lat: number
  lng: number
}

export interface Message {
  id: string
  h3_index: H3Index
  content: string
  pos_relative: { x: number; y: number }
  reactions: Record<string, number>
  created_at: string
  temp_user_id: string
}

export interface SimulationNode {
  id: string
  x: number
  y: number
  targetX: number
  targetY: number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
  message: Message
}
