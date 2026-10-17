// the on-screen game's saves, shared by Practice (which writes them) and the menu (which offers Continue)
import type { State } from '../../core/engine'
import type { WorldId } from './menu/worlds'

/** one saved on-screen game per world. Earth keeps the game's original key (v4: hunger + digging rules), so existing saves carry on there */
export const GAME_KEYS: Record<WorldId, string> = {
  earth: 'zoom-v4',
  candy: 'fallaway-game-candy-v1',
  moon: 'fallaway-game-moon-v1',
}
/** a game counts toward your record only if you played it yourself: no Undo, no Hint, not a replayed or shared deal, the daily deal once */
export interface Meta { id: string; ranked: boolean; daily: string | null }
export interface Saved { seed: number; history: State[]; meta?: Meta }

export function load(key: string): Saved | null {
  try {
    const s = localStorage.getItem(key)
    const v = s ? (JSON.parse(s) as Saved) : null
    // a damaged or foreign save must not break the page: start fresh instead
    return v && Array.isArray(v.history) && v.history.length && Array.isArray(v.history[v.history.length - 1]?.gc) ? v : null
  } catch { return null }
}

/** a saved game that has not ended yet */
export const inProgress = (saved: Saved | null) => !!saved && !saved.history[saved.history.length - 1].over
