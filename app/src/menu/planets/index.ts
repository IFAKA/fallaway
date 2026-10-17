import type { ComponentType } from 'react'
import type { WorldId } from '../worlds'
import { Candy } from './Candy'
import { Earth } from './Earth'
import { Moon } from './Moon'

export const WORLD_SCENES: Record<WorldId, ComponentType> = {
  earth: Earth,
  candy: Candy,
  moon: Moon,
}
