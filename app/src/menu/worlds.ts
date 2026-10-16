import type { CSSProperties } from 'react'
import { SUITS } from '../../../core/engine'

export type WorldId = 'earth' | 'candy' | 'moon'

/** What a suit's regions look like in a world. Flavour only: the rules are the same everywhere. */
export interface Terrain {
  suit: (typeof SUITS)[number]
  name: string
}

/** A few words shown beside the real terms on the board (never instead of them). */
export interface Flavour {
  /** Beside the dig row. */
  dig: string
  /** Beside "Your hand". */
  hand: string
  /** Beside "gone for good". */
  gone: string
  /** Under the result when you win, as the world's ending scene plays. */
  win: string
  /** Under the result when you lose. */
  lose: string
}

export interface World {
  id: WorldId
  name: string
  tagline: string
  /** Background glow behind the planet while this world is selected. */
  glow: string
  /** Buttons, sparkles and highlights. */
  accent: string
  /** Readable text colour on top of `accent`. */
  accentText: string
  /** One entry per suit, in `SUITS` order. */
  terrain: readonly Terrain[]
  flavour: Flavour
}

type TerrainNames = readonly [spades: string, hearts: string, diamonds: string, clubs: string]

const terrain = (names: TerrainNames): Terrain[] => SUITS.map((suit, i) => ({ suit, name: names[i] }))

/** CSS custom properties that theme a screen for the given world. */
export const worldTheme = (world: World) =>
  ({
    '--bg-glow': world.glow,
    '--accent': world.accent,
    '--accent-text': world.accentText,
    /** The colour wash at the end of the dive, picked up by the game screen as it clears. */
    '--veil': `color-mix(in srgb, ${world.glow} 65%, ${world.accent})`,
  }) as CSSProperties

export const WORLDS: readonly World[] = [
  {
    id: 'earth',
    name: 'Earth',
    tagline: 'The old map, still there',
    glow: '#1b4048',
    accent: '#5cc98f',
    accentText: '#062114',
    terrain: terrain(['Mountains', 'Meadow', 'Desert', 'Forest']),
    flavour: { dig: 'break ground', hand: 'your pack', gone: 'lost to the wild', win: 'The sun comes up over the old map', lose: 'Night falls on the old map' },
  },
  {
    id: 'candy',
    name: 'Sugar Rose',
    tagline: 'Every path is sweet, and sticky',
    glow: '#4d2038',
    accent: '#ff79ad',
    accentText: '#3a0619',
    terrain: terrain(['Rock-candy peaks', 'Frosting plains', 'Caramel dunes', 'Candy-cane woods']),
    flavour: { dig: 'unwrap it', hand: 'your sweets bag', gone: 'melted away', win: 'A shower of sweets for the way home', lose: 'The sugar sun melts away' },
  },
  {
    id: 'moon',
    name: 'Moon',
    tagline: 'Quiet ground, long shadows',
    glow: '#2b2a4d',
    accent: '#a596ff',
    accentText: '#130b3a',
    terrain: terrain(['Ridges', 'Ice flats', 'Dust sea', 'Crater field']),
    flavour: { dig: 'sift the dust', hand: 'your supply crate', gone: 'drifted off', win: 'Earth rises: the way home is lit', lose: 'Earth sets, and the dust settles' },
  },
]
