import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LIMIT, SUITS, isRed, rank, rankLabel, strength, suit } from './engine'
import type { Advice } from './engine'
import type { G, Need } from './guide'

// One coordinate space for the whole table: every card is a single element keyed by the card itself, so a card that
// is dealt, shifted, taken, or spent slides/flies/flips to its new place instead of jumping.
const CW = 62, CH = 88
const MAP = { x: 52, y: 46, px: 80, py: 104, w: 326, h: 388 }
const PILE = { x: 380, y: 46 }
const BEHIND = { x: 460, y: 46 }
const GONE = { x: 540, y: 46 }
const LOCK = { x: 620, y: 46 }
const KEYROW = { x: 380, y: 200, w: 330 } // locks: claimed key cards, face-up
const keyPos = (k: number, n: number) => ({ x: KEYROW.x + k * (n > 1 ? Math.min(68, (KEYROW.w - CW) / (n - 1)) : 68), y: KEYROW.y })
const SPREAD = { y: 410, h: 170 }
const PACKZ = { y: 600, h: 138 }
const STAGE = { w: 720, h: 750 }
const cellPos = (i: number) => ({ x: MAP.x + (i % 3) * MAP.px, y: MAP.y + Math.floor(i / 3) * MAP.py })
const spreadPos = (j: number) => ({ x: 18 + j * 140, y: SPREAD.y + 34 })
const handPos = (k: number, n: number) => {
  const step = n > 1 ? Math.min(76, (STAGE.w - 36 - CW) / (n - 1)) : 76
  return { x: 18 + k * step, y: PACKZ.y + 30 }
}
const ROLE = ['monster', 'ally', 'treasure', 'obstacle']

type Mode = 'down' | 'unknown' | 'up'
interface Item {
  key: string; alt?: string; x: number; y: number; mode: Mode; c: number | null
  selected?: boolean; glow?: boolean; tag?: string; onClick?: () => void
}

function StageCard({ it, from, delay }: { it: Item; from: { x: number; y: number }; delay: number }) {
  const down = it.mode === 'down'
  return (
    <motion.div
      className={`acard ${it.selected ? 'selected' : ''} ${it.glow ? 'glow' : ''} ${it.onClick ? 'clickable' : ''}`}
      initial={{ x: from.x, y: from.y, opacity: 0 }}
      animate={{ x: it.x, y: it.y, opacity: 1 }}
      variants={{
        exit: (ctx: { dest: (key: string) => { x: number; y: number } }) => ({ ...ctx.dest(it.key), opacity: 0, transition: { duration: 0.55 } }),
      }}
      exit="exit"
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay }}
      onClick={it.onClick}
    >
      <motion.div className="flip" initial={{ rotateY: 180 }} animate={{ rotateY: down ? 180 : 0 }} transition={{ duration: 0.6, ease: 'easeInOut', delay }}>
        <div className={`cf front ${it.c !== null && isRed(it.c) ? 'red' : 'black'}`}>
          {it.c === null ? <div className="pip" style={{ right: 'auto', left: 0, width: '100%', textAlign: 'center', bottom: 22, fontSize: 34 }}>?</div> : <>
            <div className="corner">{rankLabel(rank(it.c))}<br />{SUITS[suit(it.c)]}</div>
            <div className="pip">{SUITS[suit(it.c)]}</div>
          </>}
        </div>
        <div className="cf backside" />
      </motion.div>
      {it.tag && <span className="ctag">{it.tag}</span>}
    </motion.div>
  )
}

export interface StageProps {
  g: G
  adv?: Advice
  need: Need | null
  cellTarget: number
  pendingTake: number | null
  sel: number[]
  hlHand: Set<number>
  hand: { c: number; i: number }[]
  ready: boolean
  clickable: boolean
  onArrow: (d: number) => void
  canMove: boolean
  onCell: (i: number) => void
  onSite: (j: number) => void
  onHand: (i: number) => void
}

