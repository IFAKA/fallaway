import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { RUN, SUITS, bustChance, cardOf, depthOf, isKeyCard, label, rank, rankLabel, suit } from '../../core/engine'
import {
  advise, canClaim, canDig, canFight, canFinish, canFlee, canFlip, canLeave, canMove, canScout, canStop, canTake, claim, claimers, dig, discard, enterCell, enterFlip,
  enterPack, enterWound, fight, fighters, finish, fixIds, flee, flip, handVals, keyCount, keyPlan, knownCards, leave, move, needOf, newG, nextStep, overflow,
  pendingCells, pileSize, scout, scoutCost, setLock, stop, take, takers, viewOfG, visibleOf, whereIs,
} from './guide'
import type { G, Need } from './guide'
import GuideStage from './GuideStage'
import { B, Rules } from './shared'
import { WHY, defenders, lbl, suitTxt } from './text'

const KEY = 'zoom-guide-v4' // v4: hunger + digging rules; older saves are other games
type Pending = { kind: 'move'; d: number } | { kind: 'scout' } | null
function load(): G[] | null {
  try { const s = localStorage.getItem(KEY); return s ? fixIds(JSON.parse(s) as G[]) : null } catch { return null }
}
const POS = ['top-left', 'top-middle', 'top-right', 'middle-left', 'MIDDLE', 'middle-right', 'bottom-left', 'bottom-middle', 'bottom-right']
const DIRS = ['up', 'down', 'left', 'right']

function Picker({ disabled, onPick }: { disabled: (c: number) => boolean; onPick: (c: number) => void }) {
  return (
    <div className="picker">
      {[0, 1, 2, 3].map(sx => (
        <div key={sx} className="prow">
          {Array.from({ length: 13 }, (_, k) => 14 - k).map(r => {
            const c = cardOf(r, sx)
            return <button key={c} className={`pbtn ${sx === 1 || sx === 2 ? 'red' : ''}`} disabled={disabled(c)} onClick={() => onPick(c)}>{rankLabel(r)}{SUITS[sx]}</button>
          })}
        </div>
      ))}
    </div>
  )
}

function keyLine(g: G): ReactNode {
  const plan = keyPlan(g)
  const sym = SUITS[g.S]
  if (plan.dead) return <>Your key is now <B>impossible</B>: every run of {RUN} needs a {sym} card that is on the GONE pile.</>
  const run = plan.ranks.map(r => rankLabel(r) + sym).join(' ')
  if (!plan.missing.length) {
    const vi = g.grid.findIndex(c => c.c === g.vault && c.up)
    if (vi === 4) return <>You <B>hold the key</B> ({run}) and stand on the finish card: press <B>Finish</B>!</>
    if (vi >= 0) return <>You <B>hold the key</B> ({run}). The finish card <B>A{sym}</B> is on your map ({POS[vi]}): walk until it is the middle card.</>
    return <>You <B>hold the key</B> ({run}). Find the finish card <B>A{sym}</B>: zooming out is free now.</>
  }
  const miss = plan.missing.map(r => {
    const seen = visibleOf(g).includes(cardOf(r, g.S))
    const hold = g.hand.some(c => rank(c) === r)
    return `${rankLabel(r)}${sym} (${seen ? (hold ? `in sight, and you hold a ${rankLabel(r)}: go claim it` : `in sight: you need any ${rankLabel(r)} to open it`) : 'not seen yet'})`
  }).join(', ')
  return <>Key row: {plan.have.length}/{RUN} of <B>{run}</B>. Missing {miss}.</>
}

function needTitle(n: Need, g: G): string {
  if (n.kind === 'lock') return 'Enter the LOCK card you flipped'
  if (n.kind === 'pack') return `Enter the card you dealt to your hand (${g.start - n.left + 1} of ${g.start})`
  if (n.kind === 'flip') return `Enter the card you turned over (dig ${g.dig!.flips + 1} of ${g.dig!.depth})`
  if (n.kind === 'wound') return 'Enter the card the wound took from your hand'
  return `Enter the card you turned face-up at the ${POS[n.i]} of the map`
}

