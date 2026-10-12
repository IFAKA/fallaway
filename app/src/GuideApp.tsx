import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LIMIT, SUITS, isRed, label, power, rank, rankLabel, siteK, strength, suit, zoomCost } from './engine'
import {
  advise, fixIds, canClaim, canMove, canOpen, canScout, canZoom, cheapestPay, claim, claimers, discard, enterCell, enterPack, enterSpread, handSize, hasKey, isKeyCard,
  keyHeld, keyPlan, knownCards, leave, canLeave, move, needOf, newG, nextStep, open, overflow, pendingCells, pileSize, scout, scoutCost, setLock, take, validTake, whereIs, zoom,
} from './guide'
import type { G, Need } from './guide'
import GuideStage from './GuideStage'
import { B, lbl, roleText } from './shared'

const KEY = 'zoom-guide-v1'
type Pending = { kind: 'zoom' | 'scout' } | { kind: 'take'; j: number } | null
function load(): G[] | null {
  try { const s = localStorage.getItem(KEY); return s ? fixIds(JSON.parse(s) as G[]) : null } catch { return null }
}
const POS = ['top-left', 'top-middle', 'top-right', 'middle-left', 'MIDDLE', 'middle-right', 'bottom-left', 'bottom-middle', 'bottom-right']

function Picker({ taken, noAces, onPick }: { taken: Set<number>; noAces?: boolean; onPick: (c: number) => void }) {
  return (
    <div className="picker">
      {[0, 1, 2, 3].map(sx => (
        <div key={sx} className="prow">
          {Array.from({ length: 13 }, (_, k) => 14 - k).map(r => {
            const c = (r - 2) * 4 + sx
            return <button key={c} className={`pbtn ${sx === 1 || sx === 2 ? 'red' : ''}`} disabled={taken.has(c) || (noAces && r === 14)} onClick={() => onPick(c)}>{rankLabel(r)}{SUITS[sx]}</button>
          })}
        </div>
      ))}
    </div>
  )
}

function keyLine(g: G): ReactNode {
  const plan = keyPlan(g)
  const sym = SUITS[g.S]
  if (plan.dead) return <>Your key is now <B>impossible</B>: a {sym} card every run needs is on the GONE pile. You cannot win this deal any more — press <B>New game</B> to start over (or play on just to practise).</>
  if (!plan.missing.length) {
    const vi = g.grid.findIndex(c => c.c === g.vault && c.up)
    const run = plan.ranks.map(r => rankLabel(r) + sym).join(' ')
    if (vi === 4) return <>You <B>hold the key</B> ({run}) and the finish card <B>A{sym}</B> is your middle card: press <B>Finish the game</B>!</>
    if (vi >= 0) return <>You <B>hold the key</B> ({run}) and the finish card <B>A{sym}</B> is on your map: move until it is the <B>middle card</B>.</>
    return <>You <B>hold the key</B> ({run}). Now find the finish card <B>A{sym}</B>: it has to show up on your map, then you move so it is the <B>middle card</B>.</>
  }
  if (g.locks) {
    const miss = plan.missing.map(r => {
      const onMap = g.grid.some(x => x.up && x.c === (r - 2) * 4 + g.S)
      const hold = g.pack.some(c => rank(c) === r)
      return `${rankLabel(r)}${sym} (${onMap ? (hold ? `on the map, you hold a ${rankLabel(r)}: go claim it` : `on the map, find any ${rankLabel(r)} in a spread`) : 'not on the map yet'})`
    }).join(', ')
    return <>Your key row needs <B>{g.L}</B> in a row of {sym}. Closest run: <B>{plan.ranks.map(r => rankLabel(r) + sym).join(' ')}</B>: you have {plan.have.length}/{g.L}; missing {miss}.</>
  }
  const miss = plan.missing.map(r => `${rankLabel(r)}${sym} (${whereIs(g, (r - 2) * 4 + g.S) === 'table' ? 'visible' : 'hidden'})`).join(', ')
  return <>Your key needs <B>{g.L}</B> in a row of {sym}. Closest run: <B>{plan.ranks.map(r => rankLabel(r) + sym).join(' ')}</B> — you hold {plan.have.length}/{g.L}; missing {miss}.</>
}

