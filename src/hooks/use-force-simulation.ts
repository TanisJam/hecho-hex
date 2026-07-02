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
  // Published state is the small separation OFFSET from each node's target
  // anchor (dx, dy), not an absolute screen position. The absolute anchor is
  // recomputed synchronously on every render from the camera (see
  // message-layer.tsx's `positioned` memo), so render = anchor + offset never
  // paints a stale absolute coordinate from a lagging async tick.
  const [offsets, setOffsets] = useState<Map<string, { dx: number; dy: number }>>(
    new Map()
  )

  // Tracks the set of message IDs the current simulation was built from, so
  // the effect below (which runs on every `messages` array identity change —
  // message-layer.tsx produces a new array on every camera frame) can tell a
  // pure camera-move update (same IDs, new screen coords) apart from a real
  // structural change (messages added/removed). Only the latter should
  // rebuild the simulation; rebuilding on every camera frame would reset
  // alpha to 1 and cause a visible re-explosion of the layout on pan/zoom.
  const prevIdsKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (messages.length === 0) {
      simulationRef.current?.stop()
      simulationRef.current = null
      prevIdsKeyRef.current = null
      setOffsets(new Map())
      return
    }

    const idsKey = messages
      .map((m) => m.message.id)
      .sort()
      .join(",")
    const existingSim = simulationRef.current
    const isStructuralChange = idsKey !== prevIdsKeyRef.current

    if (existingSim && !isStructuralChange) {
      // Same ID set: this is a camera-move update, not a structural change.
      // Mutate the existing simulation's nodes in place instead of rebuilding
      // it, so accumulated velocity/spacing survives across frames.
      const nodesById = new Map(existingSim.nodes().map((n) => [n.id, n]))

      for (const m of messages.slice(0, 200)) {
        const node = nodesById.get(m.message.id)
        if (!node) continue

        // Shift the node's current position by the same delta the target
        // moved (i.e. the camera panned/zoomed) instead of leaving it to the
        // weak spring force to slowly re-converge. Collision/spacing offsets
        // already accumulated in (node.x - node.targetX) are preserved.
        // Pinned (dragged) nodes keep their fixed screen position untouched.
        const deltaX = m.screenX - node.targetX
        const deltaY = m.screenY - node.targetY

        if (node.fx == null) {
          node.x = node.x + deltaX
        }
        if (node.fy == null) {
          node.y = node.y + deltaY
        }

        node.targetX = m.screenX
        node.targetY = m.screenY
      }

      // Small reheat so collision forces re-settle without a visible
      // explosion — do NOT reset alpha to 1 on this path.
      existingSim.alpha(Math.max(existingSim.alpha(), 0.1)).restart()

      return
    }

    if (existingSim) {
      existingSim.stop()
    }

    const nodes: SimulationNode[] = messages.slice(0, 200).map((m) => {
      // Seed new/rebuilt nodes at anchor + existing offset (not raw anchor)
      // so a structural rebuild doesn't make settled bubbles jump back to
      // their unseparated position.
      const existingOffset = offsets.get(m.message.id)
      return {
        id: m.message.id,
        x: m.screenX + (existingOffset?.dx ?? 0),
        y: m.screenY + (existingOffset?.dy ?? 0),
        targetX: m.screenX,
        targetY: m.screenY,
        message: m.message,
      }
    })

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
        const next = new Map<string, { dx: number; dy: number }>()
        for (const node of nodes) {
          // Publish only the separation offset from the target anchor, not
          // the absolute position — the anchor is recomputed synchronously
          // from the camera every render, so we never paint a stale coord.
          next.set(node.id, { dx: node.x! - node.targetX, dy: node.y! - node.targetY })
        }
        setOffsets(next)
      })

    prevIdsKeyRef.current = idsKey
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

  return { offsets, pinNode, unpinNode }
}
