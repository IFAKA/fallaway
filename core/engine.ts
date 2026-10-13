// Zoom — the rules engine: the only implementation of the rules (RULES.md). The app (app/) and the simulator (sim/sim.ts) both play it.
// Pure functions: every action returns a NEW state or null if illegal.

export const SUITS = ['♠', '♥', '♦', '♣'] as const
const RK: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
export const suit = (c: number) => c & 3
export const rank = (c: number) => (c >> 2) + 2
export const isRed = (c: number) => suit(c) === 1 || suit(c) === 2
export const rankLabel = (r: number) => RK[r] ?? String(r)
export const label = (c: number) => rankLabel(rank(c)) + SUITS[suit(c)]
export const cardOf = (r: number, s: number) => (r - 2) * 4 + s

/** one game, no difficulty levels: start with 8 cards, hold at most 10 (careful play wins about half) */
export const START = 8
export const LIMIT = 10
export const RUN = 4 // the key: 4 in a row of the key suit
/** how many cards a dig may flip: low regions (2-5) 3, middle (6-10) 5, high (J-A) 7 */
export const depthOf = (region: number) => (rank(region) <= 5 ? 3 : rank(region) <= 10 ? 5 : 7)
/** a hostile card is beaten by ONE hand card of the same suit and higher rank */
export const beats = (c: number, hostile: number) => suit(c) === suit(hostile) && rank(c) > rank(hostile)

export interface Dig { depth: number; flips: number; loot: number[]; hostile: number; found: number } // hostile -1: none waiting. found -1: no key card to take or leave
export type Why = 'starved' | 'world'
export interface State {
  seed: number; rng: number
  limit: number
  S: number; lock: number; vault: number // key suit, lock card (first card of the key row), finish card (A of the key suit)
  pile: number[]; wait: number[]; gone: number[]; hand: number[]; keys: number[] // pile: top = last. wait: met while digging, dealt first on the next move
  gc: number[]; gup: boolean[]; gdone: number[] // 9 map cells; gc -1 = empty; gdone 0 fresh, 1 explored, 2 cleared/claimed
  dig: Dig | null
  over: null | 'win' | 'lose'; why?: Why
  steps: number
  log: string[]
}

