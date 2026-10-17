import { create } from 'zustand'
import { WORLDS } from './worlds'

/** the chosen world, by id (a new key: the game's own saves keep their old names) */
const WORLD = 'fallaway-world-v1'

const savedIndex = () => {
  try { return Math.max(0, WORLDS.findIndex((w) => w.id === localStorage.getItem(WORLD))) } catch { return 0 }
}

interface CarouselState {
  /** Unbounded index so the animation can travel the short way around the loop. */
  index: number
  next: () => void
  prev: () => void
}

export const useCarousel = create<CarouselState>((set) => ({
  index: savedIndex(),
  next: () => set((s) => ({ index: s.index + 1 })),
  prev: () => set((s) => ({ index: s.index - 1 })),
}))

/**
 * Live drag state, read every frame by the 3D scene. Kept outside zustand
 * state so pointer moves don't trigger React re-renders.
 * `progress` is in carousel slots: +1 means dragged one full world to the right.
 */
export const drag = { active: false, progress: 0 }

export const worldIndex = (index: number) =>
  ((index % WORLDS.length) + WORLDS.length) % WORLDS.length

const worldAt = (index: number) => WORLDS[worldIndex(index)]

export const useCurrentWorld = () => useCarousel((s) => worldAt(s.index))

useCarousel.subscribe((s, prev) => {
  if (worldIndex(s.index) === worldIndex(prev.index)) return
  try { localStorage.setItem(WORLD, worldAt(s.index).id) } catch { /* ignore */ }
})