export default function GuideStage(p: StageProps) {
  const { g, adv } = p
  const prev = useRef(new Map<string, { x: number; y: number }>())
  const showMap = g.step !== 'pack' && g.step !== 'vault'
  const items: Item[] = []
  const seen = new Set<string>()
  const add = (it: Item) => { if (!seen.has(it.key)) { seen.add(it.key); items.push(it) } }

  p.hand.forEach(({ c, i }, k) => add({
    key: `c${c}`, c, mode: 'up', ...handPos(k, p.hand.length),
    selected: p.sel.includes(i), glow: p.hlHand.has(i),
    tag: suit(c) === g.S && rank(c) !== 14 ? 'key' : undefined,
    onClick: p.clickable ? () => p.onHand(i) : undefined,
  }))
  if (showMap) {
    const keys = [...g.keys].sort((a, b) => a - b)
    keys.forEach((c, k) => add({ key: `c${c}`, c, mode: 'up', ...keyPos(k, keys.length) }))
    g.grid.forEach((x, i) => {
      if (x.gap) return
      const locked = x.up && x.c !== null && g.locks && suit(x.c) === g.S && x.c !== g.vault
      add({
        key: x.c !== null ? `c${x.c}` : `u${x.id}`, alt: `u${x.id}`, c: x.c, ...cellPos(i),
        mode: !x.up ? 'down' : x.c === null ? 'unknown' : 'up',
        selected: p.cellTarget === i,
        glow: (adv?.kind === 'zoom' || adv?.kind === 'open' || adv?.kind === 'claim') && i === 4,
        tag: x.c === g.vault && x.up ? 'FINISH' : locked ? `🔒 any ${rankLabel(rank(x.c!))}${g.pack.some(c => rank(c) === rank(x.c!)) ? ' ✓' : ''}` : x.done ? '✓' : undefined,
        onClick: p.need?.kind === 'cell' && x.up && x.c === null ? () => p.onCell(i) : undefined,
      })
    })
    g.site?.cards.forEach((c, j) => {
      if (g.site!.done[j]) return
      add({
        key: `c${c}`, c, mode: 'up', ...spreadPos(j),
        selected: p.pendingTake === j, glow: adv?.kind === 'take' && adv.j === j,
        onClick: () => p.onSite(j),
      })
    })
  }

  // cards that were not on the table last render: where they come from + a small stagger so a dealt row fans out
  let fresh = 0
  const info = items.map(it => {
    const was = prev.current.get(it.key) ?? (it.alt ? prev.current.get(it.alt) : undefined)
    return { it, from: was ?? PILE, delay: was ? 0 : 0.35 + 0.12 * fresh++ }
  })
  useEffect(() => {
    const m = new Map<string, { x: number; y: number }>()
    items.forEach(it => { m.set(it.key, { x: it.x, y: it.y }); if (it.alt) m.set(it.alt, { x: it.x, y: it.y }) })
    prev.current = m
  })

  // spent cards fly to GONE; cards that slide off the map go BEHIND
  const ashes = new Set(g.ashes)
  const dest = (key: string) => (key.startsWith('c') && ashes.has(+key.slice(1)) ? GONE : BEHIND)
  const topAsh = g.ashes.length ? g.ashes[g.ashes.length - 1] : null
  const arrows = [
    { d: 0, ch: '▲', style: { left: MAP.w / 2 - 20, top: 8 } },
    { d: 1, ch: '▼', style: { left: MAP.w / 2 - 20, top: MAP.h - 40 } },
    { d: 2, ch: '◀', style: { left: 6, top: MAP.h / 2 - 18 } },
    { d: 3, ch: '▶', style: { left: MAP.w - 46, top: MAP.h / 2 - 18 } },
  ]

  return (
    <div className="stage" style={{ width: STAGE.w, height: STAGE.h }}>
        {g.lock !== null && <>
          <div className={`gcard face ${isRed(g.lock) ? 'red' : 'black'}`} style={{ position: 'absolute', left: LOCK.x, top: LOCK.y }}>
            <div className="corner">{rankLabel(rank(g.lock))}<br />{SUITS[suit(g.lock)]}</div>
            <div className="pip">{SUITS[suit(g.lock)]}</div>
          </div>
          <div className="piletxt" style={{ left: LOCK.x, top: LOCK.y + CH + 4 }}>lock</div>
        </>}
      {showMap && <>
        <div className="zone" style={{ left: 0, top: 0, width: MAP.w, height: MAP.h }} />
        <div className="zone label" style={{ left: 0, top: SPREAD.y - 6, width: STAGE.w, height: SPREAD.h }}>
          <span>{g.site ? 'The spread under your map — click a card to take it' : 'Zoom in on the middle card to deal a spread here'}</span>
        </div>
        <div className="cellframe" style={{ left: cellPos(4).x - 6, top: cellPos(4).y - 6 }} />
        {p.cellTarget >= 0 && p.cellTarget !== 4 && <div className="cellframe" style={{ left: cellPos(p.cellTarget).x - 6, top: cellPos(p.cellTarget).y - 6, borderStyle: 'dashed', borderColor: '#7fc4ff', background: 'transparent' }} />}
        {arrows.map(a => (
          <button key={a.d} className={`arrow ${adv?.kind === 'move' && adv.d === a.d ? 'glow' : ''}`} style={a.style} disabled={!p.ready || !p.canMove} onClick={() => p.onArrow(a.d)} title="Move (free)">{a.ch}</button>
        ))}
        <div className="pilecard back" style={{ left: PILE.x, top: PILE.y }}>{g.pile}</div>
        <div className="piletxt" style={{ left: PILE.x, top: PILE.y + CH + 4 }}>pile</div>
        <div className="pilecard back" style={{ left: BEHIND.x, top: BEHIND.y }}>{g.behind}</div>
        <div className="piletxt" style={{ left: BEHIND.x, top: BEHIND.y + CH + 4 }}>behind</div>
        {topAsh === null
          ? <div className="gap" style={{ position: 'absolute', left: GONE.x, top: GONE.y }} />
          : <div className={`gcard face ${isRed(topAsh) ? 'red' : 'black'}`} style={{ position: 'absolute', left: GONE.x, top: GONE.y }}>
              <div className="corner">{rankLabel(rank(topAsh))}<br />{SUITS[suit(topAsh)]}</div>
              <div className="pip">{SUITS[suit(topAsh)]}</div>
            </div>}
        <div className="piletxt" style={{ left: GONE.x, top: GONE.y + CH + 4 }}>gone ({g.ashes.length})</div>
        {g.locks && <>
          <div className="zone keyzone" style={{ left: KEYROW.x - 8, top: KEYROW.y - 8, width: KEYROW.w + 16, height: CH + 16 }} />
          <div className="piletxt" style={{ left: KEYROW.x, top: KEYROW.y + CH + 10, width: KEYROW.w, textAlign: 'left' }}>key row ({g.keys.length}): safe, never spent</div>
        </>}
        {g.site?.cards.map((c, j) => {
          const k = suit(c), done = g.site!.done[j]
          const price = k === 1 || k === 2 ? 'free' : k === 3 ? `swap 1 ${isRed(c) ? 'red' : 'black'} or any 2` : `pay power ≥ ${strength(c)}`
          return <div key={j} className="price" style={{ left: spreadPos(j).x - 34, top: spreadPos(j).y + CH + 8 }}><b>{ROLE[k]}</b><br />{done ? 'taken' : price}</div>
        })}
      </>}
      <div className="zone label" style={{ left: 0, top: PACKZ.y - 6, width: STAGE.w, height: PACKZ.h }}>
        <span>Your hand ({g.pack.length}/{LIMIT}) — the same cards you hold{g.locks ? ': tools (fuel, power, and ranks that open key cards)' : ''}</span>
      </div>
      <AnimatePresence custom={{ dest }}>
        {info.map(({ it, from, delay }) => <StageCard key={it.key} it={it} from={from} delay={delay} />)}
      </AnimatePresence>
    </div>
  )
}
