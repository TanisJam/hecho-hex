"use client"

import { useEffect, useRef, useState } from "react"
import {
  forceSimulation,
  forceCollide,
  forceManyBody,
  forceX,
  forceY,
  type ForceX,
  type ForceY,
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
  // Current camera zoom. Offsets (dx, dy) are screen-pixel quantities and
  // therefore zoom-invariant on their own — the same pixel offset represents
  // a much larger geographic distance when zoomed out. Passing zoom lets the
  // camera-update path rescale offsets so bubbles stay visually anchored to
  // their hex across zoom levels (see shiftAndScaleOffset below).
  zoom: number
}

/**
 * Shift a single-axis simulation coordinate (node.x or node.y) to follow a
 * moved target anchor, then rescale the resulting offset around the new
 * target by `k`. Pure and d3-independent so it can be unit tested directly.
 *
 * - Shift: the target moved from `targetOld` to `targetNew` (camera pan), so
 *   `value` is translated by the same delta.
 * - Scale: the separation offset from the target is then scaled by `k`
 *   (typically `2^(zoom - prevZoom)`) so a fixed pixel offset represents a
 *   consistent geographic distance across zoom levels. `k === 1` is a no-op
 *   for this step.
 */
export function shiftAndScaleOffset(
  value: number,
  targetOld: number,
  targetNew: number,
  k: number
): number {
  const shifted = value + (targetNew - targetOld)
  return targetNew + (shifted - targetNew) * k
}

export function useForceSimulation({ messages, zoom }: UseForceSimulationOptions) {
  const simulationRef = useRef<Simulation<SimulationNode, undefined> | null>(
    null
  )
  // Zoom the camera-update path last applied offset scaling for. Compared
  // against the incoming `zoom` on each camera-move update to compute the
  // rescale factor `k`.
  const prevZoomRef = useRef<number | null>(null)
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
      prevZoomRef.current = null
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

      // Rescale factor for this camera update: 2x zoom-in halves the
      // geographic distance a fixed pixel offset represents, so offsets must
      // grow by 2x on zoom-in (and shrink on zoom-out) to stay visually
      // anchored to the same point on the ground. k === 1 (no zoom change,
      // or no prior zoom recorded yet) leaves offsets untouched.
      const prevZoom = prevZoomRef.current
      const k = prevZoom != null ? Math.pow(2, zoom - prevZoom) : 1

      for (const m of messages.slice(0, 200)) {
        const node = nodesById.get(m.message.id)
        if (!node) continue

        // Shift the node's current position by the same delta the target
        // moved (i.e. the camera panned/zoomed), then rescale the resulting
        // offset around the new target by `k` so it stays proportional to
        // the current zoom level. Collision/spacing offsets already
        // accumulated in (node.x - node.targetX) are preserved (modulo the
        // rescale). Pinned (dragged) nodes keep their fixed screen position
        // untouched.
        if (node.fx == null) {
          node.x = shiftAndScaleOffset(node.x, node.targetX, m.screenX, k)
        }
        if (node.fy == null) {
          node.y = shiftAndScaleOffset(node.y, node.targetY, m.screenY, k)
        }

        node.targetX = m.screenX
        node.targetY = m.screenY
      }

      prevZoomRef.current = zoom

      // d3's forceX/forceY cache their per-node targets when the accessor is
      // assigned — mutating node.targetX/Y alone leaves the forces pulling
      // toward the screen coordinates from when the simulation was built.
      // Re-assign the accessors so the cached targets are recomputed.
      existingSim
        .force<ForceX<SimulationNode>>("x")
        ?.x((d) => d.targetX)
      existingSim
        .force<ForceY<SimulationNode>>("y")
        ?.y((d) => d.targetY)

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
      .force(
        "charge",
        forceManyBody<SimulationNode>().strength(-30).distanceMax(150)
      )
      .force(
        "x",
        forceX<SimulationNode>((d) => d.targetX).strength(0.1)
      )
      .force(
        "y",
        forceY<SimulationNode>((d) => d.targetY).strength(0.1)
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
    prevZoomRef.current = zoom
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
