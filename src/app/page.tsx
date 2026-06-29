"use client"

import dynamic from "next/dynamic"

const MapView = dynamic(() => import("@/components/map/map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <span className="text-sm text-zinc-500">Loading map...</span>
    </div>
  ),
})

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <MapView />
    </main>
  )
}
