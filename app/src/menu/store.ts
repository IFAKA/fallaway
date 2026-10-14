import { create } from 'zustand'
import { WORLDS } from './worlds'

interface CarouselState {
  /** Unbounded index so the animation can travel the short way around the loop. */
  index: number
  next: () => void
  prev: () => void
}

export const useCarousel = create<CarouselState>((set) => ({
  index: 0,
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

export const useCurrentWorld = () =>
  useCarousel((s) => WORLDS[worldIndex(s.index)])