// ---------- rng ----------
function rand(t: State) {
  t.rng = (t.rng + 0x6d2b79f5) >>> 0
  let x = t.rng
  x = Math.imul(x ^ (x >>> 15), x | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296
}
function shuffle<T>(a: T[], t: State) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(t) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const cloneState = (s: State): State => ({
  ...s,
  pile: s.pile.slice(), wait: s.wait.slice(), gone: s.gone.slice(), hand: s.hand.slice(), keys: s.keys.slice(),
  gc: s.gc.slice(), gup: s.gup.slice(), gdone: s.gdone.slice(),
  dig: s.dig && { ...s.dig, loot: s.dig.loot.slice() },
  log: s.log.slice(),
})

/** a card of the key suit that can be claimed (not the lock, not the finish card) */
export const isKeyCard = (s: { S: number; lock: number | null; vault: number }, c: number | null) => c !== null && c >= 0 && suit(c) === s.S && c !== s.vault && c !== s.lock

export function newGame(seed: number): State {
  const t = { rng: seed >>> 0 } as State
  const deck = shuffle([...Array(52).keys()], t)
  const lock = deck.splice(deck.findIndex(c => rank(c) !== 14), 1)[0]
  const S = suit(lock)
  const vault = cardOf(14, S)
  // the starting hand never holds cards of the key suit: set them aside, deal, then shuffle them back in
  const rest = deck.filter(c => suit(c) !== S)
  const hand = rest.splice(0, START)
  const left = shuffle([...rest, ...deck.filter(c => suit(c) === S)], t)
  const s: State = {
    seed, rng: t.rng, limit: LIMIT, S, lock, vault,
    pile: [], wait: [], gone: [], hand, keys: [lock],
    gc: [], gup: Array(9).fill(false), gdone: Array(9).fill(0),
    dig: null, over: null, steps: 0, log: [],
  }
  s.gc = left.splice(0, 9)
  s.pile = left.reverse()
  s.gup[4] = true
  s.log.push(`New game #${seed}. Lock card ${label(lock)}: it starts your key row. Build ${RUN} in a row of ${SUITS[S]}, then stand on the finish card A${SUITS[S]}.`)
  return s
}

// ---------- the key ----------
export interface KeyPlan { ranks: number[]; have: number[]; missing: number[]; dead: boolean }
/** key ranks worth chasing (the best runs still possible), and key ranks visible on the map or waiting */
export function lockWant(s: { S: number; keys: number[]; gone: number[] }, visible: number[]): { want: Set<number>; vis: Set<number>; alive: boolean } {
  const vis = new Set(visible.filter(c => suit(c) === s.S).map(rank))
  const held = new Set(s.keys.map(rank))
  let best = -1
  const runs: { ranks: number[]; sc: number }[] = []
  for (let a = 2; a + RUN - 1 <= 13; a++) {
    const ranks = Array.from({ length: RUN }, (_, k) => a + k)
    if (ranks.some(r => !held.has(r) && s.gone.includes(cardOf(r, s.S)))) continue // a card it needs is gone for good
    const sc = ranks.filter(r => held.has(r)).length + 0.35 * ranks.filter(r => !held.has(r) && vis.has(r)).length
    runs.push({ ranks, sc })
    best = Math.max(best, sc)
  }
  const want = new Set<number>()
  for (const x of runs) if (x.sc >= best - 0.5) for (const r of x.ranks) if (!held.has(r)) want.add(r)
  return { want, vis, alive: runs.length > 0 }
}
export function keyCount(s: { S: number; keys: number[] }): number {
  const held = new Set(s.keys.map(rank))
  let best = 0
  for (let a = 2; a + RUN - 1 <= 13; a++) { let h = 0; for (let r = a; r < a + RUN; r++) if (held.has(r)) h++; best = Math.max(best, h) }
  return best
}
export const hasKey = (s: { S: number; keys: number[] }) => keyCount(s) >= RUN
/** the most promising run: what the key row has, what is missing */
export function keyPlanOf(s: { S: number; keys: number[]; gone: number[] }, visible: number[]): KeyPlan {
  const held = new Set(s.keys.map(rank))
  const vis = new Set(visible.filter(c => suit(c) === s.S).map(rank))
  let best: KeyPlan | null = null
  let bs = -1
  for (let a = 2; a + RUN - 1 <= 13; a++) {
    const ranks = Array.from({ length: RUN }, (_, k) => a + k)
    const have = ranks.filter(r => held.has(r))
    const missing = ranks.filter(r => !held.has(r))
    if (missing.some(r => s.gone.includes(cardOf(r, s.S)))) continue
    const score = have.length * 10 + missing.filter(r => vis.has(r)).length
    if (score > bs) { bs = score; best = { ranks, have, missing, dead: false } }
  }
  return best ?? { ranks: [], have: [], missing: [], dead: true }
}
/** cards on the table the player can see right now (map face-up + waiting) */
export const visibleCards = (s: State) => [...s.gc.filter((c, i) => c >= 0 && s.gup[i]), ...s.wait]
export const keyPlan = (s: State) => keyPlanOf(s, visibleCards(s))

// ---------- hand values (shared with the real-deck guide) ----------
/** keep-value of each card: ranks that open wanted key cards (more if one is in sight), plus fighting strength */
export function keepValsOf(want: Set<number>, vis: Set<number>, hand: number[]): number[] {
  return hand.map(c => 1 + ((rank(c) - 2) / 12) * 0.6 + (want.has(rank(c)) ? (vis.has(rank(c)) ? 3 : 1) : 0))
}
export const keepVals = (s: State, hand = s.hand) => { const { want, vis } = lockWant(s, visibleCards(s)); return keepValsOf(want, vis, hand) }
/** the hand card to give up: lowest keep-value */
export const cheapestIdx = (kv: number[], n = 1) => [...kv.keys()].sort((a, b) => kv[a] - kv[b]).slice(0, n)
/** hand cards that can beat this hostile, cheapest first */
export function fightersOf(hand: number[], kv: number[], hostile: number): number[] {
  return hand.flatMap((c, i) => (beats(c, hostile) ? [i] : [])).sort((a, b) => kv[a] - kv[b])
}
export const fighters = (s: State) => (s.dig && s.dig.hostile >= 0 ? fightersOf(s.hand, keepVals(s), s.dig.hostile) : [])
/** hand cards that can pay for a key card met while digging (same rank), cheapest first */
export function takersOf(hand: number[], kv: number[], found: number): number[] {
  return hand.flatMap((c, i) => (rank(c) === rank(found) ? [i] : [])).sort((a, b) => kv[a] - kv[b])
}
export const takers = (s: State) => (s.dig && s.dig.found >= 0 ? takersOf(s.hand, keepVals(s), s.dig.found) : [])

// ---------- legality ----------
export const overflow = (s: { hand: number[]; limit: number }) => Math.max(0, s.hand.length - s.limit)
const idle = (s: State) => !s.over && !s.dig && !overflow(s)
export const scoutCost = (s: State) => (hasKey(s) ? 0 : 1)
export const canMove = (s: State) => idle(s) && s.hand.length >= 1
export const canDig = (s: State) => {
  const c = s.gc[4]
  return idle(s) && c >= 0 && s.gup[4] && !s.gdone[4] && suit(c) !== s.S && c !== s.vault && s.pile.length > 0
}
export const canScout = (s: State) => idle(s) && s.hand.length >= scoutCost(s) && s.gup.some((u, i) => !u && s.gc[i] >= 0)
/** the hand cards that open the key card you stand on (same rank) */
export const claimers = (s: State) => (isKeyCard(s, s.gc[4]) ? s.hand.flatMap((c, i) => (rank(c) === rank(s.gc[4]) ? [i] : [])) : [])
export const canClaim = (s: State) => idle(s) && claimers(s).length > 0
export const canFinish = (s: State) => idle(s) && s.gc[4] === s.vault && hasKey(s)
const calm = (s: State) => !s.over && !!s.dig && s.dig.hostile < 0 && s.dig.found < 0
export const canFlip = (s: State) => calm(s) && s.dig!.flips < s.dig!.depth && s.pile.length > 0
export const canStop = (s: State) => calm(s) && s.dig!.flips > 0
export const canFight = (s: State, i: number) => !s.over && !!s.dig && s.dig.hostile >= 0 && i >= 0 && i < s.hand.length && beats(s.hand[i], s.dig.hostile)
export const canFlee = (s: State) => !s.over && !!s.dig && s.dig.hostile >= 0
export const canTake = (s: State, i: number) => !s.over && !!s.dig && s.dig.found >= 0 && i >= 0 && i < s.hand.length && rank(s.hand[i]) === rank(s.dig.found)
export const canLeave = (s: State) => !s.over && !!s.dig && s.dig.found >= 0
export const vaultCell = (s: State) => s.gc.findIndex((c, i) => c === s.vault && s.gup[i])

// ---------- actions ----------
export const DIR_NAME = ['up', 'down', 'left', 'right']
/** cells that fall off the map for each move direction, and cells that are dealt new */
export const EDGE = [[6, 7, 8], [0, 1, 2], [2, 5, 8], [0, 3, 6]]
export const INCOMING = [[0, 1, 2], [6, 7, 8], [0, 3, 6], [2, 5, 8]]
/** the cell each move direction brings under your feet */
export const TARGET = [1, 7, 3, 5]
/** the game ends when nothing is possible any more (key-suit cards never reach your hand, so a run can never become impossible) */
function settle(t: State): State {
  t.steps++
  if (t.over || t.dig || overflow(t)) return t
  if (!canMove(t) && !canDig(t) && !canClaim(t) && !canFinish(t)) { // zooming out cannot help an empty hand
    t.over = 'lose'; t.why = 'starved'
    t.log.push('Your hand is empty: you cannot move, and there is nothing to dig or claim here. You lose.')
  }
  return t
}
function spend(t: State, idx: number[]): number[] {
  const cs = [...idx].sort((a, b) => b - a).map(i => t.hand.splice(i, 1)[0])
  t.gone.push(...cs)
  return cs.reverse()
}
const draw = (t: State) => (t.pile.length ? t.pile.pop()! : -1)

/** Move one step: eat one hand card; the far row/column goes face-down under the pile; 3 new cards come in face-down. */
export function move(s: State, d: number, eat: number): State | null {
  if (!canMove(s) || d < 0 || d > 3 || eat < 0 || eat >= s.hand.length) return null
  const t = cloneState(s)
  const [food] = spend(t, [eat])
  const oc = t.gc, ou = t.gup, od = t.gdone
  const nc = Array(9).fill(-1), nu = Array(9).fill(false), nd = Array(9).fill(0)
  const put = (to: number, from: number) => { nc[to] = oc[from]; nu[to] = ou[from]; nd[to] = od[from] }
  if (d === 0) for (let i = 0; i < 6; i++) put(i + 3, i)
  if (d === 1) for (let i = 0; i < 6; i++) put(i, i + 3)
  if (d === 2) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) put(r * 3 + c + 1, r * 3 + c)
  if (d === 3) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) put(r * 3 + c, r * 3 + c + 1)
  const fell = EDGE[d].map(i => oc[i]).filter(c => c >= 0)
  t.pile.unshift(...fell) // face-down under the pile
  for (const i of INCOMING[d]) {
    const waited = t.wait.length > 0 // cards met while digging come back face-up: you have seen them
    const c = waited ? t.wait.shift()! : draw(t)
    if (c < 0) { t.over = 'lose'; t.why = 'world'; t.log.push('The pile is empty: there is no world left to walk into. You lose.'); return settle(t) }
    nc[i] = c; nu[i] = waited
  }
  t.gc = nc; t.gup = nu; t.gdone = nd
  t.gup[4] = t.gc[4] >= 0
  t.log.push(`Move ${DIR_NAME[d]} (eat ${label(food)}): you stand on ${t.gc[4] >= 0 ? label(t.gc[4]) : 'an empty spot'}.`)
  return settle(t)
}
/** Zoom OUT: turn the whole map face-up (1 card; free once you hold your key). */
export function scout(s: State, pay: number[]): State | null {
  if (!canScout(s) || pay.length !== scoutCost(s) || new Set(pay).size !== pay.length || pay.some(i => i < 0 || i >= s.hand.length)) return null
  const t = cloneState(s)
  const cs = spend(t, pay)
  t.gup = t.gc.map(c => c >= 0)
  t.log.push(cs.length ? `Zoom OUT (pay ${cs.map(label).join(' + ')}): the whole map turns face-up.` : 'Zoom OUT (free: you hold your key): the whole map turns face-up.')
  return settle(t)
}
/** Zoom IN: start digging the region you stand on (free) by flipping its first card. Cards of its suit are hostile here. */
export function dig(s: State): State | null {
  if (!canDig(s)) return null
  const t = cloneState(s)
  const r = t.gc[4]
  t.dig = { depth: depthOf(r), flips: 0, loot: [], hostile: -1, found: -1 }
  t.log.push(`Zoom IN on ${label(r)}: dig up to ${t.dig.depth} cards; ${SUITS[suit(r)]} cards are hostile here.`)
  turnOver(t)
  return settle(t)
}
function endDig(t: State, cleared: boolean) {
  const d = t.dig!
  t.hand.push(...d.loot)
  if (cleared) { t.hand.push(t.gc[4]); t.gc[4] = -1; t.gdone[4] = 2 } else t.gdone[4] = 1
  t.dig = null
}
/** Flip the next card of the dig. Key cards and the finish card do not count: they wait beside the pile, or you take a key card now by paying a card of its rank. */
export function flip(s: State): State | null {
  if (!canFlip(s)) return null
  const t = cloneState(s)
  turnOver(t)
  return settle(t)
}
function turnOver(t: State) {
  const d = t.dig!
  let c = draw(t)
  while (c >= 0 && suit(c) === t.S) {
    if (isKeyCard(t, c) && t.hand.some(x => rank(x) === rank(c))) {
      d.found = c
      t.log.push(`  Flip ${label(c)}: a key card! Take it now (pay any ${rankLabel(rank(c))}), or leave it waiting.`)
      return
    }
    t.wait.push(c)
    t.log.push(`  Flip ${label(c)}: ${c === t.vault ? 'the finish card' : 'a key card'}! It waits beside the pile and joins the map on your next move.`)
    c = draw(t)
  }
  if (c < 0) { endDig(t, false); t.log.push('  The pile is empty: the dig ends and you keep the loot.'); return }
  d.flips++
  if (suit(c) === suit(t.gc[4])) { d.hostile = c; t.log.push(`  Flip ${label(c)}: HOSTILE! Beat it with a higher ${SUITS[suit(c)]}, or flee.`); return }
  d.loot.push(c)
  t.log.push(`  Flip ${label(c)}: loot.`)
  if (d.flips >= d.depth) { const r = t.gc[4]; endDig(t, true); t.log.push(`  You dug to the bottom: the loot and the region card ${label(r)} join your hand.`) }
}
/** Beat the hostile card with ONE higher card of its suit: yours is spent, the hostile joins the loot. */
export function fight(s: State, i: number): State | null {
  if (!canFight(s, i)) return null
  const t = cloneState(s)
  const d = t.dig!, h = d.hostile
  const [c] = spend(t, [i])
  d.loot.push(h); d.hostile = -1
  t.log.push(`  Beat ${label(h)} with ${label(c)}: it joins your loot.`)
  if (d.flips >= d.depth) { const r = t.gc[4]; endDig(t, true); t.log.push(`  You dug to the bottom: the loot and the region card ${label(r)} join your hand.`) }
  return settle(t)
}
/** Flee: the dig's loot and the hostile card are lost, and it wounds you: one random hand card is lost too. `wound` = which card (index), for the real-deck guide; default random. */
export function flee(s: State, wound?: number): State | null {
  if (!canFlee(s)) return null
  const t = cloneState(s)
  const d = t.dig!
  const lost = [...d.loot, d.hostile]
  t.gone.push(...lost)
  const w = t.hand.length ? (wound !== undefined && wound >= 0 && wound < t.hand.length ? wound : Math.floor(rand(t) * t.hand.length)) : -1
  const hurt = w >= 0 ? spend(t, [w]) : []
  t.gdone[4] = 1; t.dig = null
  t.log.push(`  Flee from ${label(d.hostile)}: lose the loot${d.loot.length ? ` (${d.loot.map(label).join(' ')})` : ''}${hurt.length ? `, and it wounds you: lose ${label(hurt[0])}` : ''}.`)
  return settle(t)
}
/** Take the key card just met while digging: pay hand card i (same rank) to GONE; the key card joins your key row. Then flip again. */
export function take(s: State, i: number): State | null {
  if (!canTake(s, i)) return null
  const t = cloneState(s)
  const k = t.dig!.found
  const [c] = spend(t, [i])
  t.keys.push(k); t.dig!.found = -1
  t.log.push(`  Take ${label(k)}: pay ${label(c)}. Key row: ${[...t.keys].sort((a, b) => rank(a) - rank(b)).map(label).join(' ')}.`)
  turnOver(t)
  return settle(t)
}
/** Leave the key card just met: it waits beside the pile and joins the map on your next move. Then flip again. */
export function leave(s: State): State | null {
  if (!canLeave(s)) return null
  const t = cloneState(s)
  const k = t.dig!.found
  t.wait.push(k); t.dig!.found = -1
  t.log.push(`  Leave ${label(k)}: it waits beside the pile and joins the map on your next move.`)
  turnOver(t)
  return settle(t)
}
/** Stop digging: the loot joins your hand; the region is explored. */
export function stop(s: State): State | null {
  if (!canStop(s)) return null
  const t = cloneState(s)
  const n = t.dig!.loot.length
  endDig(t, false)
  t.log.push(`  Stop digging: ${n} card${n === 1 ? '' : 's'} join${n === 1 ? 's' : ''} your hand.`)
  return settle(t)
}
/** Show a hand card of the same rank (you keep it): the key card you stand on moves to your key row. */
export function claim(s: State): State | null {
  if (!canClaim(s)) return null
  const t = cloneState(s)
  const k = t.gc[4]
  const shown = t.hand[claimers(t)[0]]
  t.keys.push(k)
  t.gc[4] = -1; t.gdone[4] = 2
  t.log.push(`Claim ${label(k)}: show ${label(shown)} (you keep it). Key row: ${[...t.keys].sort((a, b) => rank(a) - rank(b)).map(label).join(' ')}.`)
  return settle(t)
}
export function finish(s: State): State | null {
  if (!canFinish(s)) return null
  const t = cloneState(s)
  t.over = 'win'
  t.log.push('You stand on the finish card holding your key: YOU WIN!')
  return settle(t)
}
export function discard(s: State, i: number): State | null {
  if (s.over || s.dig || !overflow(s) || i < 0 || i >= s.hand.length) return null
  const t = cloneState(s)
  const [c] = spend(t, [i])
  t.log.push(`Hand over ${t.limit}: discard ${label(c)}.`)
  return settle(t)
}

