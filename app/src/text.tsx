// Small text helpers shared by the practice screen and the real-deck guide.
import type { ReactNode } from 'react'
import { SUITS, isRed, label, rank, rankLabel, suit } from '../../core/engine'
import { B } from './shared'

export function lbl(c: number) { return <span className={isRed(c) ? 'redtxt' : ''}><B>{label(c)}</B></span> }
export const suitTxt = (s: number) => <span className={s === 1 || s === 2 ? 'redtxt' : ''}><B>{SUITS[s]}</B></span>
/** "your ♣: K♣ 9♣" — the hand cards that can fight in a region of this suit */
export function defenders(hand: number[], s: number): ReactNode {
  const cs = hand.filter(c => suit(c) === s).sort((a, b) => rank(b) - rank(a))
  if (!cs.length) return <>you hold <B>no</B> {suitTxt(s)}: any hostile card here will make you flee</>
  return <>your {suitTxt(s)}: {cs.map(c => <span key={c}>{lbl(c)} </span>)}(a hostile card is beaten only by a <B>higher</B> one: you are safe below {rankLabel(rank(cs[0]))}{SUITS[s]})</>
}
export const WHY: Record<string, string> = {
  starved: 'Your hand ran out: with nothing to eat you cannot move, and there was nothing left to dig or claim.',
  world: 'The pile ran out: there was no world left to walk into.',
}

