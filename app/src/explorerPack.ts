// The explorer's backpack opening, seen from behind, in the explorer's 28 × 44 viewBox (explorer.tsx draws it there,
// Practice aims the loot at it), and each world's pack colours (the explorer wears it, the hand is drawn as it).
// Its own file so explorer.tsx exports only components.
import type { WorldId } from './menu/worlds'

export const PACK_MOUTH = { x: 14, y: 23.6, w: 28, h: 44 } as const

/** each world's backpack: the bag, its flap, the front pocket */
export const PACKS: Record<WorldId, { bag: string; flap: string; pocket: string }> = {
  moon: { bag: '#c9cce0', flap: '#a9aecb', pocket: '#e85d5d' },
  earth: { bag: '#a0703c', flap: '#7a4f24', pocket: '#8a5e30' },
  candy: { bag: '#ff9ccf', flap: '#c93a76', pocket: '#fff3b0' },
}