function needTitle(n: Need, g: G): string {
  if (n.kind === 'lock') return 'Enter the LOCK card you flipped'
  if (n.kind === 'pack') return `Enter the cards in your hand (${handSize(g) - n.left + 1} of ${handSize(g)})`
  if (n.kind === 'spread') return `Enter the next spread card, left to right (${g.site!.cards.length + 1} of ${g.site!.k})`
  return `Enter the card you flipped at the ${POS[n.i]} of the map`
}

export default function GuideApp() {
  const saved = useMemo(() => load(), [])
  const [history, setHistory] = useState<G[]>(() => (saved?.length ? saved : [newG()]))
  const [pending, setPending] = useState<Pending>(null)
  const [sel, setSel] = useState<number[]>([])
  const [cellSel, setCellSel] = useState<number | null>(null)
  const [hint, setHint] = useState(true)
  const logRef = useRef<HTMLDivElement>(null)
  const g = history[history.length - 1]

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(history.slice(-200))) } catch { /* storage full */ } }, [history])
  useEffect(() => { logRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [g.log.length])

  const push = (n: G | null) => { if (n) { setHistory(h => [...h, n]); setPending(null); setSel([]); setCellSel(null) } }
  const undo = () => { if (history.length > 1) { setHistory(h => h.slice(0, -1)); setPending(null); setSel([]); setCellSel(null) } }
  const restart = () => { if (confirm('Start a new game? (the current one is lost)')) { setHistory([newG()]); setPending(null); setSel([]) } }

  const need = needOf(g)
  const over = overflow(g)
  const tip = hint ? advise(g) : null
  const adv = tip?.advice
  const ready = g.step === 'play' && !g.over && !over && !g.site && !pending && !need
  const taken = useMemo(() => new Set(knownCards(g)), [g])
  const cost = zoomCost(g)
  const sCost = scoutCost(g)
  const canConfirm = pending?.kind === 'take' ? validTake(g, pending.j, sel) : !!pending && sel.length === (pending.kind === 'scout' ? sCost : cost)
  const zoomOut = () => (sCost ? setPending({ kind: 'scout' }) : push(scout(g, [])))
  const cellTarget = need?.kind === 'cell' ? (cellSel !== null && pendingCells(g).includes(cellSel) ? cellSel : need.i) : -1

  const onPick = (c: number) => {
    if (!need) return
    if (need.kind === 'lock') push(setLock(g, c))
    else if (need.kind === 'pack') push(enterPack(g, c))
    else if (need.kind === 'spread') push(enterSpread(g, c))
    else push(enterCell(g, cellTarget, c))
  }
  const clickHand = (i: number) => {
    if (g.over) return
    if (over) return push(discard(g, i))
    if (!pending) return
    if (cost === 1 && pending.kind === 'zoom') return push(zoom(g, [i]))
    if (sCost === 1 && pending.kind === 'scout') return push(scout(g, [i]))
    setSel(x => (x.includes(i) ? x.filter(y => y !== i) : [...x, i]))
  }
  const clickSite = (j: number) => {
    if (!g.site || g.site.done[j] || g.over || over || need) return
    const m = g.site.cards[j]
    if (suit(m) === 1 || suit(m) === 2) return push(take(g, j, []))
    if (pending?.kind === 'take' && pending.j === j) { setPending(null); setSel([]); return }
    setPending({ kind: 'take', j }); setSel([])
  }
  // glow only cards that do something when clicked: pay cards once a payment is open, the discard pick when over the limit
  const hlHand = new Set<number>(adv?.kind === 'discard' ? [adv.i] : adv && pending && pending.kind === adv.kind && (adv.kind !== 'take' || (pending.kind === 'take' && pending.j === adv.j)) && 'pay' in adv ? adv.pay : [])
  const hand = g.pack.map((c, i) => ({ c, i })).sort((a, b) => suit(a.c) - suit(b.c) || rank(a.c) - rank(b.c))
  const red = g.S === 1 || g.S === 2
  const setup = g.step !== 'play'

  // ----- what the guide says -----
  let title = ''
  let body: ReactNode = null
  if (g.over === 'win') { title = 'You won!'; body = <>You reached the finish card with your run. Press <B>New game</B> to play another deal.</> }
  else if (g.over) {
    title = 'You lost'
    body = g.exhausted
      ? <>The pile and BEHIND are both empty: the world has no cards left to show you. Next time: zoom fewer times and reach the finish card sooner.</>
      : <>Zooming now costs {cost} card{cost > 1 ? 's' : ''}, you have only {g.pack.length}, and you do not hold your key. Next time: spend fewer cards, collect more {SUITS[g.S]}, and do not wander too long.</>
    body = <>{body} Press <B>New game</B> to play again.</>
  }
  else if (g.step === 'intro') {
    title = 'Welcome — the game in 30 seconds'
    body = <>
      <ul className="gl">
        <li><B>What you do:</B> you explore a map of cards. Your target is a <B>run of 4 cards of the same suit</B> in your hand, in a row — for example <B>5♥ 6♥ 7♥ 8♥</B>. That run is your <B>key</B>. The suit is decided by a card we flip in a moment.</li>
        <li><B>How you get cards:</B> stand on a map card and <B>zoom in</B> (pay a card): 1–3 new cards appear. You take <B>every one you can pay for</B> — the skill is in <B>when</B> you zoom, <B>where</B> you walk, and <B>what you pay with</B>.</li>
        <li><B>How you win:</B> somewhere in the deck is one special card, the <B>finish card</B>: the Ace of that same suit. Keep exploring until it shows up on your map. Then <B>move so that it becomes the MIDDLE card</B> (the card you stand on). If you are holding your key (the 4 cards) at that moment, <B>you win</B>. If not, keep collecting — the map keeps sliding and the Ace will drift away.</li>
        <li><B>How you lose:</B> time makes the world harder. Every time the pile runs out and is reshuffled (a new <B>lap</B>), zooming costs <B>one more card</B>: lap 1 costs 1, lap 2 costs 2, and so on. If you can no longer pay for a zoom and you do not hold your key, you lose. So do not wander: explore with purpose.</li>
        <li><B>How this app works:</B> you play with your <B>real deck</B>. I tell you exactly what to do with the cards on the table, and you tell me which cards you flip. I never deal anything.</li>
      </ul>
      <div className="keyline"><B>Which rules?</B>
        <ul className="gl">
          <li><B>Classic</B>: what is described above.</li>
          <li><B>Locks</B> (new): your key cards <B>only appear on the map</B>, never in a spread or in your starting hand. Each one is <B>locked by its rank</B>: stand on it and <B>show</B> any card of the same rank from your hand (any 7 opens a 7 of your suit; you keep the 7). Claimed key cards go face-up to a <B>key row</B> on the table: safe, never spent, not part of your hand. You start with <B>8 cards</B>, and once your key row holds the run, <B>zooming out is free</B>. The map tells you what you need; spreads give you the ranks that open it.</li>
        </ul>
      </div>
      <div className="row">
        <button className="big" onClick={() => push(nextStep(g, true))}>Start setup: Locks</button>
        <button className="big" onClick={() => push(nextStep(g, false))}>Start setup: Classic</button>
      </div>
    </>
  }
  else if (g.step === 'lock') { title = 'Setup 1 — flip the lock card'; body = <ol className="gl">
    <li>Take the <B>Jokers</B> out of the deck (not used). You need all 52 other cards.</li>
    <li><B>Shuffle</B> the deck well and hold it face-down.</li>
    <li><B>Turn over the top card</B> and lay it face-up next to you. If it is an <B>Ace</B>, push it back into the middle of the deck and turn over the next card instead.</li>
    <li>Tap that card in the list below. It is the <B>lock card</B>: it decides which suit you collect this game.</li>
  </ol> }
  else if (g.step === 'vault') {
    title = 'Setup 2 — your target and the finish card'
    body = <>
      <div className="keyline">You flipped <B>{label(g.lock!)}</B>, so your suit is <B>{SUITS[g.S]}</B>. Target: a run of <B>{g.L} {SUITS[g.S]}</B> in a row (like {Array.from({ length: g.L }, (_, k) => rankLabel(5 + k) + SUITS[g.S]).join(' ')}) {g.locks ? <>in your <B>key row</B>, claimed from the map</> : 'in your hand'}. Then you win by getting the <B>finish card</B> — the <B>A{SUITS[g.S]}</B> — to be the <B>middle card of your map</B> (the one you stand on).</div>
      <ol className="gl">
        <li>Look through your deck and pull out the <B>A{SUITS[g.S]}</B> (the finish card). Put it aside, face-down, for now. In a minute you hide it inside the deck so you do not know where it is — you will have to find it.</li>
        <li>Leave the <B>{label(g.lock!)}</B> you just flipped <B>face-up beside the table</B> for the whole game. It is out of play: it just reminds you that your suit is <B>{SUITS[g.S]}</B>.</li>
      </ol>
      <button className="big" onClick={() => push(nextStep(g))}>Done — next</button>
    </>
  }
  else if (g.step === 'pack' && g.locks) { title = 'Setup 3 — deal your hand'; body = <>Deal the <B>top {handSize(g)} cards</B> of the deck one at a time and tap each in the list below. If one is a <B>{SUITS[g.S]}</B> (a key card), it cannot start in your hand: put it <B>face-down at the bottom of the deck</B> and deal the next card instead (tap it anyway, I will remind you). Your hand is your <B>tools</B>: cards to <B>spend</B> on zooming, <B>power</B> against monsters, and <B>ranks</B> that open key cards on the map.</> }
  else if (g.step === 'pack') { title = 'Setup 3 — deal your hand'; body = <>Deal the <B>top 5 cards</B> of the deck and pick them up: that is your <B>hand</B> (you can also lay it face-up in front of you). Tap each of the 5 in the list below. Your hand has two jobs: its cards are what you <B>spend</B> to explore, and the cards of <B>{SUITS[g.S]}</B> are the pieces of your winning run — so spend the ones that are <B>not {SUITS[g.S]}</B>.</> }
  else if (g.step === 'grid') { title = 'Setup 4 — lay out the map'; body = <>Deal the next <B>9 cards face-down</B> in the middle of the table in a square: 3 rows of 3, with a little space between them. This is your <B>map</B>. Turn the <B>middle</B> card face-up and tap it in the list below. That is where you stand. Leave the rest of the deck face-down beside you.</> }
  else if (g.step === 'hide') {
    title = 'Setup 5 — hide the finish card'
    body = <>
      <div>The rest of your deck ({pileSize(g) - 1} cards) becomes the <B>pile</B>. Hide the finish card (A{SUITS[g.S]}) inside it so you do not know where it is — but not too close to the top or bottom:</div>
      <ol className="gl">
        <li>Count <B>8 cards</B> off the top, face-down, into a small stack <B>A</B>.</li>
        <li>Count the <B>next 22</B> cards into a second stack <B>B</B>. The <B>{pileSize(g) - 31}</B> cards left are stack <B>C</B>.</li>
        <li>Shuffle the finish card <B>A{SUITS[g.S]}</B> into stack <B>B</B> (now 23 cards).</li>
        <li>Put <B>B on top of C</B>, then <B>A on top of B</B>. That is the <B>pile</B>: {pileSize(g)} cards, face-down.</li>
      </ol>
      <div><B>Set up your table</B> like this (after you press Done, the app shows your map with the pile, BEHIND and GONE next to it, and the spread below it):</div>
      <ul className="gl">
        <li><B>Pile</B> (face-down): to the right of the map. You draw from its top.</li>
        <li><B>BEHIND</B> (face-down): an empty spot next to the pile. Cards that slide off the map go here; they come back when the pile runs out.</li>
        <li><B>GONE</B> (face-up): an empty spot further away. Cards you spend go here and never come back.</li>
        <li><B>Spread</B>: keep an empty row <B>below the map</B>. When you zoom in, cards are dealt there.</li>
        <li><B>Out of play</B>: a spot off to the side for spread cards you could not pay for. They never come back either.</li>
        {g.locks && <li><B>Key row</B> (face-up): an empty row near you, apart from your hand. Key cards you claim from the map go here and stay here.</li>}
      </ul>
      <button className="big" onClick={() => push(nextStep(g))}>Done — start playing</button>
    </>
  }
  else if (over) { title = `Discard ${over} card${over > 1 ? 's' : ''}`; body = <>Your hand holds at most {LIMIT}. Click the card you need least (usually not a {SUITS[g.S]}).</> }
  else if (pending?.kind === 'zoom') { title = 'Pay to zoom IN'; body = <>Zooming costs <B>{cost} card{cost > 1 ? 's' : ''}</B> this lap. Click {cost > 1 ? <>{cost} cards in your hand ({sel.length} chosen), then press <B>Confirm</B>.</> : <><B>one card in your hand</B>.</>} They go to the GONE pile for good. Spend cards that are not {SUITS[g.S]}. Changed your mind? Press <B>Cancel</B>.</> }
  else if (pending?.kind === 'scout') { title = 'Pay to zoom OUT'; body = <>Zooming costs <B>{sCost} card{sCost > 1 ? 's' : ''}</B> this lap. Click {sCost > 1 ? <>{sCost} cards in your hand ({sel.length} chosen), then press <B>Confirm</B>.</> : <><B>one card in your hand</B>.</>} Then you turn every map card face-up. Changed your mind? Press <B>Cancel</B>.</> }
  else if (pending?.kind === 'take') {
    const m = g.site!.cards[pending.j]
    const total = sel.reduce((x, i) => x + power(g.pack[i]), 0)
    title = `Pay for ${label(m)}`
    body = suit(m) === 3
      ? <>{lbl(m)} is an obstacle. In <B>your hand</B> on screen, click <B>one {isRed(m) ? 'red' : 'black'} card</B> (a swap) or <B>any two cards</B>, then press <B>Confirm</B>. Not sure? Press <B>Auto-pick cheapest</B>.</>
      : <>{lbl(m)} is a monster with strength <B>{strength(m)}</B>. In <B>your hand</B> on screen, click cards whose values add up to <B>{strength(m)} or more</B> (2–10 = their number, J=11 Q=12 K=13 A=14, your ♠ count double). Selected so far: <B>{total}</B>. Then press <B>Confirm</B>. Not sure? Press <B>Auto-pick cheapest</B>.</>
  } else if (need) { title = 'Tell me what you see'; body = <>First do the steps in the green box. Then tap the card you turned face-up in the list below{need.kind === 'cell' && pendingCells(g).length > 1 ? <> (I ask for them one at a time: the outlined spot on the map below is the one I want now — you can click another face-up <B>?</B> spot to enter that one instead)</> : null}. Tapped the wrong card? Press <B>Undo</B>.</> }
  else if (g.site) {
    title = `Spread of ${label(g.grid[4].c!)}`
    const rest = g.site.cards.filter((_, j) => !g.site!.done[j])
    if (canLeave(g)) body = <>
      <div>You <B>cannot pay</B> for {rest.length === 1 ? 'the card' : 'any of the cards'} left here: {rest.map(c => <span key={c}>{lbl(c)} </span>)}(look at the price under each card and at your hand). Press <B>Done: can't pay for the rest</B> (above the map).</div>
      <div className="keyline">{keyLine(g)}</div>
    </>
    else body = <>
      <div><B>Take every card you can pay for</B>: click a card in the spread on screen (below the map). Free cards are taken at once; for the others you choose what to pay with. Free cards first is smart. When nothing left is affordable, press <B>Done: can't pay for the rest</B>.</div>
      <ul className="gl">{rest.map(c => <li key={c}>{roleText(c, g.S)}</li>)}</ul>
      <div className="keyline">{keyLine(g)}</div>
    </>
  } else {
    const here = g.grid[4].c
    const vi = g.grid.findIndex(c => c.c === g.vault && c.up)
    title = 'Your move'
    body = <>
      <div className="keyline">{keyLine(g)}</div>
      <ol className="gl">
        {g.steps === 0 && <li><B>How to play on screen:</B> the arrows <B>▲ ▼ ◀ ▶</B> around the map below move you; <B>Zoom IN</B> / <B>Zoom OUT</B> are above it. Press one, then do the steps in the green box on your real cards. The <B>glowing</B> button is my suggestion (see the right panel).</li>}
        {g.locks && isKeyCard(g, here) && (canClaim(g)
          ? <li>You stand on the key card {lbl(here!)}. <B>Claim</B> it: show your {lbl(g.pack[claimers(g)[0]])} (you keep it) and move {lbl(here!)} to your key row.</li>
          : <li>You stand on the key card {lbl(here!)}. It is locked: it opens with <B>any {rankLabel(rank(here!))}</B> from your hand, and you have none. Zoom in on other regions to find one (spreads never hold key cards, but they do hold {rankLabel(rank(here!))}s of other suits).</li>)}
        {g.locks && g.steps === 0 && <li><B>Key cards ({SUITS[g.S]}) only appear on the map.</B> Each is locked by its rank. Explore the map to find them; zoom in to find the ranks that open them.</li>}
        {canZoom(g) && <li>You stand on an unexplored region ({lbl(here!)}, spread of {siteK(rank(here!))}). <B>Zoom IN</B> to look inside (pay {cost}).</li>}
        {!canZoom(g) && !canOpen(g) && !isKeyCard(g, here) && <li>This spot is done. <B>Move</B> (free) to another region — high cards (J Q K A) have bigger spreads.</li>}
        {hasKey(g) && vi === 4 && <li>You win now: press <B>Finish the game</B> (above the map).</li>}
        {hasKey(g) && vi >= 0 && vi !== 4 && <li>You hold the key and the finish card is on the map ({POS[vi]}): <B>move until it is the middle card</B> — press the arrow that points toward it, and it slides one step closer — then press <B>Finish the game</B>.</li>}
        {!hasKey(g) && vi >= 0 && <li>The finish card <B>A{SUITS[g.S]}</B> is on your map (marked FINISH), but you do not hold your key yet. Standing on it now does nothing; it will slide away as you move, and comes back in a later lap.</li>}
        {hasKey(g) && vi < 0 && <li>You hold the key but have not seen the finish card A{SUITS[g.S]}: <B>Zoom OUT</B> ({sCost ? `pay ${sCost}` : 'free now'}) or keep moving.</li>}
        <li>Each move shifts the map window and drains the pile; when it is empty you reshuffle BEHIND and a new lap starts (now lap {g.recycles + 1}: zooming costs {cost}).</li>
        <li><B>The game ends</B> when the finish card is your middle card while you hold your run (you win) or when you can no longer pay for a zoom without holding your key, or the pile and BEHIND are both empty (you lose).</li>
      </ol>
    </>
  }

  return (
    <div className="play">
      <div className="boardcol">
        <div className="topbar">
          <span className="grow" />
          {g.lock !== null && (
            <span className="lock">Lock card → need <b>{g.L}</b> in a row of <b className={red ? 'redtxt' : ''}>{SUITS[g.S]}</b> · finish <b className={red ? 'redtxt' : ''}>A{SUITS[g.S]}</b></span>
          )}
          {!setup && <><span className="stat">Pile <b>{g.pile}</b></span><span className="stat">Behind <b>{g.behind}</b></span>
            <span className={`stat ${cost >= 3 ? 'warn' : ''}`}>Lap <b>{g.recycles + 1}</b> · zoom costs <b>{cost}</b></span></>}
          <button onClick={undo} disabled={history.length < 2}>Undo</button>
          <button onClick={restart}>New game</button>
          <button className={hint ? 'on' : ''} onClick={() => setHint(h => !h)}>Suggestions {hint ? 'on' : 'off'}</button>
        </div>

        {g.lock !== null && ['grid', 'hide', 'play'].includes(g.step) && (
          <div className="tracker">
            <span className="muted">Your {SUITS[g.S]}:</span>
            {Array.from({ length: 12 }, (_, k) => k + 2).map(r => {
              const w = whereIs(g, (r - 2) * 4 + g.S)
              return <span key={r} className={`kchip ${w}`}>{rankLabel(r)}</span>
            })}
            <span className={`kchip vault ${whereIs(g, g.vault)}`}>A</span>
            <span className="muted klegend"><i className="kchip pack">{g.locks ? 'in key row' : 'in hand'}</i><i className="kchip table">on table</i><i className="kchip unknown">hidden</i><i className="kchip gone">gone</i></span>
          </div>
        )}

        {g.todo.length > 0 && !pending && !g.over && (
          <div className="donow">
            <div className="dntitle">Do this on the table now</div>
            <ol className="todo">{g.todo.map((t, i) => <li key={i}>{t}</li>)}</ol>
            <div className="muted">Done these on your real cards? Then follow the box below.</div>
          </div>
        )}
        <div className="guide wide">
          <div className="gtitle">{title}</div>
          <div className="gbody">{body}</div>
        </div>


        {need && (
          <div className="enter">
            <div className="dntitle">{needTitle(need, g)}</div>
            <Picker taken={taken} noAces={need.kind === 'lock'} onPick={onPick} />
          </div>
        )}

        {g.step === 'play' && (
          <>
            <div className="actions">
              <button className={`big ${adv?.kind === 'zoom' ? 'glow' : ''}`} disabled={!ready || !canZoom(g)} onClick={() => setPending({ kind: 'zoom' })}>Zoom IN (pay {cost})</button>
              {g.locks && <button className={`big ${adv?.kind === 'claim' ? 'glow' : ''}`} disabled={!ready || !canClaim(g)} onClick={() => push(claim(g))}>Claim key card</button>}
              <button className={adv?.kind === 'scout' ? 'glow' : ''} disabled={!ready || !canScout(g)} onClick={zoomOut}>Zoom OUT ({sCost ? `pay ${sCost}` : 'free'})</button>
              <button className={`big ${adv?.kind === 'open' ? 'glow' : ''}`} disabled={!ready || !canOpen(g)} onClick={() => push(open(g))}>Finish the game</button>
              {g.site && <button className={adv?.kind === 'leave' ? 'glow' : ''} disabled={!!need || !!over || !canLeave(g)} title="Only when you cannot pay for anything left" onClick={() => push(leave(g))}>Done: can't pay for the rest</button>}
              {pending && <button onClick={() => { setPending(null); setSel([]) }}>Cancel</button>}
              {canConfirm && pending && <button className="big" onClick={() => push(pending.kind === 'take' ? take(g, pending.j, sel) : pending.kind === 'zoom' ? zoom(g, sel) : scout(g, sel))}>Confirm</button>}
              {pending?.kind === 'take' && !canConfirm && <button onClick={() => { const p = cheapestPay(g, pending.j); if (p) setSel(p.pay) }}>Auto-pick cheapest</button>}
            </div>

          </>
        )}

        {['vault', 'pack', 'grid', 'hide', 'play'].includes(g.step) && (
          <GuideStage g={g} adv={adv} need={need} cellTarget={cellTarget} pendingTake={pending?.kind === 'take' ? pending.j : null}
            sel={sel} hlHand={hlHand} hand={hand} ready={ready} canMove={canMove(g)} clickable={!!(pending || over) && !g.over}
            onArrow={d => push(move(g, d))} onCell={setCellSel} onSite={clickSite} onHand={clickHand} />
        )}
        {keyHeld(g) >= 1 && !g.over && <div className="muted">You hold the key.</div>}
      </div>

      <div className="panel">
        {tip && (
          <div className="advice">
            <b>Suggestion:</b> {tip.text}
            <div className="muted">It is only a suggestion — the game is yours.</div>
          </div>
        )}
        <b>Log</b>
        <div className="log" ref={logRef}>{g.log.map((l, i) => <div key={i} className={l.startsWith('  ') ? 'sub' : ''}>{l}</div>)}</div>
      </div>
    </div>
  )
}
