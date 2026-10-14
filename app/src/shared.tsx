import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LIMIT, RUN, START } from '../../core/engine'

export const B = ({ children }: { children: ReactNode }) => <b>{children}</b>

/** the rules in one screen (practice intro and the real-deck guide) */
export function Rules() {
  return (
    <ol className="steps">
      <li><B>Goal.</B> The <i>lock card</i> starts your <B>key row</B> and sets your suit. Build <B>{RUN} in a row</B> of that suit in the key row (like 6♥ 7♥ 8♥ 9♥), then stand on the Ace of that suit (the <B>finish card</B>) on the map, and you win.</li>
      <li><B>Your hand is everything</B> (start with {START} cards, hold at most {LIMIT}): <B>food</B> (every step eats one card), <B>weapons</B> against hostile cards, and the <B>ranks</B> that open key cards. Run out and you lose.</li>
      <li><B>Move</B> (eat 1 card): the 3×3 map slides. The far row falls face-down under the pile; 3 new cards come in face-down; the middle one turns up. The middle card is where you stand.</li>
      <li><B>Zoom IN</B> on the card you stand on (free) to <B>dig</B> it: flip the first card from the pile, then more, one at a time, up to 3 (region 2–5), 5 (6–10) or 7 (J–A). <B>Stop</B> after any flip and keep the loot. Dig to the bottom and the region card joins your hand too.</li>
      <li><B>Hostile cards:</B> in a region every card of <B>its suit</B> is hostile. Beat it with <B>one higher card of that suit</B> from your hand (it is spent; the hostile joins your loot) or <B>flee</B>: you lose the dig's loot and one random hand card. So a region is only as dangerous as <B>your hand</B>: hold high ♠ and ♠ regions are safe. The tag under each region says <B>safe</B>, <B>risky</B> or <B>deadly</B> for the hand you hold now.</li>
      <li><B>Key cards</B> (your suit) live only on the map. A key card that turns up while digging does not count as a flip: if you hold a card of its rank you may <B>take it now</B> by paying that card, or it waits beside the pile and joins the map on your next move, face-up. Stand on a key card and <B>show any card of its rank</B> (you keep it) to <B>claim</B> it into your key row.</li>
      <li><B>Zoom OUT</B> (pay 1 card, free once your key is built) turns the whole map face-up.</li>
      <li><B>You lose</B> when your hand is empty and there is nothing to dig, claim or finish where you stand.</li>
    </ol>
  )
}

/** the rules in a dialog (menu "How to play" and the on-screen game's first-visit intro); `children` adds notes under the rules */
export function HowToPlay({ onClose, close = 'Got it', children }: { onClose: () => void; close?: string; children?: ReactNode }) {
  // focus the close button so Enter closes the dialog, without scrolling the rules to their end (autoFocus would)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => closeRef.current?.focus({ preventScroll: true }), [])
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="how-to-play">
      <div className="card-modal">
        <h2 id="how-to-play">How to play Fallaway</h2>
        <Rules />
        {children}
        <button ref={closeRef} className="big" onClick={onClose}>{close}</button>
      </div>
    </div>
  )
}

/** the largest the on-screen board grows on a big window: a little over its own size, still crisp */
const MAX_SCALE = 1.2

/**
 * Scale a fixed-size table to fill the space it is given, width and height, so the whole table is on screen without
 * scrolling; `aside` (the actions) sits right beside it, or above it on a phone where the table only fits the width
 * (see `.fitscreen` in App.css). One coordinate space for the animations, as in Fit.
 */
export function FitScreen({ w, h, aside, children }: { w: number; h: number; aside?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const asideRef = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const side = getComputedStyle(el).flexDirection === 'row'
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0
      const room = el.clientWidth - (side ? (asideRef.current?.offsetWidth ?? 0) + gap : 0)
      setK(Math.max(0.2, side ? Math.min(MAX_SCALE, room / w, el.clientHeight / h) : Math.min(1, room / w)))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [w, h])
  return (
    <div ref={ref} className="fitscreen">
      <div className="fitscreen-board" style={{ width: w * k, height: h * k }}>
        <div style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
      {aside && <div ref={asideRef} className="fitscreen-aside">{aside}</div>}
    </div>
  )
}

/** Scale a fixed-size table down to the available width (phones), keeping one coordinate space for the animations. */
export function Fit({ w, h, children }: { w: number; h: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(1)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setK(Math.min(1, el.clientWidth / w)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [w])
  return (
    <div ref={ref} className="fit" style={{ height: h * k }}>
      <div style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}