// ---------- advisor (the simulator's careful bot, ~54% wins; it only uses what the player can see) ----------
export type Advice =
  | { kind: 'move'; d: number; eat: number } | { kind: 'scout'; pay: number[] } | { kind: 'dig' } | { kind: 'flip' } | { kind: 'stop' }
  | { kind: 'fight'; i: number } | { kind: 'flee' } | { kind: 'take'; i: number } | { kind: 'leave' } | { kind: 'discard'; i: number } | { kind: 'claim' } | { kind: 'finish' }
export interface Tip { advice: Advice; text: string }

/** What the advisor needs to know: the same public view for the on-screen game and the real-deck guide. Unknown map cells are -2. */
export interface View {
  S: number; lock: number; vault: number; limit: number
  hand: number[]; keys: number[]; gone: number[]; wait: number[]
  gc: number[]; gdone: number[] // gc: -1 empty, -2 face-down
  dig: Dig | null; region: number; pile: number
}
export function viewOf(s: State): View {
  return {
    S: s.S, lock: s.lock, vault: s.vault, limit: s.limit, hand: s.hand, keys: s.keys, gone: s.gone, wait: s.wait,
    gc: s.gc.map((c, i) => (c < 0 ? -1 : s.gup[i] ? c : -2)), gdone: s.gdone, dig: s.dig, region: s.gc[4], pile: s.pile.length,
  }
}
const visOf = (v: View) => [...v.gc.filter(c => c >= 0), ...v.wait]
/** chance the next flip is hostile, and the hostile cards it could be (any card not visible right now) */
export function hostileOdds(v: View, hs: number): { p: number; hos: number[] } {
  const known = new Set([v.lock, ...v.hand, ...v.keys, ...v.gone, ...v.wait, ...v.gc.filter(c => c >= 0), ...(v.dig ? [...v.dig.loot, v.dig.hostile] : [])])
  let n = 0
  const hos: number[] = []
  for (let c = 0; c < 52; c++) {
    if (known.has(c) || suit(c) === v.S) continue // key-suit cards never stay in a dig
    n++
    if (suit(c) === hs) hos.push(c)
  }
  return { p: n ? hos.length / n : 0, hos }
}
/** chance the next flip is a hostile card you cannot beat (you would have to flee) */
export function bustChance(v: View, hs: number): number {
  const { p, hos } = hostileOdds(v, hs)
  return hos.length ? (p * hos.filter(h => !v.hand.some(c => beats(c, h))).length) / hos.length : 0
}
/** how safe a region of suit hs is for your hand: the share of its possible hostile cards you could beat (1 = no danger) */
export function safetyOf(v: View, hs: number): number {
  const { hos } = hostileOdds(v, hs)
  return hos.length ? hos.filter(h => v.hand.some(c => beats(c, h))).length / hos.length : 1
}
/** the danger tag of a region: how well your hand fights its hostile suit */
export type Danger = 'safe' | 'risky' | 'deadly'
export const dangerOf = (v: View, hs: number): Danger => { const x = safetyOf(v, hs); return x >= 0.75 ? 'safe' : x >= 0.4 ? 'risky' : 'deadly' }
const timeVal = (v: View) => 0.04 + 0.5 * Math.max(0, ((RUN - keyCount(v)) * 6 + 6) / Math.max(4, v.pile) - 0.6)