export default function GuideApp() {
  const saved = useMemo(() => load(), [])
  const [history, setHistory] = useState<G[]>(() => (saved?.length ? saved : [newG()]))
  const [pending, setPending] = useState<Pending>(null)
  const [cellSel, setCellSel] = useState<number | null>(null)
  const [hint, setHint] = useState(true)
  const logRef = useRef<HTMLDivElement>(null)
  const g = history[history.length - 1]

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(history.slice(-200))) } catch { /* storage full */ } }, [history])
  useEffect(() => { logRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [g.log.length])

  const push = (n: G | null) => { if (n) { setHistory(h => [...h, n]); setPending(null); setCellSel(null) } }
  const undo = () => { if (history.length > 1) { setHistory(h => h.slice(0, -1)); setPending(null); setCellSel(null) } }
  const restart = () => { if (confirm('Start a new game? (the current one is lost)')) { setHistory([newG()]); setPending(null) } }

  const need = needOf(g)
  const over = overflow(g)
  const tip = hint ? advise(g) : null
  const adv = tip?.advice
  const ready = g.step === 'play' && !g.over && !over && !g.dig && !pending && !need
  const known = useMemo(() => new Set(knownCards(g)), [g])
  const sCost = scoutCost(g)
  const zoomOut = () => (sCost ? setPending({ kind: 'scout' }) : push(scout(g, [])))
  const cellTarget = need?.kind === 'cell' ? (cellSel !== null && pendingCells(g).includes(cellSel) ? cellSel : need.i) : -1
  const hostile = !!g.dig && g.dig.hostile >= 0 && !need
  const found = !!g.dig && g.dig.found >= 0 && !need
  const fightSet = new Set(fighters(g))
  const pickSet = hostile ? fightSet : found ? new Set(takers(g)) : null // hand cards you may click during a dig

  const onPick = (c: number) => {
    if (!need) return
    if (need.kind === 'lock') push(setLock(g, c))
    else if (need.kind === 'pack') push(enterPack(g, c))
    else if (need.kind === 'flip') push(enterFlip(g, c))
    else if (need.kind === 'wound') push(enterWound(g, c))
    else push(enterCell(g, cellTarget, c))
  }
  const pickDisabled = (c: number) => (need?.kind === 'wound' ? !g.hand.includes(c) : known.has(c) || (need?.kind === 'lock' && rank(c) === 14))
  const clickHand = (i: number) => {
    if (g.over || need) return
    if (over) return push(discard(g, i))
    if (hostile) return canFight(g, i) ? push(fight(g, i)) : undefined
    if (found) return canTake(g, i) ? push(take(g, i)) : undefined
    if (pending?.kind === 'move') return push(move(g, pending.d, i))
    if (pending?.kind === 'scout') return push(scout(g, [i]))
  }
  const handClickable = g.step === 'play' && !g.over && !need && (over > 0 || !!pickSet || !!pending)
  // glow only cards that do something when clicked
  const hlHand = new Set<number>(
    adv?.kind === 'move' && pending?.kind === 'move' && pending.d === adv.d ? [adv.eat]
      : adv?.kind === 'scout' && pending?.kind === 'scout' ? adv.pay : adv?.kind === 'fight' || adv?.kind === 'take' || adv?.kind === 'discard' ? [adv.i] : [],
  )
  const kv = g.step === 'play' ? handVals(g) : []
  const hand = g.hand.map((c, i) => ({ c, i })).sort((a, b) => suit(a.c) - suit(b.c) || rank(a.c) - rank(b.c))
  const handTag = (c: number) => (g.dig && g.grid[4].c !== null && suit(c) === suit(g.grid[4].c) ? 'defends' : g.step === 'play' && kv[g.hand.indexOf(c)] >= 3.5 ? '🔑' : undefined)
  const red = g.S === 1 || g.S === 2

  // ----- what the guide says -----
  let title = ''
  let body: ReactNode = null
  if (g.over === 'win') { title = 'You won!'; body = <>You reached the finish card holding your key. Press <B>New game</B> to play another deal.</> }
  else if (g.over) { title = 'You lost'; body = <>{WHY[g.why!]} You had {keyCount(g)}/{RUN} of your key. Tip: <B>eat the cards you need least</B> — keep the ranks that open key cards, and high cards of each suit for fights. Press <B>New game</B> to play again.</> }
  else if (g.step === 'intro') {
    title = 'Welcome — Fallaway, a solo game for one standard deck'
    body = <>
      <div>You explore a map of cards, digging regions for supplies while hostile cards fight back. Build a run of {RUN} of your suit, then reach its Ace. About 15 minutes.</div>
      <Rules />
      <div><B>How this app works:</B> you play with your <B>real deck</B> (52 cards, no Jokers). I tell you exactly what to do on the table, and you tap the cards you turn over. I never deal anything.</div>
      <div className="row"><button className="big" onClick={() => push(nextStep(g))}>Start setup</button></div>
      <div className="muted">One game, same rules for everyone. The better you play, the more often you win, but the deck always has a say.</div>
    </>
  }
  else if (g.step === 'lock') { title = 'Setup 1 — the lock card'; body = <ol className="gl">
    <li>Take the <B>Jokers</B> out (not used). <B>Shuffle</B> the 52 cards well and hold them face-down: this is the deck.</li>
    <li><B>Turn over the top card</B>. If it is an <B>Ace</B>, push it back into the middle of the deck and turn over the next one.</li>
    <li>That is your <B>lock card</B>. Lay it face-up near you: it is the <B>first card of your key row</B>, and its suit is your <B>key suit</B>.</li>
    <li>Tap it in the list below.</li>
  </ol> }
  else if (g.step === 'pack') {
    title = 'Setup 2 — deal your hand'
    body = <ol className="gl">
      <li>Your key suit is {suitTxt(g.S)} (your key needs {RUN} in a row of {SUITS[g.S]} with the {lbl(g.lock!)}, or any other run of {RUN}). A {SUITS[g.S]} card never starts in your hand.</li>
      <li>Look through the deck and <B>take out every {SUITS[g.S]} card</B> (12 of them, A{SUITS[g.S]} included). Set them aside face-down.</li>
      <li>Deal the <B>top {g.start} cards</B> of the rest into your hand, tapping each below.</li>
    </ol>
  }
  else if (g.step === 'grid') {
    title = 'Setup 3 — lay out the map'
    body = <>
      <div>First <B>shuffle the {SUITS[g.S]} cards you set aside back into the deck</B>. Then deal the next <B>9 cards face-down</B> in a square, 3 rows of 3, with a little space between them: your <B>map</B>. Turn the <B>middle</B> card face-up and tap it below: that is where you stand. The rest of the deck ({pileSize(g.start)} cards) is the <B>pile</B>; put it face-down to the right of the map.</div>
      <ul className="gl">
        <li><B>Waiting</B>: an empty spot next to the pile. Key cards you turn over while digging wait here.</li>
        <li><B>GONE</B> (face-up): a spot further away. Everything you eat, spend or lose goes here and never comes back.</li>
        <li><B>Dig row</B>: keep an empty row <B>below the map</B> for the cards you flip while digging.</li>
        <li><B>Key row</B>: your lock card, near you, apart from your hand. Claimed key cards join it.</li>
      </ul>
    </>
  }
  else if (over) { title = `Discard ${over} card${over > 1 ? 's' : ''}`; body = <>Your hand holds at most {g.limit}. Click the card you need least, then put it on the GONE pile.</> }
  else if (need) { title = 'Tell me what you see'; body = <>First do the steps in the green box. Then tap the card in the list below{need.kind === 'cell' && pendingCells(g).length > 1 ? <> (I ask for them one at a time: the outlined spot on the map is the one I want now — click another face-up <B>?</B> spot to enter that one instead)</> : null}. Tapped the wrong card? Press <B>Undo</B>.</> }
  else if (pending?.kind === 'move') { title = `Move ${DIRS[pending.d]}: eat a card`; body = <>Every step costs <B>one card</B> from your hand. Click the card you need least on screen (🔑 = it opens a key card you can see; high cards win fights). Changed your mind? <B>Cancel</B>.</> }
  else if (pending?.kind === 'scout') { title = 'Zoom OUT: pay a card'; body = <>Click one card in your hand on screen to pay. Then you turn every map card face-up.</> }
  else if (found) {
    const d = g.dig!, r = rankLabel(rank(d.found))
    title = `KEY CARD: ${label(d.found)}`
    body = <>
      <div>It does not count as a flip. <B>Take it now</B>: click a <B>glowing</B> {r} in your hand on screen. Your {r} goes to GONE and {lbl(d.found)} goes into your key row.</div>
      <div>Or <B>Leave it</B>: it waits beside the pile and joins the map on your next move. Walk onto it and show any {r} to claim it for free, if it has not fallen off the map by then.</div>
    </>
  } else if (hostile) {
    const d = g.dig!
    title = `HOSTILE: ${label(d.hostile)}`
    body = <>
      <div>{fightSet.size ? <>Beat it with <B>one higher {SUITS[suit(d.hostile)]}</B>: click a <B>glowing</B> card in your hand on screen. Yours goes to GONE, {lbl(d.hostile)} stays in the dig row as loot, and you may keep digging.</> : <>You hold no {SUITS[suit(d.hostile)]} higher than {lbl(d.hostile)}: you must <B>Flee</B>.</>}</div>
      <div>Or <B>Flee</B>: the whole dig row goes to GONE, and the wound takes <B>one random card</B> from your hand.</div>
    </>
  } else if (g.dig) {
    const d = g.dig, hs = suit(g.grid[4].c!)
    title = `Digging ${label(g.grid[4].c!)}: ${d.flips}/${d.depth} flipped`
    body = <>
      <div><B>Flip</B> the next card, or <B>Stop</B> and take the dig row into your hand. Every {suitTxt(hs)} card is hostile: {defenders(g.hand, hs)}.</div>
      <div>Dig all {d.depth} and the region card {lbl(g.grid[4].c!)} joins your hand too.</div>
      {hint && <div className="keyline">Chance the next card is a hostile you cannot beat: <B>{Math.round(100 * bustChance(viewOfG(g), hs))}%</B>.</div>}
    </>
  } else {
    const here = g.grid[4].c
    title = 'Your move'
    body = <>
      <div className="keyline">{keyLine(g)}</div>
      <ul className="gl">
        {g.steps <= 1 && <li><B>On screen:</B> the arrows <B>▲ ▼ ◀ ▶</B> move you (then click the card to eat); the buttons above the map do the rest. Then do the steps in the green box on your real cards. The <B>glowing</B> button is my suggestion.</li>}
        {isKeyCard(g, here) && (canClaim(g)
          ? <li>You stand on the key card {lbl(here!)}. <B>Claim</B> it: show your {lbl(g.hand[claimers(g)[0]])} (you keep it).</li>
          : <li>You stand on the key card {lbl(here!)}: it opens with <B>any {rankLabel(rank(here!))}</B>, and you hold none. Dig to find one.</li>)}
        {canDig(g) && <li><B>Zoom IN</B> on {lbl(here!)} (free): flip its first card, then up to {depthOf(here!)} in all; {suitTxt(suit(here!))} cards are hostile there.</li>}
        {canFinish(g) && <li>Press <B>Finish</B>: you win!</li>}
        {canScout(g) && <li><B>Zoom OUT</B> ({sCost ? 'pay 1 card' : 'free now'}) to turn the whole map face-up.</li>}
        {canMove(g) && <li><B>Move</B>: each step <B>eats one card</B>; the far row goes face-down under the pile.</li>}
        {g.steps < 6 && <li>On screen, the tag under each region says how dangerous it is <B>for your hand</B>: <span className="ctag t-safe inl">safe</span> you can beat most of its hostile cards, <span className="ctag t-risky inl">risky</span> some, <span className="ctag t-deadly inl">deadly</span> few.</li>}
      </ul>
    </>
  }

  return (
    <div className="play">
      <div className="boardcol">
        <div className="topbar">
          <span className="grow" />
          {g.lock !== null && <span className="lock">Key: <b>{RUN}</b> in a row of <b className={red ? 'redtxt' : ''}>{SUITS[g.S]}</b> · finish <b className={red ? 'redtxt' : ''}>A{SUITS[g.S]}</b></span>}
          {g.step === 'play' && <><span className={`stat ${g.hand.length <= 3 ? 'warn' : ''}`}>Hand <b>{g.hand.length}</b>/{g.limit}</span><span className="stat">Pile <b>{g.pile}</b></span></>}
          <button onClick={undo} disabled={history.length < 2}>Undo</button>
          <button onClick={restart}>New game</button>
          <button className={hint ? 'on' : ''} onClick={() => setHint(h => !h)}>Suggestions {hint ? 'on' : 'off'}</button>
        </div>

        {g.lock !== null && (g.step === 'grid' || g.step === 'play') && (
          <div className="tracker">
            <span className="muted">Your {SUITS[g.S]}:</span>
            {Array.from({ length: 12 }, (_, k) => k + 2).map(r => <span key={r} className={`kchip ${whereIs(g, cardOf(r, g.S))}`}>{rankLabel(r)}</span>)}
            <span className={`kchip vault ${whereIs(g, g.vault)}`}>A</span>
            <span className="muted klegend"><i className="kchip pack">in key row</i><i className="kchip table">in sight</i><i className="kchip unknown">hidden</i><i className="kchip gone">gone</i></span>
          </div>
        )}

        {g.todo.length > 0 && !pending && !g.over && (
          <div className="donow">
            <div className="dntitle">Do this on the table now</div>
            <ol className="todo">{g.todo.map((t, i) => <li key={i}>{t}</li>)}</ol>
          </div>
        )}
        <div className="guide wide">
          <div className="gtitle">{title}</div>
          <div className="gbody">{body}</div>
        </div>

        {need && (
          <div className="enter">
            <div className="dntitle">{needTitle(need, g)}</div>
            <Picker disabled={pickDisabled} onPick={onPick} />
          </div>
        )}

        {g.step === 'play' && !g.over && (
          <div className="actions">
            {!g.dig && <>
              <button className={`big ${adv?.kind === 'dig' ? 'glow' : ''}`} disabled={!ready || !canDig(g)} onClick={() => push(dig(g))}>Zoom IN (flip the first card)</button>
              <button className={`big ${adv?.kind === 'claim' ? 'glow' : ''}`} disabled={!ready || !canClaim(g)} onClick={() => push(claim(g))}>Claim key card</button>
              <button className={adv?.kind === 'scout' ? 'glow' : ''} disabled={!ready || !canScout(g)} onClick={zoomOut}>Zoom OUT ({sCost ? 'pay 1' : 'free'})</button>
              <button className={`big ${adv?.kind === 'finish' ? 'glow' : ''}`} disabled={!ready || !canFinish(g)} onClick={() => push(finish(g))}>Finish</button>
            </>}
            {g.dig && <>
              <button className={`big ${adv?.kind === 'flip' ? 'glow' : ''}`} disabled={!canFlip(g)} onClick={() => push(flip(g))}>Flip next ({g.dig.depth - g.dig.flips} left)</button>
              <button className={adv?.kind === 'stop' ? 'glow' : ''} disabled={!canStop(g)} onClick={() => push(stop(g))}>Stop &amp; keep loot</button>
              {g.dig.hostile >= 0 && <button className={adv?.kind === 'flee' ? 'glow' : ''} disabled={!canFlee(g)} onClick={() => push(flee(g))}>Flee (lose loot + 1 random card)</button>}
              {g.dig.found >= 0 && <button className={`big ${adv?.kind === 'leave' ? 'glow' : ''}`} disabled={!canLeave(g)} onClick={() => push(leave(g))}>Leave it waiting</button>}
            </>}
            {pending && <button onClick={() => setPending(null)}>Cancel</button>}
          </div>
        )}

        {g.step !== 'intro' && g.step !== 'lock' && (
          <GuideStage g={g} adv={adv} need={need} cellTarget={cellTarget} hlHand={hlHand} hand={hand} handTag={handTag}
            handClick={i => (handClickable && (!pickSet || pickSet.has(i)) ? () => clickHand(i) : undefined)} handDim={i => !!pickSet && !pickSet.has(i)}
            ready={ready} canMove={canMove(g)} pendingDir={pending?.kind === 'move' ? pending.d : null}
            onArrow={d => setPending({ kind: 'move', d })} onCell={setCellSel} />
        )}
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
