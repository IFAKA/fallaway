import type { CSSProperties } from 'react'
import { SUITS } from '../../../core/engine'

export type WorldId = 'earth' | 'candy' | 'moon'

/** What a suit's regions look like in a world. Flavour only: the rules are the same everywhere. */
export interface Terrain {
  suit: (typeof SUITS)[number]
  name: string
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
}

type TerrainNames = readonly [spades: string, hearts: string, diamonds: string, clubs: string]

const terrain = (names: TerrainNames): Terrain[] => SUITS.map((suit, i) => ({ suit, name: names[i] }))

/** CSS custom properties that theme a screen for the given world. */
export const worldTheme = (world: World) =>
  ({
    '--bg-glow': world.glow,
    '--accent': world.accent,
    '--accent-text': world.accentText,
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
  },
  {
    id: 'candy',
    name: 'Sugar Rose',
    tagline: 'Every path is sweet, and sticky',
    glow: '#4d2038',
    accent: '#ff79ad',
    accentText: '#3a0619',
    terrain: terrain(['Rock-candy peaks', 'Frosting plains', 'Caramel dunes', 'Candy-cane woods']),
  },
  {
    id: 'moon',
    name: 'Moon',
    tagline: 'Quiet ground, long shadows',
    glow: '#2b2a4d',
    accent: '#a596ff',
    accentText: '#130b3a',
    terrain: terrain(['Ridges', 'Ice flats', 'Dust sea', 'Crater field']),
  },
]
