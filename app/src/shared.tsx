import type { ReactNode } from 'react'
import { SUITS, isRed, label, rank, strength, suit } from './engine'

export const B = ({ children }: { children: ReactNode }) => <b>{children}</b>
export function lbl(c: number) { return <span className={isRed(c) ? 'redtxt' : ''}><B>{label(c)}</B></span> }
export function roleText(c: number, S: number): ReactNode {
  const k = suit(c)
  const key = suit(c) === S && rank(c) !== 14 ? <> It is a <B>key card</B> (same suit as your lock).</> : null
  if (k === 2) return <>{lbl(c)} is <B>treasure</B>: free, it joins your hand.{key}</>
  if (k === 1) return <>{lbl(c)} is an <B>ally</B>: free, it joins your hand.{key}</>
  if (k === 3) return <>{lbl(c)} is an <B>obstacle</B>: swap it for one {isRed(c) ? 'red' : 'black'} card from your hand (or any two). Good for turning a useless card into the one you need.{key}</>
  return <>{lbl(c)} is a <B>monster</B> (strength {strength(c)}): spend hand cards worth at least {strength(c)} to beat it, then it joins your hand. Your {SUITS[0]} cards count double.{key}</>
}