/** what flipping the next dig card is worth: the loot it may bring, against a hostile you must pay for or flee from (losing atRisk) */
function flipValue(v: View, kv: number[], hs: number, atRisk: number, lastCard: boolean) {
  const { p, hos } = hostileOdds(v, hs)
  const beatable = hos.filter(h => fightersOf(v.hand, kv, h).length)
  const winP = hos.length ? beatable.length / hos.length : 1
  const fightCost = beatable.length ? beatable.reduce((a, h) => a + kv[fightersOf(v.hand, kv, h)[0]], 0) / beatable.length : 0
  const last = lastCard ? 1.6 : 0
  const hostileOutcome = winP * Math.max(1.3 + last - fightCost, -atRisk - 0.2) + (1 - winP) * (-atRisk - 1.4)
  return { ev: (1 - p) * (1.3 + last) + p * hostileOutcome - timeVal(v), bust: Math.round(100 * p * (1 - winP)) }
}
export function adviseView(v: View): Tip | null {
  const { want, vis } = lockWant(v, visOf(v))
  const kv = keepValsOf(want, vis, v.hand)
  const lootVal = (cs: number[]) => (cs.length ? keepValsOf(want, vis, [...v.hand, ...cs]).slice(v.hand.length).reduce((a, x) => a + x, 0) : 0)
  const name = (i: number) => label(v.hand[i])
  if (v.dig) {
    const d = v.dig, hs = suit(v.region)
    if (d.found >= 0) {
      const f = takersOf(v.hand, kv, d.found)
      return want.has(rank(d.found)) && f.length
        ? { advice: { kind: 'take', i: f[0] }, text: `Take ${label(d.found)} now: pay your ${name(f[0])}. Your key needs it, and a key card on the map can fall off before you reach it.` }
        : { advice: { kind: 'leave' }, text: `Leave ${label(d.found)} waiting: your key does not need it, so keep your ${rankLabel(rank(d.found))}.` }
    }
    if (d.hostile >= 0) {
      const f = fightersOf(v.hand, kv, d.hostile)
      const keep = lootVal([...d.loot, d.hostile]) + (d.flips >= d.depth ? lootVal([v.region]) : 0)
      const wound = v.hand.length ? kv.reduce((a, x) => a + x, 0) / v.hand.length : 0
      if (f.length && kv[f[0]] < keep + wound + 0.6) return { advice: { kind: 'fight', i: f[0] }, text: `Beat ${label(d.hostile)} with your ${name(f[0])}: it is the ${SUITS[hs]} card you need least, and you keep the loot.` }
      return { advice: { kind: 'flee' }, text: f.length ? `Flee: beating ${label(d.hostile)} would cost your ${name(f[0])}, worth more than this loot.` : `Flee: you hold no ${SUITS[hs]} higher than ${label(d.hostile)}.` }
    }
    if (d.flips >= d.depth || !v.pile) return { advice: { kind: 'stop' }, text: 'Stop: nothing left to flip.' }
    const last = d.flips + 1 >= d.depth
    const { ev, bust } = flipValue(v, kv, hs, lootVal(d.loot), last)
    return ev > 0.05
      ? { advice: { kind: 'flip' }, text: `Flip another card: ${bust}% chance of a hostile you cannot beat${last ? ', and the last card wins you the region card too' : ''}.` }
      : { advice: { kind: 'stop' }, text: `Stop and keep your ${d.loot.length} loot: the next flip has a ${bust}% chance of a hostile you cannot beat.` }
  }
  if (overflow(v)) { const i = cheapestIdx(kv)[0]; return { advice: { kind: 'discard', i }, text: `Your hand is over ${v.limit}: discard ${name(i)}, the card you need least.` } }
  const here = v.region
  const keyed = hasKey(v)
  const vi = v.gc.findIndex(c => c === v.vault)
  if (here === v.vault && keyed) return { advice: { kind: 'finish' }, text: 'You stand on the finish card holding your key: finish the game!' }
  const claimHere = here >= 0 && isKeyCard(v, here) && v.hand.some(c => rank(c) === rank(here))
  if (claimHere && want.has(rank(here))) return { advice: { kind: 'claim' }, text: `Claim ${label(here)}: show any ${rankLabel(rank(here))} (you keep it).` }
  const down = v.gc.filter(c => c === -2).length
  if (keyed && vi < 0 && down) return { advice: { kind: 'scout', pay: [] }, text: 'Zoom out (free now that you hold your key) to look for the finish card.' }
  const digHere = here >= 0 && v.gc[4] >= 0 && !v.gdone[4] && suit(here) !== v.S && here !== v.vault && v.pile > 0
  if (digHere && (!keyed || !v.hand.length) && (!v.hand.length || flipValue(v, kv, suit(here), 0, depthOf(here) <= 1).ev > 0.05)) { // zooming in flips the first card
    const st = SUITS[suit(here)], dz = dangerOf(v, suit(here))
    const why = dz === 'safe' ? `and your hand beats most ${st} cards`
      : dz === 'risky' ? `but your hand beats only some ${st} cards: stop early if the odds turn`
      : `but it is deadly for your hand (you beat few ${st} cards): follow the flip odds and stop early`
    return { advice: { kind: 'dig' }, text: `Zoom in on ${label(here)} and flip its first card: digging is free, ${why}.` }
  }
  if (!keyed && down >= 6 && v.hand.length >= 4) { const i = cheapestIdx(kv)[0]; return { advice: { kind: 'scout', pay: [i] }, text: `Zoom out (pay ${name(i)}) to see the whole map before you walk.` } }
  if (!v.hand.length) return claimHere ? { advice: { kind: 'claim' }, text: `Claim ${label(here)}.` } : null
  return adviseMove(v)
}
/** the advisor's step: value the cell you step on and the line you face, minus what falls off behind you; eat the card you need least */
export function adviseMove(v: View): Tip | null {
  if (!v.hand.length) return null
  const { want, vis } = lockWant(v, visOf(v))
  const kv = keepValsOf(want, vis, v.hand)
  const keyed = hasKey(v)
  const vi = v.gc.findIndex(c => c === v.vault)
  const cell = (i: number) => {
    const c = v.gc[i]
    if (c === -1) return 0
    if (c === -2) return 2.2
    if (c === v.vault) return keyed ? 900 : keyCount(v) >= RUN - 1 ? 6 : 1
    if (isKeyCard(v, c)) return !want.has(rank(c)) ? 0.3 : v.hand.some(x => rank(x) === rank(c)) ? 40 : 4
    if (v.gdone[i]) return 0.2
    return 1.5 + 0.9 * depthOf(c) + 2 * depthOf(c) * (safetyOf(v, suit(c)) - 0.5) // deep regions you can fight in are worth the walk
  }
  const AHEAD = [[0, 1, 2], [6, 7, 8], [0, 3, 6], [2, 5, 8]]
  let best = 0, bs = -Infinity
  for (let d = 0; d < 4; d++) {
    let sc = cell(TARGET[d]) + 0.3 * AHEAD[d].reduce((a, i) => a + cell(i), 0) - 0.45 * EDGE[d].reduce((a, i) => a + cell(i), 0)
    if (keyed && vi >= 0) { const r = Math.floor(vi / 3), c = vi % 3; if ((d === 0 && r < 1) || (d === 1 && r > 1) || (d === 2 && c < 1) || (d === 3 && c > 1)) sc += 100 }
    if (sc > bs + 1e-9) { bs = sc; best = d }
  }
  const eat = cheapestIdx(kv)[0]
  const tc = v.gc[TARGET[best]]
  return { advice: { kind: 'move', d: best, eat }, text: `Move ${DIR_NAME[best]}${tc >= 0 ? ` to ${label(tc)}` : ' into the unknown'}${keyed && vi >= 0 ? ' (toward the finish card)' : ''}, eating your ${label(v.hand[eat])} (the card you need least).` }
}
export const advise = (s: State): Tip | null => (s.over ? null : adviseView(viewOf(s)))

