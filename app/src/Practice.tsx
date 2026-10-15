import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import {
  RUN, SUITS, advise, dangerOf, applyAdvice, bustChance, canClaim, canDig, canFight, canFinish, canFlee, canFlip, canLeave, canMove, canScout, canStop, canTake, claim, claimers,
  depthOf, dig, discard, fight, fighters, finish, flee, flip, hasKey, isKeyCard, isRed, keyCount, keyPlan, label, leave, lockWant, move, newGame, overflow,
  rank, rankLabel, scout, scoutCost, stop, suit, take, takers, vaultCell, viewOf, visibleCards, whereIs,
} from '../../core/engine'
import type { Advice, State } from '../../core/engine'
import { inProgress, load } from './save'
import type { Meta } from './save'
import type { Start } from './screens'
import type { Flavour, WorldId } from './menu/worlds'
import { RegionArt } from './regionArt'
import { BiomeDive } from './biome'
import { B, FitScreen, HowToPlay } from './shared'
import { WHY, lbl, suitTxt } from './text'

const SEEN = 'zoom-seen-intro-v4'
const STATS = 'zoom-stats-v1'
interface Stats { played: number; won: number; streak: number; best: number; last: string; daily: Record<string, { win: boolean; steps: number; keys: number }> }
const NO_STATS: Stats = { played: 0, won: 0, streak: 0, best: 0, last: '', daily: {} }
function loadStats(): Stats {
  try { return { ...NO_STATS, ...(JSON.parse(localStorage.getItem(STATS) ?? '{}') as Partial<Stats>) } } catch { return NO_STATS }
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
/** the daily deal: the same seed for everyone on the same date */
const dailySeed = (day: string) => { let h = 2166136261; for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return 1 + ((h >>> 0) % 999999) }
const newMeta = (seed: number, ranked: boolean, daily: string | null = null): Meta => ({ id: `${seed}:${Date.now()}`, ranked, daily })
type Pending = { kind: 'move'; d: number } | { kind: 'scout' } | null

const freshSeed = () => 1 + Math.floor(Math.random() * 999999)
const urlSeed = () => { if (typeof location === 'undefined') return null; const v = new URLSearchParams(location.search).get('seed'); return v ? +v : null }
const deal = (seed: number, ranked: boolean, daily: string | null = null) => ({ history: [newGame(seed)], meta: newMeta(seed, ranked, daily) })

/** the first game on screen: a shared deal from the URL wins, then what the menu asked for */
function begin(start: Start, saveKey: string): { history: State[]; meta: Meta } {
  const us = urlSeed()
  if (us) return deal(us, false) // a shared deal: someone may already know it
  const saved = load(saveKey)
  const resume = saved && { history: saved.history, meta: saved.meta ?? newMeta(saved.seed, false) }
  if (start === 'daily') {
    const day = today()
    if (resume && resume.meta.daily === day && inProgress(saved)) return resume // today's deal, still going
    return deal(dailySeed(day), !loadStats().daily[day], day)
  }
  return start === 'resume' && resume ? resume : deal(freshSeed(), true)
}
const DIRS = ['up', 'down', 'left', 'right']

// ---------- the stage: every card lives in ONE coordinate space, so it slides, flips and flies off instead of jumping ----------
const CW = 62, CH = 88
const MAP = { x: 52, y: 46, px: 80, py: 104, w: 326, h: 388 }
// where a new row/column enters from for each move direction (up, down, left, right)
const SLIDE = [[0, -MAP.py], [0, MAP.py], [-MAP.px, 0], [MAP.px, 0]]
const cellPos = (i: number) => ({ x: MAP.x + (i % 3) * MAP.px, y: MAP.y + Math.floor(i / 3) * MAP.py })

/** Where everything but the map sits. Tall (phones: map, then the rest below it) or wide (desktop: the dig row and the key
 *  row beside the map, the hand along the bottom), so the table fills a landscape window instead of a narrow column. */
interface Layout {
  pile: { x: number; y: number }; wait: { x: number; y: number }
  keyrow: { x: number; y: number; w: number }; gone: { x: number; y: number; w: number }
  dig: { x: number; y: number; w: number; h: number }; handz: { y: number; h: number }; stage: { w: number; h: number }
}
const TALL: Layout = {
  pile: { x: 380, y: 46 }, wait: { x: 460, y: 46 }, keyrow: { x: 380, y: 170, w: 330 }, gone: { x: 380, y: 300, w: 330 },
  dig: { x: 0, y: 404, w: 720, h: 176 }, handz: { y: 596, h: 140 }, stage: { w: 720, h: 746 },
}
const WIDE: Layout = {
  pile: { x: 380, y: 46 }, wait: { x: 460, y: 46 }, keyrow: { x: 380, y: 170, w: 710 }, gone: { x: 600, y: 46, w: 490 },
  dig: { x: 372, y: 300, w: 726, h: 148 }, handz: { y: 458, h: 140 }, stage: { w: 1100, h: 604 },
}
const digPos = (L: Layout, j: number) => ({ x: L.dig.x + 18 + j * 96, y: L.dig.y + 32 })
const handPos = (L: Layout, k: number, n: number) => ({ x: 18 + k * (n > 1 ? Math.min(76, (L.stage.w - 36 - CW) / (n - 1)) : 76), y: L.handz.y + 30 })
const keyPos = (L: Layout, k: number, n: number) => ({ x: L.keyrow.x + k * (n > 1 ? Math.min(68, (L.keyrow.w - CW) / (n - 1)) : 68), y: L.keyrow.y })
const WIDE_QUERY = '(min-width: 900px)'
/** wide table on a landscape window, tall table on a phone (same breakpoint as the one-column CSS) */
function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof matchMedia === 'undefined' || matchMedia(WIDE_QUERY).matches)
  useEffect(() => {
    const mq = matchMedia(WIDE_QUERY)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

interface Placed {
  id: number; x: number; y: number; down: boolean; zone: 'map' | 'dig' | 'hand' | 'other'; dir: number | null
  selected?: boolean; dim?: boolean; turned?: boolean; glow?: boolean; tag?: string; tagCls?: string; onClick?: () => void
  /** a face-up region on the map (not a key card or the finish card): it shows its world's landscape */
  region?: boolean
}
function StageCard({ p, world, pile: PILE }: { p: Placed; world: WorldId; pile: { x: number; y: number } }) {
  // a card on its way out (spent, claimed, fallen off) keeps its old props while it animates: it must not be clickable,
  // or a click would replay an action on an old state
  const present = useIsPresent()
  const onClick = present ? p.onClick : undefined
  return (
    <motion.div
      className={`acard ${p.selected ? 'selected' : ''} ${p.dim ? 'dim' : ''} ${p.turned ? 'turned' : ''} ${p.glow && present ? 'glow' : ''} ${onClick ? 'clickable' : ''}`}
      initial={{ ...(p.zone === 'map' && p.dir !== null ? { x: p.x + SLIDE[p.dir][0], y: p.y + SLIDE[p.dir][1] } : { x: PILE.x, y: PILE.y }), opacity: 0 }}
      animate={{ x: p.x, y: p.y, opacity: 1 }}
      variants={{
        exit: (c: { dest: (id: number) => { x: number; y: number } | null; dir: number | null }) => {
          // a card that scrolls off the map keeps sliding the way the window moves; spent cards fly to the "gone" pile
          const d = c.dest(p.id)
          const off = p.zone === 'map' && c.dir !== null && !d ? { x: p.x - SLIDE[c.dir][0], y: p.y - SLIDE[c.dir][1] } : d ?? PILE
          return { ...off, opacity: 0, transition: { duration: 0.55 } }
        },
      }}
      exit="exit"
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
    >
      {/* an explored region lies sideways, as on the real table; scaled so two turned neighbours don't overlap */}
      <motion.div className="flip" initial={{ rotateY: 180 }} animate={{ rotateY: p.down ? 180 : 0, rotateZ: p.turned ? 90 : 0, scale: p.turned ? 0.88 : 1 }} transition={{ duration: 0.6, ease: 'easeInOut' }}>
        {/* the art stays mounted and fades, so a region card that joins your hand loses it smoothly */}
        <div className={`cf front ${isRed(p.id) ? 'red' : 'black'} ${p.region ? 'region' : ''}`}>
          <RegionArt world={world} suit={suit(p.id)} />
          <div className="corner">{rankLabel(rank(p.id))}<br />{SUITS[suit(p.id)]}</div>
          <div className="pip">{SUITS[suit(p.id)]}</div>
        </div>
        <div className="cf backside" />
      </motion.div>
      {p.tag && <span className={`ctag ${p.tagCls ?? ''}`}>{p.tag}</span>}
    </motion.div>
  )
}

/** the headline of a loss: how close you came */
function nearMiss(s: State): string {
  const k = keyCount(s)
  if (hasKey(s)) return 'So close: you held the key but never reached the finish'
  if (k === RUN - 1) return 'One key card short!'
  if (k === RUN - 2) return `Halfway there: ${k}/${RUN} of your key`
  return 'You lost'
}

// ---------- what to do now: a title and one short line, beside the board ----------
// The board, the tracker chips and the action buttons show the rest; How to play has the full rules.
function coachText(s: State, pending: Pending, tipOn: boolean): { title: string; line: ReactNode } | null {
  const sym = SUITS[s.S]
  const d = s.dig
  if (s.over) return null // the result box says it
  const extra = overflow(s)
  if (extra) return { title: `Hand full: discard ${extra}`, line: <>Your hand holds {s.limit}. Click the card you need least.</> }
  if (pending?.kind === 'move') return { title: `Move ${DIRS[pending.d]}`, line: <>Click a hand card to <B>eat</B>: the one you need least. <B>Esc</B> cancels.</> }
  if (pending?.kind === 'scout') return { title: 'Zoom OUT', line: <>Click a hand card to pay. The whole map turns face-up.</> }
  if (d && d.found >= 0) {
    const needs = lockWant(s, visibleCards(s)).want.has(rank(d.found))
    return {
      title: `Key card ${label(d.found)}`,
      line: <>Pay a <B>glowing {rankLabel(rank(d.found))}</B> to take it now, or leave it waiting by the pile.{tipOn && <> Your key {needs ? 'needs' : 'does not need'} it.</>}</>,
    }
  }
  if (d && d.hostile >= 0) {
    return {
      title: `Hostile ${label(d.hostile)}`,
      line: fighters(s).length
        ? <>Beat it with a <B>higher {SUITS[suit(d.hostile)]}</B> (click a glowing card), or flee.</>
        : <>You hold no {SUITS[suit(d.hostile)]} higher: <B>flee</B> (you lose the loot and 1 random card).</>,
    }
  }
  if (d) {
    const hs = suit(s.gc[4])
    const top = s.hand.filter(c => suit(c) === hs).sort((a, b) => rank(b) - rank(a))[0]
    return {
      title: `Digging ${label(s.gc[4])}: ${d.flips}/${d.depth}`,
      line: <>Flip on, or stop and keep the loot. {top === undefined
        ? <>You hold no {suitTxt(hs)}: a hostile card means fleeing.</>
        : <>Hostile {suitTxt(hs)} below {lbl(top)} are beaten.</>}{tipOn && <> Risk: <B>{Math.round(100 * bustChance(viewOf(s), hs))}%</B>.</>}</>,
    }
  }
  const here = s.gc[4]
  const title = s.steps === 0 ? 'How to start' : 'Your move'
  const walk = <>Move with the arrows (each step <B>eats a card</B>){canDig(s) ? <>, or zoom in to dig {lbl(here)}</> : null}.</>
  if (canFinish(s)) return { title, line: <>You hold your key on the finish card: <B>Finish</B>!</> }
  if (canClaim(s)) return { title, line: <>Claim the key card {lbl(here)}: show your {lbl(s.hand[claimers(s)[0]])} (you keep it).</> }
  if (isKeyCard(s, here)) return { title, line: <>Key card {lbl(here)} opens with any <B>{rankLabel(rank(here))}</B>, and you hold none. {walk}</> }
  if (keyPlan(s).dead) return { title, line: <>Your key can no longer be built: every run of {RUN} needs a {sym} that is gone.</> }
  if (hasKey(s)) return { title, line: vaultCell(s) >= 0 ? <>You hold your key: walk to the finish card <B>A{sym}</B>.</> : <>You hold your key: find <B>A{sym}</B> (zooming out is free).</> }
  return { title, line: walk }
}

function Coach({ s, pending, tipOn }: { s: State; pending: Pending; tipOn: boolean }) {
  const c = coachText(s, pending, tipOn)
  if (!c) return null
  return (
    <div className="coach" aria-live="polite">
      <div className="coach-title">{c.title}</div>
      <div className="coach-line">{c.line}</div>
    </div>
  )
}

function Intro({ onClose }: { onClose: () => void }) {
  return (
    <HowToPlay onClose={onClose} close="Got it — let me play">
      <p className="muted">The strip “Your {'♣'}” shows where each card of your suit is: <span className="klegend"><i className="kchip pack">in key row</i><i className="kchip table">in sight</i><i className="kchip unknown">hidden</i><i className="kchip gone">gone</i></span>. The box beside the table always says what to do next; <B>Hint</B> (💡) suggests a move and shows the odds while you dig, and <B>↶</B> undoes a move.</p>
      <p className="muted">Keyboard: <B>arrows</B> move, <B>1–9, 0</B> pick a hand card (left to right), <B>Space</B> dig or flip, <B>S</B> stop, <B>F</B> flee, <B>L</B> leave a key card, <B>Z</B> zoom out, <B>U</B> undo, <B>N</B> new game, <B>Esc</B> cancel.</p>
      <p className="muted">Every deal can be won or lost: a careful player wins about half the time. Your <B>record</B> counts the games you play yourself (no Undo, no Hint). <B>Daily deal</B> (on the main menu) is the same deal for everyone today.</p>
    </HowToPlay>
  )
}

interface PracticeProps {
  /** where this game is saved (each world keeps its own game) */
  saveKey: string
  /** which game to show first (a `?seed=` deal in the URL overrides it) */
  start?: Start
  /** false while the menu's colour wash is still clearing: the cards are dealt once it is gone */
  dealt?: boolean
  /** the world's words shown beside the real terms (never instead of them) */
  flavour?: Flavour
  /** the world whose landscapes the map regions show */
  world?: WorldId
  /** the screen's own controls (← Menu, title, world), shown first in the game's one header bar */
  bar?: ReactNode
}

/** a world's word beside a real term: "gone for good · melted away" */
const Fl = ({ t }: { t?: string }) => (t ? <i className="flavour"> · {t}</i> : null)

// ---------- app ----------
export default function Practice({ saveKey, start = 'resume', dealt = true, flavour, world = 'earth', bar }: PracticeProps) {
  const [first] = useState(() => begin(start, saveKey))
  const [history, setHistory] = useState<State[]>(first.history)
  const [meta, setMeta] = useState<Meta>(first.meta)
  const [stats, setStats] = useState<Stats>(loadStats)
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState<Pending>(null)
  const [hint, setHint] = useState(false)
  const [intro, setIntro] = useState(() => { try { return !localStorage.getItem(SEEN) && !urlSeed() } catch { return false } })
  const stageRef = useRef<HTMLDivElement>(null)
  const L = useWide() ? WIDE : TALL
  const [dir, setDir] = useState<number | null>(null)
  const s = history[history.length - 1]

  useEffect(() => { try { localStorage.setItem(saveKey, JSON.stringify({ seed: s.seed, history: history.slice(-150), meta })) } catch { /* storage full: ignore */ } }, [saveKey, history, s.seed, meta])
  /** record a game that just ended, once */
  const record = (n: State) => {
    if (!n.over || !meta.ranked || hint || stats.last === meta.id) return
    const win = n.over === 'win'
    const streak = win ? stats.streak + 1 : 0
    const next: Stats = {
      played: stats.played + 1, won: stats.won + (win ? 1 : 0), streak, best: Math.max(stats.best, streak), last: meta.id,
      daily: meta.daily ? { ...stats.daily, [meta.daily]: { win, steps: n.steps, keys: keyCount(n) } } : stats.daily,
    }
    setStats(next)
    try { localStorage.setItem(STATS, JSON.stringify(next)) } catch { /* ignore */ }
  }
  const closeIntro = () => { try { localStorage.setItem(SEEN, '1') } catch { /* ignore */ } setIntro(false) }

  const push = (n: State | null, d: number | null = null) => { if (n) { setDir(d); setHistory(h => [...h, n]); setPending(null); record(n) } }
  const reset = (seed: number, ranked = true, daily: string | null = null) => { setDir(null); setHistory([newGame(seed)]); setPending(null); setMeta(newMeta(seed, ranked, daily)); setCopied(false) }
  const newDeal = () => reset(freshSeed())
  const replay = () => reset(s.seed, false, null)
  const undo = () => { if (history.length > 1) { setDir(null); setHistory(h => h.slice(0, -1)); setPending(null); setMeta(m => ({ ...m, ranked: false })) } }
  const share = () => {
    const txt = `Fallaway daily ${meta.daily}: ${s.over === 'win' ? 'WON' : `lost with ${keyCount(s)}/${RUN} of my key`} in ${s.steps} actions. ${location.origin}${location.pathname}`
    navigator.clipboard?.writeText(txt).then(() => setCopied(true), () => setCopied(false))
  }

  const over = overflow(s)
  const tip = hint ? advise(s) : null
  const adv: Advice | undefined = tip?.advice
  const ready = !s.over && !over && !s.dig && !pending
  const sCost = scoutCost(s)
  const zoomOut = () => (sCost ? setPending({ kind: 'scout' }) : push(scout(s, [])))
  const hostile = s.dig && s.dig.hostile >= 0
  const found = s.dig && s.dig.found >= 0
  const fightSet = new Set(fighters(s))
  const pickSet = hostile ? fightSet : found ? new Set(takers(s)) : null // hand cards you may click during a dig
  const { want, vis } = lockWant(s, visibleCards(s))

  const clickHand = (i: number) => {
    if (s.over) return
    if (over) return push(discard(s, i))
    if (hostile) return canFight(s, i) ? push(fight(s, i)) : undefined
    if (found) return canTake(s, i) ? push(take(s, i)) : undefined
    if (pending?.kind === 'move') return push(move(s, pending.d, i), pending.d)
    if (pending?.kind === 'scout') return push(scout(s, [i]))
  }
  const clickCell = (i: number) => {
    if (!ready) return
    const d = [-1, 0, -1, 2, -1, 3, -1, 1, -1][i]
    if (i === 4) { if (canFinish(s)) push(finish(s)); else if (canClaim(s)) push(claim(s)); else if (canDig(s)) push(dig(s)) }
    else if (d >= 0 && canMove(s)) setPending({ kind: 'move', d })
  }

  // ----- place every card on the stage -----
  const handSorted = s.hand.map((c, i) => ({ c, i })).sort((a, b) => suit(a.c) - suit(b.c) || rank(a.c) - rank(b.c))
  const hlHand = new Set<number>(
    adv?.kind === 'move' && (!pending || (pending.kind === 'move' && pending.d === adv.d)) ? [adv.eat]
      : adv?.kind === 'scout' ? adv.pay : adv?.kind === 'fight' || adv?.kind === 'take' || adv?.kind === 'discard' ? [adv.i] : [],
  )
  const handClickable = !s.over && (over > 0 || !!pickSet || !!pending)
  const placed: Placed[] = []
  const view = viewOf(s)
  s.gc.forEach((c, i) => {
    if (c < 0) return
    const { x, y } = cellPos(i)
    const up = s.gup[i]
    const region = up && c !== s.vault && !isKeyCard(s, c)
    const danger = region && !s.gdone[i] ? dangerOf(view, suit(c)) : undefined
    const tag = !up ? undefined
      : c === s.vault ? 'FINISH'
      : isKeyCard(s, c) ? `🔒 any ${rankLabel(rank(c))}${s.hand.some(x => rank(x) === rank(c)) ? ' ✓' : ''}`
      : s.gdone[i] ? '✓' : `dig ${depthOf(c)} · ${danger}`
    placed.push({
      id: c, x, y, zone: 'map', dir, down: !up, region, dim: s.gdone[i] > 0 || !!s.dig, turned: up && s.gdone[i] > 0, tagCls: danger && `t-${danger}`,
      glow: (adv?.kind === 'dig' || adv?.kind === 'finish' || adv?.kind === 'claim') && i === 4,
      tag, onClick: ready && i !== 4 ? () => clickCell(i) : ready && (canDig(s) || canClaim(s) || canFinish(s)) && i === 4 ? () => clickCell(i) : undefined,
    })
  })
  const digCards = s.dig ? [...s.dig.loot, ...(s.dig.hostile >= 0 ? [s.dig.hostile] : []), ...(s.dig.found >= 0 ? [s.dig.found] : [])] : []
  digCards.forEach((c, j) => placed.push({
    id: c, ...digPos(L, j), zone: 'dig', dir, down: false, glow: c === s.dig!.hostile || c === s.dig!.found,
    tag: c === s.dig!.hostile ? 'HOSTILE' : c === s.dig!.found ? 'KEY' : 'loot',
  }))
  ;[...s.keys].sort((a, b) => rank(a) - rank(b)).forEach((c, k) => placed.push({ id: c, ...keyPos(L, k, s.keys.length), zone: 'other', dir, down: false }))
  s.wait.forEach((c, k) => placed.push({ id: c, x: L.wait.x + k * 14, y: L.wait.y + k * 6, zone: 'other', dir, down: false, tag: k === s.wait.length - 1 ? 'waiting' : undefined }))
  handSorted.forEach(({ c, i }, k) => {
    const opens = want.has(rank(c)) && vis.has(rank(c))
    const guard = s.dig && suit(c) === suit(s.gc[4])
    placed.push({
      id: c, ...handPos(L, k, handSorted.length), zone: 'hand', dir, down: false,
      selected: false, glow: hlHand.has(i) || (!!pickSet && pickSet.has(i) && !hint), dim: !!pickSet && !pickSet.has(i),
      tag: guard ? 'defends' : opens ? '🔑' : undefined,
      onClick: handClickable && (!pickSet || pickSet.has(i)) ? () => clickHand(i) : undefined,
    })
  })
  const dest = (id: number) => (s.gone.includes(id) ? { x: L.gone.x + 120, y: L.gone.y } : s.keys.includes(id) ? { x: L.keyrow.x + 120, y: L.keyrow.y } : s.hand.includes(id) ? { x: 300, y: L.handz.y + 30 } : null)

  const arrows = [
    { d: 0, ch: '▲', style: { left: MAP.w / 2 - 20, top: 8 } },
    { d: 1, ch: '▼', style: { left: MAP.w / 2 - 20, top: MAP.h - 40 } },
    { d: 2, ch: '◀', style: { left: 6, top: MAP.h / 2 - 18 } },
    { d: 3, ch: '▶', style: { left: MAP.w - 46, top: MAP.h / 2 - 18 } },
  ]
  // entering a biome: digging the middle region dives into its card (worlds with biome colours, see biome.tsx)
  const biome = s.dig ? suit(s.gc[4]) : null
  /** the middle card on screen, where the camera dives in and rises out; the stage may be scaled down to fit (see Fit) */
  const middleCard = () => {
    const r = stageRef.current?.getBoundingClientRect()
    if (!r) return null
    const k = r.width / L.stage.w, at = cellPos(4)
    return { left: r.left + at.x * k, top: r.top + at.y * k, width: CW * k, height: CH * k }
  }
  const goneSorted = [...s.gone].sort((a, b) => suit(a) - suit(b) || rank(a) - rank(b))
  const red = s.S === 1 || s.S === 2

  // keyboard: arrows move, 1-9/0 pick a hand card (left to right), Space/Enter dig or flip, S stop, F flee, L leave a key card, Z zoom out, U undo, N new game, Esc cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || intro) return
      const k = e.key.toLowerCase()
      const arrow = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].indexOf(k)
      let done = true
      if (arrow >= 0) { if (ready && canMove(s)) setPending({ kind: 'move', d: arrow }) }
      else if (/^[0-9]$/.test(k)) { const h = handSorted[(+k + 9) % 10]; if (h && handClickable && (!pickSet || pickSet.has(h.i))) clickHand(h.i) }
      else if (k === ' ' || k === 'enter') {
        if (s.dig) { if (canFlip(s)) push(flip(s)); else if (canStop(s)) push(stop(s)) }
        else if (ready) { if (canFinish(s)) push(finish(s)); else if (canClaim(s)) push(claim(s)); else if (canDig(s)) push(dig(s)) }
        else if (s.over && k === 'enter') newDeal()
      }
      else if (k === 's' && canStop(s)) push(stop(s))
      else if (k === 'f' && canFlee(s)) push(flee(s))
      else if (k === 'l' && canLeave(s)) push(leave(s))
      else if (k === 'z' && ready && canScout(s)) zoomOut()
      else if (k === 'u') undo()
      else if (k === 'n' && s.over) newDeal()
      else if (k === 'escape') setPending(null)
      else done = false
      if (done) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <>
    {intro && <Intro onClose={closeIntro} />}
    <BiomeDive world={world} suit={biome} card={middleCard}>
    <div className="play onscreen">
      <div className="boardcol">
        <header className="topbar">
          {bar}
          <span className="lock">Key: <b>{RUN}</b> in a row of <b className={red ? 'redtxt' : ''}>{SUITS[s.S]}</b> · finish <b className={red ? 'redtxt' : ''}>A{SUITS[s.S]}</b></span>
          <span className={`stat ${s.hand.length <= 3 ? 'warn' : ''}`}>Hand <b>{s.hand.length}</b>/{s.limit}</span>
          <span className="stat">Pile <b>{s.pile.length}</b></span>
          <span className="grow" />
          <button className="icon" onClick={() => setIntro(true)} aria-label="How to play" title="How to play">?</button>
          <button className="icon" onClick={undo} disabled={history.length < 2} aria-label="Undo" title="Undo (U). Games with Undo do not count toward your record.">↶</button>
          <button className={`icon ${hint ? 'on' : ''}`} onClick={() => { if (!hint && !s.over) setMeta(m => ({ ...m, ranked: false })); setHint(h => !h) }} aria-label={`Hint: ${hint ? 'on' : 'off'}`} aria-pressed={hint} title="Hint: suggests a move. Games played with hints do not count toward your record.">💡</button>
        </header>

        <div className="tracker" aria-label={`Where your ${SUITS[s.S]} cards are`}>
          <span className="muted">Your {SUITS[s.S]}:</span>
          {Array.from({ length: 12 }, (_, k) => k + 2).map(r => {
            const w = whereIs(s, (r - 2) * 4 + s.S)
            return <span key={r} className={`kchip ${w}`} title={w}>{rankLabel(r)}</span>
          })}
          <span className={`kchip vault ${whereIs(s, s.vault)}`} title="the finish card">A</span>
        </div>

        {/* beside the board: what to do now, the hint's suggestion, then the usable actions (or the result) */}
        <FitScreen w={L.stage.w} h={L.stage.h} aside={<>
          <Coach s={s} pending={pending} tipOn={hint} />
          {tip && !s.over && (
            <div className="advice">
              <b>Suggestion:</b> {tip.text}
              <button className="small" onClick={() => adv && push(applyAdvice(s, adv), adv.kind === 'move' ? adv.d : null)}>Do it</button>
            </div>
          )}
          {s.over ? (
          <div className="endbox">
            <div className="result">{s.over === 'win' ? 'YOU REACHED THE FINISH — YOU WIN' : nearMiss(s)}</div>
            <div className="muted">{s.over === 'lose' && WHY[s.why!]} {s.steps} actions · key {keyCount(s)}/{RUN} · {meta.daily ? `daily deal ${meta.daily}` : `deal #${s.seed}`}</div>
            <div className="record">{stats.played
              ? <>Your record: won <b>{stats.won}</b> of {stats.played} ({Math.round(100 * stats.won / stats.played)}%) · streak <b>{stats.streak}</b> · best {stats.best}</>
              : 'Your record starts with your first counted game.'}
              {!meta.ranked && <span className="muted"> · this game was not counted ({!meta.daily && urlSeed() ? 'a shared deal' : 'you used Undo or Hint, or replayed the deal'})</span>}</div>
            <div className="endbtns">
              <button className="big" onClick={newDeal}>New game</button>
              {meta.daily && <button onClick={share}>{copied ? 'Copied!' : 'Copy result'}</button>}
              <button onClick={replay}>Replay this deal</button>
              <button onClick={undo}>Undo last move</button>
            </div>
          </div>
        ) : (
          // only what you can do right now
          <div className="actions">
            {!s.dig && ready && <>
              {canDig(s) && <button className={`big ${adv?.kind === 'dig' ? 'glow' : ''}`} onClick={() => push(dig(s))}>Zoom IN <small>flip the first card</small></button>}
              {canClaim(s) && <button className={`big ${adv?.kind === 'claim' ? 'glow' : ''}`} onClick={() => push(claim(s))}>Claim key card</button>}
              {canFinish(s) && <button className={`big ${adv?.kind === 'finish' ? 'glow' : ''}`} onClick={() => push(finish(s))}>Finish</button>}
              {canScout(s) && <button className={adv?.kind === 'scout' ? 'glow' : ''} onClick={zoomOut}>Zoom OUT <small>{sCost ? 'pay 1 card' : 'free'}</small></button>}
            </>}
            {s.dig && <>
              {canFlip(s) && <button className={`big ${adv?.kind === 'flip' ? 'glow' : ''}`} onClick={() => push(flip(s))}>Flip next <small>{s.dig.depth - s.dig.flips} left</small></button>}
              {canStop(s) && <button className={adv?.kind === 'stop' ? 'glow' : ''} onClick={() => push(stop(s))}>Stop <small>keep the loot</small></button>}
              {hostile && canFlee(s) && <button className={adv?.kind === 'flee' ? 'glow' : ''} onClick={() => push(flee(s))}>Flee <small>lose the loot + 1 random card</small></button>}
              {found && canLeave(s) && <button className={`big ${adv?.kind === 'leave' ? 'glow' : ''}`} onClick={() => push(leave(s))}>Leave it waiting</button>}
            </>}
            {pending && <button onClick={() => setPending(null)}>Cancel <small>Esc</small></button>}
          </div>
        )}
        </>}>
        <div className="stage" ref={stageRef} style={{ width: L.stage.w, height: L.stage.h }}>
          <div className="zone" style={{ left: 0, top: 0, width: MAP.w, height: MAP.h }} />
          <div className="zone label" style={{ left: L.dig.x, top: L.dig.y - 6, width: L.dig.w, height: L.dig.h }}>
            <span>{s.dig ? `Digging ${label(s.gc[4])}: up to ${s.dig.depth} cards · ${SUITS[suit(s.gc[4])]} cards are hostile` : <>Zoom in on the middle card to dig here<Fl t={flavour?.dig} /></>}</span>
          </div>
          <div className="zone label" style={{ left: 0, top: L.handz.y - 6, width: L.stage.w, height: L.handz.h }}>
            <span>Your hand<Fl t={flavour?.hand} /> ({s.hand.length}/{s.limit}): food, weapons, and ranks that open key cards</span>
          </div>
          <div className={`cellframe ${s.gup[4] && s.gdone[4] > 0 ? 'turned' : ''}`} style={{ left: cellPos(4).x - 6, top: cellPos(4).y - 6 }} />
          {arrows.map(a => (
            <button key={a.d} className={`arrow ${adv?.kind === 'move' && adv.d === a.d ? 'glow' : ''} ${pending?.kind === 'move' && pending.d === a.d ? 'on' : ''}`} style={a.style} disabled={!ready || !canMove(s)} onClick={() => setPending({ kind: 'move', d: a.d })} title="Move (eat 1 card)">{a.ch}</button>
          ))}
          <div className="pilecard back" style={{ left: L.pile.x, top: L.pile.y }}>{s.pile.length}</div>
          <div className="piletxt" style={{ left: L.pile.x, top: L.pile.y + CH + 4 }}>pile</div>
          {!s.wait.length && <div className="gap" style={{ position: 'absolute', left: L.wait.x, top: L.wait.y }} />}
          <div className="piletxt" style={{ left: L.wait.x, top: L.wait.y + CH + 4, width: 90 }}>waiting</div>
          <div className="zone keyzone" style={{ left: L.keyrow.x - 8, top: L.keyrow.y - 8, width: L.keyrow.w + 16, height: CH + 16 }} />
          <div className="piletxt" style={{ left: L.keyrow.x, top: L.keyrow.y + CH + 10, width: L.keyrow.w, textAlign: 'left' }}>key row ({keyCount(s)}/{RUN} in a row): safe, never spent</div>
          <div className="gonebox" style={{ left: L.gone.x, top: L.gone.y + 8, width: L.gone.w }}>
            <div className="muted">gone for good ({s.gone.length})<Fl t={flavour?.gone} /></div>
            {[0, 1, 2, 3].map(su => goneSorted.some(c => suit(c) === su) && (
              <div key={su} className={`gonerow ${su === 1 || su === 2 ? 'red' : ''}`}>{SUITS[su]} {goneSorted.filter(c => suit(c) === su).map(c => rankLabel(rank(c))).join(' ')}</div>
            ))}
          </div>
          <AnimatePresence custom={{ dest, dir }}>
            {dealt && placed.map(p => <StageCard key={p.id} p={p} world={world} pile={L.pile} />)}
          </AnimatePresence>
        </div>
        </FitScreen>
      </div>
    </div>
    </BiomeDive>
    </>
  )
}
