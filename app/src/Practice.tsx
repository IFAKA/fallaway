import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LIMIT, SUITS, SUIT_ROLE, advise, applyAdvice, canMove, canOpen, canScout, canZoom, cheapestPay, discard, hasKey, isRed,
  keyPlan, keyProgress, label, leave, canLeave, move, newGame, open, overflow, power, rank, rankLabel, scout, siteK, strength, suit, take, validTake,
  vaultCell, whereIs, zoom, zoomCost,
} from './engine'
import type { Advice, State } from './engine'
import { B, lbl, roleText } from './shared'

const KEY = 'zoom-v1'
const SEEN = 'zoom-seen-intro'
interface Saved { seed: number; history: State[] }
type Pending = { kind: 'zoom' | 'scout' } | { kind: 'take'; j: number } | null

function load(): Saved | null {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as Saved) : null } catch { return null }
}
const freshSeed = () => 1 + Math.floor(Math.random() * 999999)
const urlSeed = () => { const v = new URLSearchParams(location.search).get('seed'); return v ? +v : null }

// ---------- the stage: every card lives in ONE coordinate space, so it slides, flips and flies off instead of jumping ----------
const CH = 88
const MAP = { x: 52, y: 46, px: 80, py: 104, w: 326, h: 388 }
const PILE = { x: 380, y: 46 }
const BEHIND = { x: 470, y: 46 }
const GONE = { x: 380, y: 170, w: 320 }
const LOCK = { x: 560, y: 46 }
const SPREAD = { y: 410, h: 170 }
const PACKZ = { y: 600, h: 138 }
const STAGE = { w: 720, h: 750 }
// where a new row/column enters from for each move direction (up, down, left, right)
const SLIDE = [[0, -MAP.py], [0, MAP.py], [-MAP.px, 0], [MAP.px, 0]]
const cellPos = (i: number) => ({ x: MAP.x + (i % 3) * MAP.px, y: MAP.y + Math.floor(i / 3) * MAP.py })
const spreadPos = (j: number) => ({ x: 18 + j * 140, y: SPREAD.y + 34 })
const packPos = (k: number) => ({ x: 14 + k * 76, y: PACKZ.y + 30 })

