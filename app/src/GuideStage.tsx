import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { RUN, SUITS, dangerOf, depthOf, isRed, rank, rankLabel, suit } from '../../core/engine'
import type { Advice } from '../../core/engine'
import { viewOfG } from './guide'
import type { G, Need } from './guide'
import { Fit } from './shared'

// One coordinate space for the whole table: every card is a single element keyed by the card itself, so a card that
// is dealt, shifted, taken, or spent slides/flies/flips to its new place instead of jumping.
const CW = 62, CH = 88
const MAP = { x: 52, y: 46, px: 80, py: 104, w: 326, h: 388 }
const PILE = { x: 380, y: 46 }
const WAIT = { x: 460, y: 46 }
const GONE = { x: 590, y: 46 }
const KEYROW = { x: 380, y: 200, w: 330 } // claimed key cards, face-up
const keyPos = (k: number, n: number) => ({ x: KEYROW.x + k * (n > 1 ? Math.min(68, (KEYROW.w - CW) / (n - 1)) : 68), y: KEYROW.y })
const DIG = { y: 410, h: 170 }
const HANDZ = { y: 600, h: 138 }
const STAGE = { w: 720, h: 750 }
const cellPos = (i: number) => ({ x: MAP.x + (i % 3) * MAP.px, y: MAP.y + Math.floor(i / 3) * MAP.py })
const digPos = (j: number) => ({ x: 18 + j * 96, y: DIG.y + 34 })
const handPos = (k: number, n: number) => ({ x: 18 + k * (n > 1 ? Math.min(76, (STAGE.w - 36 - CW) / (n - 1)) : 76), y: HANDZ.y + 30 })

type Mode = 'down' | 'unknown' | 'up'
interface Item {
  key: string; alt?: string; x: number; y: number; mode: Mode; c: number | null
  selected?: boolean; glow?: boolean; dim?: boolean; turned?: boolean; tag?: string; tagCls?: string; onClick?: () => void
}

function StageCard({ it, from, delay }: { it: Item; from: { x: number; y: number }; delay: number }) {
  const down = it.mode === 'down'
  // a card on its way out keeps its old props while it animates: it must not be clickable, or a click would replay an action on an old state
  const present = useIsPresent()
  const onClick = present ? it.onClick : undefined
  return (
    <motion.div
      className={`acard ${it.selected ? 'selected' : ''} ${it.glow && present ? 'glow' : ''} ${it.dim ? 'dim' : ''} ${onClick ? 'clickable' : ''}`}
      initial={{ x: from.x, y: from.y, opacity: 0 }}
      animate={{ x: it.x, y: it.y, opacity: 1 }}
      variants={{
        exit: (ctx: { dest: (key: string) => { x: number; y: number } }) => ({ ...ctx.dest(it.key), opacity: 0, transition: { duration: 0.55 } }),
      }}
      exit="exit"
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay }}
      onClick={onClick}
    >
      {/* an explored region lies sideways, as on the real table; scaled so two turned neighbours don't overlap */}
      <motion.div className="flip" initial={{ rotateY: 180 }} animate={{ rotateY: down ? 180 : 0, rotateZ: it.turned ? 90 : 0, scale: it.turned ? 0.88 : 1 }} transition={{ duration: 0.6, ease: 'easeInOut', delay }}>
        <div className={`cf front ${it.c !== null && isRed(it.c) ? 'red' : 'black'}`}>
          {it.c === null ? <div className="pip" style={{ right: 'auto', left: 0, width: '100%', textAlign: 'center', bottom: 22, fontSize: 34 }}>?</div> : <>
            <div className="corner">{rankLabel(rank(it.c))}<br />{SUITS[suit(it.c)]}</div>
            <div className="pip">{SUITS[suit(it.c)]}</div>
          </>}
        </div>
        <div className="cf backside" />
      </motion.div>
      {it.tag && <span className={`ctag ${it.tagCls ?? ''}`}>{it.tag}</span>}
    </motion.div>
  )
}

export interface StageProps {
  g: G
  adv?: Advice
  need: Need | null
  cellTarget: number
  hlHand: Set<number>
  hand: { c: number; i: number }[]
  handTag: (c: number) => string | undefined
  handClick: (i: number) => (() => void) | undefined
  handDim: (i: number) => boolean
  ready: boolean
  canMove: boolean
  pendingDir: number | null
  onArrow: (d: number) => void
  onCell: (i: number) => void
}

