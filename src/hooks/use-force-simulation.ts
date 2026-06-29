"use client"

import { useEffect, useRef, useState } from "react"
import {
  forceSimulation,
  forceCollide,
  forceManyBody,
  forceX,
  forceY,
  type Simulation,
} from "d3-force"
import type { SimulationNode, Message } from "@/types"

interface PositionedMessage {
  id: string
  x: number
  y: number
  message: Message
}

interface UseForceSimulationOptions {
  messages: { message: Message; screenX: number; screenY: number }[]
}

export function useForceSimulation({ messages }: UseForceSimulationOptions) {
  const simulationRef = useRef<Simulation<SimulationNode, undefined> | null>(
    null
  )
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
    new Map()
  )

  useEffect(() => {
    if (messages.length === 0) {
      simulationRef.current?.stop()
      simulationRef.current = null
      setPositions(new Map())
      return
    }

    const nodes: SimulationNode[] = messages.slice(0, 200).map((m) => {
      const existing = positions.get(m.message.id)
      return {
        id: m.message.id,
        x: existing?.x ?? m.screenX,
        y: existing?.y ?? m.screenY,
        targetX: m.screenX,
        targetY: m.screenY,
        message: m.message,
      }
    })

    if (simulationRef.current) {
      simulationRef.current.stop()
    }

    const sim = forceSimulation<SimulationNode>(nodes)
      .force(
        "collide",
        forceCollide<SimulationNode>((d) =>
          Math.max(20, Math.min(d.message.content.length * 0.8, 60))
        ).strength(0.8)
      )
      .force("charge", forceManyBody<SimulationNode>().strength(-30))
      .force(
        "x",
        forceX<SimulationNode>((d) => d.targetX).strength(0.05)
      )
      .force(
        "y",
        forceY<SimulationNode>((d) => d.targetY).strength(0.05)
      )
      .alphaDecay(0.05)
      .on("tick", () => {
        const next = new Map<string, { x: number; y: number }>()
        for (const node of nodes) {
          next.set(node.id, { x: node.x!, y: node.y! })
        }
        setPositions(next)
      })

    simulationRef.current = sim

    return () => {
      sim.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  const pinNode = (id: string, x: number, y: number) => {
    const sim = simulationRef.current
    if (!sim) return
    const node = sim.nodes().find((n) => n.id === id)
    if (node) {
      node.fx = x
      node.fy = y
      sim.alpha(0.3).restart()
    }
  }

  const unpinNode = (id: string) => {
    const sim = simulationRef.current
    if (!sim) return
    const node = sim.nodes().find((n) => n.id === id)
    if (node) {
      node.fx = null
      node.fy = null
      sim.alpha(0.3).restart()
    }
  }

  return { positions, pinNode, unpinNode }
}