interface Placed {
  id: number; x: number; y: number; down: boolean; zone: 'map' | 'spread' | 'pack'; dir: number | null
  selected?: boolean; dim?: boolean; glow?: boolean; tag?: string; onClick?: () => void
}
function StageCard({ p }: { p: Placed }) {
  return (
    <motion.div
      className={`acard ${p.selected ? 'selected' : ''} ${p.dim ? 'dim' : ''} ${p.glow ? 'glow' : ''} ${p.onClick ? 'clickable' : ''}`}
      initial={{ ...(p.zone === 'map' && p.dir !== null ? { x: p.x + SLIDE[p.dir][0], y: p.y + SLIDE[p.dir][1] } : { x: PILE.x, y: PILE.y }), opacity: 0 }}
      animate={{ x: p.x, y: p.y, opacity: 1 }}
      variants={{
        exit: (c: { dest: (id: number) => { x: number; y: number } | null; dir: number | null }) => {
          // a card that scrolls off the map keeps sliding the way the window moves; spent cards fly to the "gone" pile
          const d = c.dest(p.id)
          const off = p.zone === 'map' && c.dir !== null && !d ? { x: p.x - SLIDE[c.dir][0], y: p.y - SLIDE[c.dir][1] } : d ?? BEHIND
          return { ...off, opacity: 0, transition: { duration: 0.55 } }
        },
      }}
      exit="exit"
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      onClick={p.onClick}
    >
      <motion.div
        className="flip"
        initial={{ rotateY: 180 }}
        animate={{ rotateY: p.down ? 180 : 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      >
        <div className={`cf front ${isRed(p.id) ? 'red' : 'black'}`}>
          <div className="corner">{rankLabel(rank(p.id))}<br />{SUITS[suit(p.id)]}</div>
          <div className="pip">{SUITS[suit(p.id)]}</div>
        </div>
        <div className="cf backside" />
      </motion.div>
      {p.tag && <span className="ctag">{p.tag}</span>}
    </motion.div>
  )
}

// ---------- plain-language guide ----------
function keyLine(s: State): ReactNode {
  const plan = keyPlan(s)
  const L = s.L
  const sym = SUITS[s.S]
  if (!plan || plan.dead) return <>Your key looks <B>impossible</B>: too many {sym} cards are gone for good. Try for the best you can.</>
  const cardOf = (r: number) => (r - 2) * 4 + s.S
  if (!plan.missing.length) return <>You <B>hold the key</B>: {plan.ranks.map(r => rankLabel(r) + sym).join(' ')}. Now wait for the finish card <B>A{sym}</B> to show up on the map and move so it is the <B>middle card</B>.</>
  const missTxt = plan.missing.map(r => {
    const w = whereIs(s, cardOf(r))
    return `${rankLabel(r)}${sym} (${w === 'table' ? 'visible on the table' : 'still hidden'})`
  }).join(', ')
  return <>Your key needs <B>{L}</B> in a row of {sym}. Closest run: <B>{plan.ranks.map(r => rankLabel(r) + sym).join(' ')}</B> — you hold {plan.have.length}/{L}; missing {missTxt}.</>
}

function Guide({ s, pending, sel, over, tipOn }: { s: State; pending: Pending; sel: number[]; over: number; tipOn: boolean }) {
  const sym = SUITS[s.S]
  const cost = zoomCost(s)
  let title: string
  let body: ReactNode
  if (s.over === 'win') { title = 'You won!'; body = <>You reached the finish card with your run. Press <B>New game</B> to try another deal.</> }
  else if (s.over) { title = 'You lost'; body = <>The pile ran out too many times. Try again: <B>spend fewer cards, collect more {sym}</B>.</> }
  else if (over) { title = `Discard ${over} card${over > 1 ? 's' : ''}`; body = <>Your pack holds at most {LIMIT}. Click the card you need least (cards that are not {sym} are the usual choice).</> }
  else if (pending?.kind === 'zoom') { title = 'Pay to zoom IN'; body = <>Zooming costs <B>{cost} card{cost > 1 ? 's' : ''}</B> this lap. Click {cost > 1 ? <>{cost} cards in your pack ({sel.length} chosen), then press <B>Confirm</B>.</> : <><B>one card in your pack</B>.</>} They go to the "gone" pile for good. Spend cards that are not {sym}.</> }
  else if (pending?.kind === 'scout') { title = 'Pay to zoom OUT'; body = <>Zooming costs <B>{cost} card{cost > 1 ? 's' : ''}</B> this lap. Click {cost > 1 ? <>{cost} cards in your pack ({sel.length} chosen), then press <B>Confirm</B>.</> : <><B>one card in your pack</B>.</>} In return, every region on the map turns face-up.</> }
  else if (pending?.kind === 'take') {
    const m = s.site!.cards[pending.j]
    const total = sel.reduce((x, i) => x + power(s.pack[i]), 0)
    title = `Pay for ${label(m)}`
    body = suit(m) === 3
      ? <>Click <B>one {isRed(m) ? 'red' : 'black'} card</B> in your pack (a swap), or <B>any two cards</B>. Selected: {sel.length}. Then press <B>Confirm</B>.</>
      : <>Click pack cards whose power adds up to <B>{strength(m)} or more</B> (2–10 count as their number, J=11, Q=12, K=13, A=14; ♠ count double). Selected power: <B>{total}</B>. Then press <B>Confirm</B>.</>
  } else if (s.site) {
    title = `You zoomed in on ${label(s.gc[4])}`
    const rest = s.site.cards.filter((_, j) => !s.site!.done[j])
    body = <>
      <div>Below the map is what you found. <B>Take every card you can pay for</B>: click one, pay if it has a price. Free cards first is smart. You only choose <B>what you pay with</B>.</div>
      <ul className="gl">{rest.map(c => <li key={c}>{roleText(c, s.S)}</li>)}</ul>
      <div className="keyline">{keyLine(s)}</div>
    </>
  } else {
    const here = s.gc[4]
    const vi = vaultCell(s)
    const first = s.steps === 0
    title = first ? 'How to start' : 'Your move'
    body = <>
      <div className="keyline">{keyLine(s)}</div>
      <ol className="gl">
        {first && <li>You are standing on the <B>outlined middle card</B> ({lbl(here)}). <B>Zoom IN</B> on it — pay {cost} pack card{cost > 1 ? 's' : ''} to spread {siteK(rank(here))} card{siteK(rank(here)) > 1 ? 's' : ''} from the pile and see what is inside.</li>}
        {!first && canZoom(s) && <li>You stand on an unexplored region ({lbl(here)}, spread of {siteK(rank(here))}). <B>Zoom IN</B> to look inside (pay {cost}).</li>}
        {!first && !canZoom(s) && <li>This spot is done. <B>Move</B> to another region with the arrows (free) — higher cards (J, Q, K, A) hold bigger spreads.</li>}
        {hasKey(s) && vi >= 0 && <li>You have the key and the finish card is on the map (gold tag): <B>move until it is the middle card</B>, then press <B>Finish the game</B>.</li>}
        {hasKey(s) && vi < 0 && <li>You have the key but have not seen the finish card A{sym} yet: <B>Zoom OUT</B> (pay {cost}) to flip the whole map, or keep moving.</li>}
        {!hasKey(s) && vi < 0 && s.gup.some((u, i) => !u && s.gc[i] >= 0) && <li>You can <B>Zoom OUT</B> (pay {cost}) to flip every region and plan where to go.</li>}
        <li>Moving is free, but it slides the whole window: the far side drops into <B>Behind</B> and new cards come from the <B>Pile</B>. When the pile is empty the world re-shuffles and a new lap starts (now lap {s.recycles + 1}: zooming costs {cost}).</li>
      </ol>
    </>
  }
  return (
    <div className="guide">
      <div className="gtitle">{title}</div>
      <div className="gbody">{body}</div>
      {!tipOn && !s.over && <div className="muted">Stuck? Press <B>Hint</B> for a suggestion.</div>}
    </div>
  )
}

function Intro({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal">
      <div className="card-modal">
        <h2>How to play Zoom</h2>
        <ol className="steps">
          <li><B>The goal.</B> A <i>lock card</i> (top left) tells you a suit, e.g. “need 4 in a row of ♣”. Collect <B>4 consecutive ranks of that suit</B> (like 9♣ 10♣ J♣ Q♣) in your pack — your <B>key</B> — then move until the Ace of that suit (the <B>finish card</B>) is the <B>middle card</B> of the map, the one you stand on. If you hold your key at that moment, you win.</li>
          <li><B>Your pack</B> (bottom) is two things at once: <B>fuel</B> — zooming costs a card, and spent cards are gone for good — and <B>key pieces</B> — cards of the key suit are marked “key”. Spend the cards that are not your suit.</li>
          <li><B>The map</B> is a 3×3 window on a bigger world. <B>Moving is free</B> (arrows), but the window slides: cards on the far side fall behind you and new ones arrive. You cannot come back to what you left.</li>
          <li><B>Zoom IN</B> (pay 1 card on lap 1) on the middle card to see what is inside it: a spread of cards. Take <B>every card you can pay for</B>: ♦ treasure and ♥ allies are free, ♣ obstacles are swaps, ♠ monsters cost cards. You choose what you pay with. Everything you take joins your pack.</li>
          <li><B>Zoom OUT</B> (same price) flips the whole map face-up so you can plan.</li>
          <li><B>The game ends</B> when the finish card is your middle card while you hold your key (you win), or when you can no longer pay for a zoom without holding your key (you lose). Every time the pile runs out and reshuffles — a new <B>lap</B> — zooming costs one more card, so do not wander.</li>
        </ol>
        <p className="muted">The strip “Your ♣” shows where each card of your suit is: in your pack, visible, hidden, or gone. The box above the table always says what to do next, and <B>Hint</B> suggests a move.</p>
        <button className="big" onClick={onClose}>Got it — let me play</button>
      </div>
    </div>
  )
}

// ---------- app ----------
export default function Practice() {
  const saved = useMemo(() => load(), [])
  const [history, setHistory] = useState<State[]>(() => {
    const us = urlSeed()
    if (us) return [newGame(us)]
    return saved?.history?.length ? saved.history : [newGame(freshSeed())]
  })
  const [pending, setPending] = useState<Pending>(null)
  const [sel, setSel] = useState<number[]>([])
  const [hint, setHint] = useState(false)
  const [intro, setIntro] = useState(() => { try { return !localStorage.getItem(SEEN) && !urlSeed() } catch { return false } })
  const logRef = useRef<HTMLDivElement>(null)
  const [dir, setDir] = useState<number | null>(null)
  const s = history[history.length - 1]

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ seed: s.seed, history: history.slice(-150) })) } catch { /* storage full: ignore */ } }, [history, s.seed])
  useEffect(() => { logRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [s.log.length])
  const closeIntro = () => { try { localStorage.setItem(SEEN, '1') } catch { /* ignore */ } setIntro(false) }

  const push = (n: State | null, dir: number | null = null) => { if (n) { setDir(dir); setHistory(h => [...h, n]); setPending(null); setSel([]) } }
  const reset = (seed: number) => { setDir(null); setHistory([newGame(seed)]); setPending(null); setSel([]) }
  const undo = () => { if (history.length > 1) { setHistory(h => h.slice(0, -1)); setPending(null); setSel([]) } }

  const over = overflow(s)
  const tip = hint ? advise(s) : null
  const adv: Advice | undefined = tip?.advice
  const ready = !s.over && !over && !s.site && !pending
  const cost = zoomCost(s)
  const canConfirm = pending?.kind === 'take' ? validTake(s, pending.j, sel) : !!pending && sel.length === cost

  const clickPack = (i: number) => {
    if (s.over) return
    if (over) return push(discard(s, i))
    if (!pending) return
    if (cost === 1 && pending.kind === 'zoom') return push(zoom(s, [i]))
    if (cost === 1 && pending.kind === 'scout') return push(scout(s, [i]))
    setSel(x => (x.includes(i) ? x.filter(y => y !== i) : [...x, i]))
  }
  const clickSite = (j: number) => {
    if (!s.site || s.site.done[j] || s.over || over) return
    const m = s.site.cards[j]
    if (suit(m) === 1 || suit(m) === 2) return push(take(s, j, []))
    if (pending?.kind === 'take' && pending.j === j) { setPending(null); setSel([]); return }
    setPending({ kind: 'take', j }); setSel([])
  }
  const clickCell = (i: number) => {
    if (!ready) return
    const dir = [-1, 0, -1, 2, -1, 3, -1, 1, -1][i]
    if (i === 4) { if (canZoom(s)) setPending({ kind: 'zoom' }); else if (canOpen(s)) push(open(s)) }
    else if (dir >= 0 && canMove(s)) push(move(s, dir), dir)
  }

  // ----- place every card on the stage -----
  const packSorted = s.pack.map((c, i) => ({ c, i })).sort((a, b) => suit(a.c) - suit(b.c) || rank(a.c) - rank(b.c))
  const hlPack = new Set<number>(adv && (adv.kind === 'zoom' || adv.kind === 'scout' || adv.kind === 'take') ? adv.pay : adv?.kind === 'discard' ? [adv.i] : [])
  const placed: Placed[] = []
  s.gc.forEach((c, i) => {
    if (c < 0) return
    const { x, y } = cellPos(i)
    placed.push({
      id: c, x, y, zone: 'map', dir, down: !s.gup[i], dim: s.gdone[i] > 0 || !!s.site, glow: (adv?.kind === 'zoom' || adv?.kind === 'open') && i === 4,
      tag: c === s.vault && s.gup[i] ? 'FINISH' : s.gdone[i] ? '✓' : undefined, onClick: ready ? () => clickCell(i) : undefined,
    })
  })
  s.site?.cards.forEach((c, j) => {
    if (s.site!.done[j]) return
    placed.push({
      id: c, ...spreadPos(j), zone: 'spread', dir, down: false, selected: pending?.kind === 'take' && pending.j === j,
      glow: adv?.kind === 'take' && adv.j === j, onClick: () => clickSite(j),
    })
  })
  packSorted.forEach(({ c, i }, k) => {
    placed.push({
      id: c, ...packPos(k), zone: 'pack', dir, down: false, selected: sel.includes(i), glow: hlPack.has(i),
      tag: suit(c) === s.S && rank(c) !== 14 ? 'key' : undefined,
      onClick: (pending || over) && !s.over ? () => clickPack(i) : undefined,
    })
  })
  const dest = (id: number) => (s.ashes.includes(id) ? { x: GONE.x + 120, y: GONE.y } : dir === null ? { x: BEHIND.x, y: BEHIND.y } : null)

  const arrows = [
    { d: 0, ch: '▲', style: { left: MAP.w / 2 - 20, top: 8 } },
    { d: 1, ch: '▼', style: { left: MAP.w / 2 - 20, top: MAP.h - 40 } },
    { d: 2, ch: '◀', style: { left: 6, top: MAP.h / 2 - 18 } },
    { d: 3, ch: '▶', style: { left: MAP.w - 46, top: MAP.h / 2 - 18 } },
  ]
  const goneSorted = [...s.ashes].sort((a, b) => suit(a) - suit(b) || rank(a) - rank(b))
  const red = s.S === 1 || s.S === 2

  return (
    <div className="play">
      {intro && <Intro onClose={closeIntro} />}
      <div className="boardcol">
        <div className="topbar">
          <span className="lock">
            Lock card → need <b>{s.L}</b> in a row of <b className={red ? 'redtxt' : ''}>{SUITS[s.S]}</b> · finish <b className={red ? 'redtxt' : ''}>A{SUITS[s.S]}</b>
          </span>
          <span className="stat">Pile <b>{s.draw.length}</b></span>
          <span className="stat">Behind <b>{s.behind.length}</b></span>
          <span className={`stat ${cost >= 3 ? 'warn' : ''}`}>Lap <b>{s.recycles + 1}</b> · zoom costs <b>{cost}</b></span>
          <span className="grow" />
          <button onClick={() => setIntro(true)}>? How to play</button>
          <button onClick={undo} disabled={history.length < 2}>Undo</button>
          <button onClick={() => reset(s.seed)}>Restart</button>
          <button onClick={() => reset(freshSeed())}>New game</button>
          <button className={hint ? 'on' : ''} onClick={() => setHint(h => !h)}>Hint {hint ? 'on' : 'off'}</button>
        </div>

        <div className="tracker">
          <span className="muted">Your {SUITS[s.S]}:</span>
          {Array.from({ length: 12 }, (_, k) => k + 2).map(r => {
            const w = whereIs(s, (r - 2) * 4 + s.S)
            return <span key={r} className={`kchip ${w}`} title={w}>{rankLabel(r)}</span>
          })}
          <span className={`kchip vault ${whereIs(s, s.vault)}`} title="the finish card">A</span>
          <span className="muted klegend"><i className="kchip pack">in pack</i><i className="kchip table">on table</i><i className="kchip unknown">hidden</i><i className="kchip gone">gone</i></span>
        </div>

        <div className="actions">
          <button className={`big ${adv?.kind === 'zoom' ? 'glow' : ''}`} disabled={!ready || !canZoom(s)} onClick={() => setPending({ kind: 'zoom' })}>Zoom IN (pay {cost})</button>
          <button className={adv?.kind === 'scout' ? 'glow' : ''} disabled={!ready || !canScout(s)} onClick={() => setPending({ kind: 'scout' })}>Zoom OUT (pay {cost})</button>
          <button className={`big ${adv?.kind === 'open' ? 'glow' : ''}`} disabled={!ready || !canOpen(s)} onClick={() => push(open(s))}>Finish the game</button>
          {s.site && <button className={adv?.kind === 'leave' ? 'glow' : ''} disabled={!!over || !canLeave(s)} title="Only when you cannot pay for anything left" onClick={() => push(leave(s))}>Done: can't pay for the rest</button>}
          {pending && <button onClick={() => { setPending(null); setSel([]) }}>Cancel</button>}
          {canConfirm && pending && <button className="big" onClick={() => push(pending.kind === 'take' ? take(s, pending.j, sel) : pending.kind === 'zoom' ? zoom(s, sel) : scout(s, sel))}>Confirm</button>}
          {pending?.kind === 'take' && !canConfirm && <button onClick={() => { const p = cheapestPay(s, pending.j); if (p) setSel(p.pay) }}>Auto-pick cheapest</button>}
        </div>

        {s.over && (
          <div className="endbox">
            <div className="result">{s.over === 'win' ? 'YOU REACHED THE FINISH — YOU WIN' : 'You cannot pay for a zoom — you lose'}</div>
            <div className="muted">{s.steps} actions · key {Math.round(keyProgress(s) * 100)}% assembled · seed {s.seed}</div>
            <div className="row"><button className="big" onClick={() => reset(freshSeed())}>New game</button><button onClick={() => reset(s.seed)}>Replay this deal</button><button onClick={undo}>Undo last move</button></div>
          </div>
        )}

        <div className="stage" style={{ width: STAGE.w, height: STAGE.h }}>
          <div className="zone" style={{ left: 0, top: 0, width: MAP.w, height: MAP.h }} />
          <div className="zone label" style={{ left: 0, top: SPREAD.y - 6, width: STAGE.w, height: SPREAD.h }}><span>{s.site ? `Inside ${label(s.gc[4])} — click a card to take it` : 'Zoom in on the middle card to fill this spread'}</span></div>
          <div className="zone label" style={{ left: 0, top: PACKZ.y - 6, width: STAGE.w, height: PACKZ.h }}><span>Your pack ({s.pack.length}/{LIMIT}) — fuel AND key pieces</span></div>
          <div className="cellframe" style={{ left: cellPos(4).x - 6, top: cellPos(4).y - 6 }} />
          {arrows.map(a => (
            <button key={a.d} className={`arrow ${adv?.kind === 'move' && adv.d === a.d ? 'glow' : ''}`} style={a.style} disabled={!ready} onClick={() => push(move(s, a.d), a.d)} title="Move (free)">{a.ch}</button>
          ))}
          <div className="pilecard back" style={{ left: PILE.x, top: PILE.y }}>{s.draw.length}</div>
          <div className="piletxt" style={{ left: PILE.x, top: PILE.y + CH + 4 }}>pile</div>
          <div className="pilecard back" style={{ left: BEHIND.x, top: BEHIND.y }}>{s.behind.length}</div>
          <div className="piletxt" style={{ left: BEHIND.x, top: BEHIND.y + CH + 4 }}>behind</div>
          <div className={`gcard face ${isRed(s.lock) ? 'red' : 'black'}`} style={{ position: 'absolute', left: LOCK.x, top: LOCK.y }}>
            <div className="corner">{rankLabel(rank(s.lock))}<br />{SUITS[suit(s.lock)]}</div>
            <div className="pip">{SUITS[suit(s.lock)]}</div>
          </div>
          <div className="piletxt" style={{ left: LOCK.x, top: LOCK.y + CH + 4 }}>lock</div>
          <div className="gonebox" style={{ left: GONE.x, top: GONE.y + 20, width: GONE.w }}>
            <div className="muted">gone for good ({s.ashes.length})</div>
            {goneSorted.map(c => <span key={c} className={`chip ${isRed(c) ? 'red' : ''}`}>{label(c)}</span>)}
          </div>
          {s.site?.cards.map((c, j) => {
            const k = suit(c), done = s.site!.done[j]
            const price = k === 1 || k === 2 ? 'free' : k === 3 ? `swap 1 ${isRed(c) ? 'red' : 'black'} or any 2` : `pay power ≥ ${strength(c)}`
            return <div key={j} className="price" style={{ left: spreadPos(j).x - 34, top: spreadPos(j).y + CH + 8 }}><b>{SUIT_ROLE[k]}</b><br />{done ? 'taken' : price}</div>
          })}
          <AnimatePresence custom={{ dest, dir }}>
            {placed.map(p => <StageCard key={p.id} p={p} />)}
          </AnimatePresence>
        </div>
      </div>

      <div className="panel">
        <Guide s={s} pending={pending} sel={sel} over={over} tipOn={hint} />
        {tip && (
          <div className="advice">
            <b>Suggestion:</b> {tip.text}
            <button className="small" onClick={() => adv && push(applyAdvice(s, adv), adv.kind === 'move' ? adv.d : null)}>Do it</button>
          </div>
        )}

        <b>Log</b>
        <div className="log" ref={logRef}>{s.log.map((l, i) => <div key={i} className={l.startsWith('  ') ? 'sub' : ''}>{l}</div>)}</div>
      </div>
    </div>
  )
}