export default function GuideStage(p: StageProps) {
  const { g, adv } = p
  const prev = useRef(new Map<string, { x: number; y: number }>())
  const showMap = g.step === 'grid' || g.step === 'play'
  const items: Item[] = []
  const seen = new Set<string>()
  const add = (it: Item) => { if (!seen.has(it.key)) { seen.add(it.key); items.push(it) } }

  p.hand.forEach(({ c, i }, k) => add({
    key: `c${c}`, c, mode: 'up', ...handPos(k, p.hand.length),
    glow: p.hlHand.has(i), dim: p.handDim(i), tag: p.handTag(c), onClick: p.handClick(i),
  }))
  const keys = [...g.keys].sort((a, b) => rank(a) - rank(b))
  keys.forEach((c, k) => add({ key: `c${c}`, c, mode: 'up', ...keyPos(k, keys.length) }))
  if (showMap) {
    const view = viewOfG(g)
    g.wait.forEach((c, k) => add({ key: `c${c}`, c, mode: 'up', x: WAIT.x + k * 14, y: WAIT.y + k * 6, tag: k === g.wait.length - 1 ? 'waiting' : undefined }))
    g.grid.forEach((x, i) => {
      if (x.gap) return
      const locked = x.up && x.c !== null && suit(x.c) === g.S && x.c !== g.vault
      const danger = x.up && x.c !== null && !locked && x.c !== g.vault && !x.done ? dangerOf(view, suit(x.c)) : undefined
      add({
        key: x.c !== null ? `c${x.c}` : `u${x.id}`, alt: `u${x.id}`, c: x.c, ...cellPos(i),
        mode: !x.up ? 'down' : x.c === null ? 'unknown' : 'up',
        selected: p.cellTarget === i, dim: !!g.dig && i === 4 ? false : x.done > 0, turned: x.up && x.c !== null && x.done > 0 && !(g.dig && i === 4),
        glow: (adv?.kind === 'dig' || adv?.kind === 'finish' || adv?.kind === 'claim') && i === 4,
        tag: !x.up || x.c === null ? undefined : x.c === g.vault ? 'FINISH' : locked ? `🔒 any ${rankLabel(rank(x.c))}${g.hand.some(c => rank(c) === rank(x.c!)) ? ' ✓' : ''}` : x.done ? '✓' : `dig ${depthOf(x.c)} · ${danger}`, tagCls: danger && `t-${danger}`,
        onClick: p.need?.kind === 'cell' && x.up && x.c === null ? () => p.onCell(i) : undefined,
      })
    })
    const d = g.dig
    if (d) [...d.loot, ...(d.hostile >= 0 ? [d.hostile] : []), ...(d.found >= 0 ? [d.found] : [])].forEach((c, j) => add({
      key: `c${c}`, c, mode: 'up', ...digPos(j), glow: c === d.hostile || c === d.found, tag: c === d.hostile ? 'HOSTILE' : c === d.found ? 'KEY' : 'loot',
    }))
  }

  // cards that were not on the table last render: where they come from + a small stagger so a dealt row fans out
  let fresh = 0
  // where each card was in the last committed render, so a card that changed key (a face-down cell entered) still slides from there
  // eslint-disable-next-line react/refs -- deliberate: animation start positions, not render output
  const info = items.map(it => {
    const was = prev.current.get(it.key) ?? (it.alt ? prev.current.get(it.alt) : undefined)
    return { it, from: was ?? PILE, delay: was ? 0 : 0.35 + 0.12 * fresh++ }
  })
  useEffect(() => {
    const m = new Map<string, { x: number; y: number }>()
    items.forEach(it => { m.set(it.key, { x: it.x, y: it.y }); if (it.alt) m.set(it.alt, { x: it.x, y: it.y }) })
    prev.current = m
  })

  // spent cards fly to GONE; cards that fall off the map go under the pile
  const gone = new Set(g.gone)
  const dest = (key: string) => (key.startsWith('c') && gone.has(+key.slice(1)) ? GONE : PILE)
  const topGone = g.gone.length ? g.gone[g.gone.length - 1] : null
  const arrows = [
    { d: 0, ch: '▲', style: { left: MAP.w / 2 - 20, top: 8 } },
    { d: 1, ch: '▼', style: { left: MAP.w / 2 - 20, top: MAP.h - 40 } },
    { d: 2, ch: '◀', style: { left: 6, top: MAP.h / 2 - 18 } },
    { d: 3, ch: '▶', style: { left: MAP.w - 46, top: MAP.h / 2 - 18 } },
  ]

  return (
    <Fit w={STAGE.w} h={STAGE.h}>
    <div className="stage" style={{ width: STAGE.w, height: STAGE.h }}>
      {g.lock !== null && <>
        <div className="zone keyzone" style={{ left: KEYROW.x - 8, top: KEYROW.y - 8, width: KEYROW.w + 16, height: CH + 16 }} />
        <div className="piletxt" style={{ left: KEYROW.x, top: KEYROW.y + CH + 10, width: KEYROW.w, textAlign: 'left' }}>key row ({g.keys.length}; {RUN} in a row wins): safe, never spent</div>
      </>}
      {showMap && <>
        <div className="zone" style={{ left: 0, top: 0, width: MAP.w, height: MAP.h }} />
        <div className="zone label" style={{ left: 0, top: DIG.y - 6, width: STAGE.w, height: DIG.h }}>
          <span>{g.dig ? `The dig row under your map: up to ${g.dig.depth} cards; ${SUITS[suit(g.grid[4].c!)]} cards are hostile` : 'The dig row: cards you flip while digging go here'}</span>
        </div>
        <div className={`cellframe ${g.grid[4].up && g.grid[4].c !== null && g.grid[4].done > 0 && !g.dig ? 'turned' : ''}`} style={{ left: cellPos(4).x - 6, top: cellPos(4).y - 6 }} />
        {p.cellTarget >= 0 && p.cellTarget !== 4 && <div className="cellframe" style={{ left: cellPos(p.cellTarget).x - 6, top: cellPos(p.cellTarget).y - 6, borderStyle: 'dashed', borderColor: '#7fc4ff', background: 'transparent' }} />}
        {g.step === 'play' && arrows.map(a => (
          <button key={a.d} className={`arrow ${adv?.kind === 'move' && adv.d === a.d ? 'glow' : ''} ${p.pendingDir === a.d ? 'on' : ''}`} style={a.style} disabled={!p.ready || !p.canMove} onClick={() => p.onArrow(a.d)} title="Move (eat 1 card)">{a.ch}</button>
        ))}
        <div className="pilecard back" style={{ left: PILE.x, top: PILE.y }}>{g.step === 'play' ? g.pile : ''}</div>
        <div className="piletxt" style={{ left: PILE.x, top: PILE.y + CH + 4 }}>pile</div>
        {!g.wait.length && <div className="gap" style={{ position: 'absolute', left: WAIT.x, top: WAIT.y }} />}
        <div className="piletxt" style={{ left: WAIT.x, top: WAIT.y + CH + 4, width: 90 }}>waiting</div>
        {topGone === null
          ? <div className="gap" style={{ position: 'absolute', left: GONE.x, top: GONE.y }} />
          : <div className={`gcard face ${isRed(topGone) ? 'red' : 'black'}`} style={{ position: 'absolute', left: GONE.x, top: GONE.y }}>
              <div className="corner">{rankLabel(rank(topGone))}<br />{SUITS[suit(topGone)]}</div>
              <div className="pip">{SUITS[suit(topGone)]}</div>
            </div>}
        <div className="piletxt" style={{ left: GONE.x, top: GONE.y + CH + 4 }}>gone ({g.gone.length})</div>
      </>}
      <div className="zone label" style={{ left: 0, top: HANDZ.y - 6, width: STAGE.w, height: HANDZ.h }}>
        <span>Your hand ({g.hand.length}/{g.limit}) — the same cards you hold: food, weapons, and ranks that open key cards</span>
      </div>
      <AnimatePresence custom={{ dest }}>
        {info.map(({ it, from, delay }) => <StageCard key={it.key} it={it} from={from} delay={delay} />)}
      </AnimatePresence>
    </div>
    </Fit>
  )
}
