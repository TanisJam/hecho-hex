"use client"

import { useState } from "react"
import { MapPin, ZoomIn, PenLine } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const ONBOARDED_KEY = "echohex_onboarded"

const STEPS = [
  {
    icon: MapPin,
    title: "Leave an echo",
    body: "Drop an anonymous note onto the exact spot you're looking at. It fades over a day unless people react to it.",
  },
  {
    icon: ZoomIn,
    title: "Zoom to explore",
    body: "Zoom in to read individual notes. Zoom out and nearby notes collapse into word clouds of what a place is saying.",
  },
  {
    icon: PenLine,
    title: "Aim, then write",
    body: "The center crosshair is where your note lands. Frame a place, tap Write here, and post.",
  },
] as const

/**
 * First-run intro. Shown once per browser (localStorage-gated) so a new visitor
 * lands with the map's zoom metaphor explained instead of on a bare world view.
 * Built on the accessible radix Dialog (focus trap + Esc + labelled title).
 */
export function Onboarding() {
  // Client-only tree (parent map is dynamic ssr:false), so reading storage in
  // the lazy initializer is safe and avoids a setState-in-effect flash.
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDED_KEY)
    } catch {
      // Private mode / storage blocked — skip onboarding rather than break.
      return false
    }
  })

  const dismiss = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "1")
    } catch {
      // Ignore: worst case they see the intro again next visit.
    }
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="border-white/10 bg-black/85 backdrop-blur-md"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Welcome to <span className="text-brand text-glow">EchoHex</span>
          </DialogTitle>
          <DialogDescription>
            Anonymous, ephemeral notes pinned to real places.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-4 py-2">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-white">{title}</p>
                <p className="text-sm text-white/55">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button
            onClick={dismiss}
            className="min-h-11 w-full bg-brand font-semibold text-black hover:bg-brand/90 sm:w-auto"
          >
            Start exploring
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