/** Apply a tip's advice to the state (used by the "do it" button and the smoke test). */
export function applyAdvice(s: State, a: Advice): State | null {
  switch (a.kind) {
    case 'move': return move(s, a.d, a.eat)
    case 'scout': return scout(s, a.pay)
    case 'dig': return dig(s)
    case 'flip': return flip(s)
    case 'stop': return stop(s)
    case 'fight': return fight(s, a.i)
    case 'flee': return flee(s)
    case 'take': return take(s, a.i)
    case 'leave': return leave(s)
    case 'discard': return discard(s, a.i)
    case 'claim': return claim(s)
    case 'finish': return finish(s)
  }
}

/** Every legal action right now (for the simulator's bots). */
export function legalActions(s: State): Advice[] {
  const out: Advice[] = []
  const hand = [...s.hand.keys()]
  if (canFlip(s)) out.push({ kind: 'flip' })
  if (canStop(s)) out.push({ kind: 'stop' })
  for (const i of hand) if (canFight(s, i)) out.push({ kind: 'fight', i })
  if (canFlee(s)) out.push({ kind: 'flee' })
  for (const i of hand) if (canTake(s, i)) out.push({ kind: 'take', i })
  if (canLeave(s)) out.push({ kind: 'leave' })
  if (!s.over && !s.dig && overflow(s)) for (const i of hand) out.push({ kind: 'discard', i })
  if (canFinish(s)) out.push({ kind: 'finish' })
  if (canClaim(s)) out.push({ kind: 'claim' })
  if (canDig(s)) out.push({ kind: 'dig' })
  if (canScout(s)) { if (scoutCost(s)) for (const i of hand) out.push({ kind: 'scout', pay: [i] }); else out.push({ kind: 'scout', pay: [] }) }
  if (canMove(s)) for (let d = 0; d < 4; d++) for (const eat of hand) out.push({ kind: 'move', d, eat })
  return out
}

/** Where is each card of the key suit? For the "your suit" tracker. 'pack' means in the key row. */
export type Where = 'pack' | 'gone' | 'table' | 'vault' | 'unknown'
export function whereIs(s: State, c: number): Where {
  if (s.keys.includes(c)) return 'pack'
  if (s.gone.includes(c)) return 'gone'
  if (s.gc.some((x, i) => x === c && s.gup[i]) || s.wait.includes(c)) return 'table'
  return c === s.vault ? 'vault' : 'unknown'
}
