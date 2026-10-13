// Fallaway — guide engine for playing with a REAL deck. The app never deals: the player flips physical cards and ENTERS what they see.
// Face-down cards are unknown to the app (cell.c === null). Every action returns a new state with `todo`: the physical steps to perform.
// The rules are the same as ../../core/engine.ts (scripts/guide-smoke.ts checks that both stay identical).
import {
  DIR_NAME, EDGE, INCOMING, LIMIT, RUN, START, SUITS, adviseView, beats, cardOf, depthOf, hasKey, isKeyCard, keepValsOf, keyCount, keyPlanOf, label, lockWant,
  rank, rankLabel, suit,
} from '../../core/engine'
import type { Dig, KeyPlan, Tip, View, Why } from '../../core/engine'

export interface Cell { id: number; c: number | null; up: boolean; done: 0 | 1 | 2; gap: boolean }
export type Step = 'intro' | 'lock' | 'pack' | 'grid' | 'play'
export interface G {
  step: Step
  start: number; limit: number
  lock: number | null; S: number; vault: number
  hand: number[]; keys: number[]; gone: number[]; wait: number[]
  grid: Cell[]
  dig: (Dig & { asking: boolean }) | null // asking: a flip was requested and the card must be entered
  wound: boolean // after fleeing: the player must enter the random card they lost
  pile: number
  over: null | 'win' | 'lose'; why?: Why
  todo: string[]; log: string[]; steps: number
}
export type Need = { kind: 'lock' } | { kind: 'pack'; left: number } | { kind: 'cell'; i: number } | { kind: 'flip' } | { kind: 'wound' }

let nextId = 1
const blank = (): Cell => ({ id: nextId++, c: null, up: false, done: 0, gap: false })
/** Saved games: keep new cell ids above the saved ones. */
export function fixIds(h: G[]): G[] {
  h.forEach(g => g.grid.forEach(c => { nextId = Math.max(nextId, c.id + 1) }))
  return h
}
/** cards in the pile once the map is dealt: 52 - lock - hand - 9 map cards */
export const pileSize = (start: number) => 52 - 1 - start - 9
export const newG = (): G => ({
  step: 'intro', start: START, limit: LIMIT, lock: null, S: 0, vault: 48,
  hand: [], keys: [], gone: [], wait: [], grid: Array.from({ length: 9 }, blank), dig: null, wound: false,
  pile: pileSize(START), over: null, todo: [], log: [], steps: 0,
})
const clone = (g: G): G => ({
  ...g, hand: g.hand.slice(), keys: g.keys.slice(), gone: g.gone.slice(), wait: g.wait.slice(), grid: g.grid.map(c => ({ ...c })),
  dig: g.dig && { ...g.dig, loot: g.dig.loot.slice() },
  todo: [], log: g.log.slice(),
})
const lk = (g: G) => ({ S: g.S, lock: g.lock, vault: g.vault })

// ---------- derived ----------
export const overflow = (g: G) => Math.max(0, g.hand.length - g.limit)
export function knownCards(g: G): number[] {
  return [...(g.lock !== null ? [g.lock] : []), ...g.hand, ...g.gone, ...g.keys, ...g.wait, ...g.grid.flatMap(c => (c.c !== null ? [c.c] : [])),
    ...(g.dig ? [...g.dig.loot, ...(g.dig.hostile >= 0 ? [g.dig.hostile] : []), ...(g.dig.found >= 0 ? [g.dig.found] : [])] : [])]
}
export function needOf(g: G): Need | null {
  if (g.over) return null
  if (g.step === 'lock') return { kind: 'lock' }
  if (g.step === 'pack') return { kind: 'pack', left: g.start - g.hand.length }
  if (g.step === 'grid') return { kind: 'cell', i: 4 }
  if (g.wound) return { kind: 'wound' }
  if (g.dig?.asking) return { kind: 'flip' }
  const i = g.grid.findIndex(c => c.up && c.c === null && !c.gap)
  return i >= 0 ? { kind: 'cell', i } : null
}
export const pendingCells = (g: G) => g.grid.flatMap((c, i) => (c.up && c.c === null && !c.gap ? [i] : []))
const busy = (g: G) => g.step !== 'play' || !!g.over || !!needOf(g)
const idle = (g: G) => !busy(g) && !g.dig && !overflow(g)
export const visibleOf = (g: G) => [...g.grid.flatMap(c => (c.up && c.c !== null ? [c.c] : [])), ...g.wait]
export const keyPlan = (g: G): KeyPlan => keyPlanOf(g, visibleOf(g))
export const scoutCost = (g: G) => (hasKey(g) ? 0 : 1)
export const canMove = (g: G) => idle(g) && g.hand.length >= 1
export const canDig = (g: G) => { const x = g.grid[4]; return idle(g) && !x.gap && x.up && x.c !== null && !x.done && suit(x.c) !== g.S && x.c !== g.vault && g.pile > 0 }
export const canScout = (g: G) => idle(g) && g.hand.length >= scoutCost(g) && g.grid.some(c => !c.up && !c.gap)
export const claimers = (g: G) => { const c = g.grid[4].c; return isKeyCard(lk(g), c) ? g.hand.flatMap((x, i) => (rank(x) === rank(c!) ? [i] : [])) : [] }
export const canClaim = (g: G) => idle(g) && claimers(g).length > 0
export const canFinish = (g: G) => idle(g) && g.grid[4].c === g.vault && hasKey(g)
const calm = (g: G) => !busy(g) && !!g.dig && g.dig.hostile < 0 && g.dig.found < 0
export const canFlip = (g: G) => calm(g) && g.dig!.flips < g.dig!.depth && g.pile > 0
export const canStop = (g: G) => calm(g) && g.dig!.flips > 0
export const canFight = (g: G, i: number) => !busy(g) && !!g.dig && g.dig.hostile >= 0 && i >= 0 && i < g.hand.length && beats(g.hand[i], g.dig.hostile)
export const canFlee = (g: G) => !busy(g) && !!g.dig && g.dig.hostile >= 0
export const canTake = (g: G, i: number) => !busy(g) && !!g.dig && g.dig.found >= 0 && i >= 0 && i < g.hand.length && rank(g.hand[i]) === rank(g.dig.found)
export const canLeave = (g: G) => !busy(g) && !!g.dig && g.dig.found >= 0
export const fighters = (g: G) => (g.dig && g.dig.hostile >= 0 ? g.hand.flatMap((c, i) => (beats(c, g.dig!.hostile) ? [i] : [])) : [])
/** hand cards that can pay for the key card met while digging (same rank) */
export const takers = (g: G) => (g.dig && g.dig.found >= 0 ? g.hand.flatMap((c, i) => (rank(c) === rank(g.dig!.found) ? [i] : [])) : [])
/** keep-value of each hand card (same numbers as the advisor) */
export function handVals(g: G): number[] { const { want, vis } = lockWant(g, visibleOf(g)); return keepValsOf(want, vis, g.hand) }

export type Where = 'pack' | 'gone' | 'table' | 'vault' | 'unknown'
export function whereIs(g: G, c: number): Where {
  if (g.step !== 'play' && g.step !== 'grid') return 'unknown'
  if (g.keys.includes(c)) return 'pack'
  if (g.gone.includes(c)) return 'gone'
  if (g.grid.some(x => x.c === c && x.up) || g.wait.includes(c)) return 'table'
  return c === g.vault ? 'vault' : 'unknown'
}

// ---------- end of game (same checks as the engine) ----------
function settle(t: G): G {
  t.steps++
  if (t.over || t.dig || t.wound || overflow(t) || needOf(t)) return t
  if (!canMove(t) && !canDig(t) && !canClaim(t) && !canFinish(t)) {
    t.over = 'lose'; t.why = 'starved'
    t.log.push('Your hand is empty: you cannot move, and there is nothing to dig or claim here. You lose.')
  }
  return t
}
const spendIdx = (t: G, idx: number[]) => [...idx].sort((a, b) => b - a).map(i => t.hand.splice(i, 1)[0]).reverse().map(c => { t.gone.push(c); return c })
const names = (cs: number[]) => cs.map(label).join(' + ')

// ---------- setup ----------
/** leave the welcome screen */
export function nextStep(g: G): G | null {
  if (g.step !== 'intro') return null
  const t = clone(g)
  t.step = 'lock'
  return t
}
export function setLock(g: G, c: number): G | null {
  if (g.step !== 'lock' || rank(c) === 14) return null
  const t = clone(g)
  t.lock = c; t.S = suit(c); t.vault = cardOf(14, t.S); t.keys = [c]; t.step = 'pack'
  t.log.push(`Lock card ${label(c)}: it starts your key row. Build ${RUN} in a row of ${SUITS[t.S]}; the finish card is A${SUITS[t.S]}.`)
  return t
}
export function enterPack(g: G, c: number): G | null {
  if (g.step !== 'pack' || g.hand.length >= g.start) return null
  const t = clone(g)
  if (suit(c) === t.S) { // cards of the key suit never start in your hand
    t.todo = [`${label(c)} is a ${SUITS[t.S]} card (your key suit): it cannot start in your hand. Put it with the other ${SUITS[t.S]} cards you set aside, and deal your hand from the rest.`]
    return t
  }
  t.hand.push(c)
  if (t.hand.length === t.start) { t.step = 'grid'; t.grid[4] = { ...blank(), up: true } }
  return t
}
export function enterCell(g: G, i: number, c: number): G | null {
  const cell = g.grid[i]
  if (!cell.up || cell.c !== null || cell.gap || knownCards(g).includes(c)) return null
  const t = clone(g)
  t.grid[i].c = c
  if (g.step === 'grid') { t.step = 'play'; t.pile = pileSize(t.start); t.log.push('The game begins.') }
  else if (pendingCells(t).length) t.todo = g.todo // still flipping (zoom out): keep the instructions on screen
  return settle(t)
}

// ---------- actions ----------
export function move(g: G, d: number, eat: number): G | null {
  if (!canMove(g) || d < 0 || d > 3 || eat < 0 || eat >= g.hand.length) return null
  const t = clone(g)
  const [food] = spendIdx(t, [eat])
  const old = g.grid
  const nu: (Cell | null)[] = Array(9).fill(null)
  if (d === 0) for (let i = 0; i < 6; i++) nu[i + 3] = old[i]
  if (d === 1) for (let i = 0; i < 6; i++) nu[i] = old[i + 3]
  if (d === 2) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) nu[r * 3 + c + 1] = old[r * 3 + c]
  if (d === 3) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) nu[r * 3 + c] = old[r * 3 + c + 1]
  const fell = EDGE[d].filter(i => !old[i].gap).length
  t.pile += fell
  const words = ['UP', 'DOWN', 'LEFT', 'RIGHT'][d]
  const outgoing = ['BOTTOM row', 'TOP row', 'RIGHT column', 'LEFT column'][d]
  const incoming = ['TOP row', 'BOTTOM row', 'LEFT column', 'RIGHT column'][d]
  const slide = ['down', 'up', 'right', 'left'][d]
  const order = d < 2 ? 'left to right' : 'top to bottom'
  const deal: string[] = []
  const waited: number[] = []
  let world = false
  for (const i of INCOMING[d]) {
    if (t.wait.length) { const c = t.wait.shift()!; waited.push(c); nu[i] = { ...blank(), c, up: true } }
    else if (t.pile > 0) { t.pile--; nu[i] = blank() }
    else { world = true; nu[i] = { ...blank(), gap: true } }
  }
  if (waited.length) deal.push(`Put the waiting card${waited.length > 1 ? 's' : ''} ${names(waited)} FACE-UP into the ${incoming} first (${order}).`)
  const fromPile = INCOMING[d].length - waited.length - (world ? 1 : 0)
  if (fromPile > 0) deal.push(`Deal ${fromPile} card${fromPile > 1 ? 's' : ''} FACE-DOWN from the top of the pile into ${waited.length ? 'the rest of ' : ''}the ${incoming} (${order}).`)
  t.grid = nu.map(c => c ?? { ...blank(), gap: true })
  t.todo = [
    `Eat ${label(food)}: put it face-up on the GONE pile.`,
    `Move ${words}: pick up the ${outgoing}${fell ? ` (${fell} card${fell > 1 ? 's' : ''})` : ''} and put ${fell === 1 ? 'it' : 'them'} FACE-DOWN UNDER the pile.`,
    `Slide the other cards one place ${slide}, so the ${incoming} is empty. Keep each card as it is (face-up stays face-up, sideways stays sideways, empty spots move too).`,
    ...deal,
  ]
  if (world) {
    t.over = 'lose'; t.why = 'world'
    t.log.push('The pile is empty: there is no world left to walk into. You lose.')
    return settle(t)
  }
  if (!t.grid[4].gap && !t.grid[4].up) { t.grid[4].up = true; t.todo.push('Turn the MIDDLE card face-up and tap it in the list below.') }
  else t.todo.push(t.grid[4].gap ? 'The middle spot is empty. You stand there.' : `You stand on ${label(t.grid[4].c!)} (already face-up).`)
  t.log.push(`Move ${DIR_NAME[d]} (eat ${label(food)}).`)
  return settle(t)
}
export function scout(g: G, pay: number[]): G | null {
  if (!canScout(g) || pay.length !== scoutCost(g) || new Set(pay).size !== pay.length || pay.some(i => i < 0 || i >= g.hand.length)) return null
  const t = clone(g)
  const cs = spendIdx(t, pay)
  let flipped = 0
  t.grid.forEach(x => { if (!x.up && !x.gap) { x.up = true; flipped++ } })
  t.todo = [...(cs.length ? [`Put ${names(cs)} face-up on the GONE pile.`] : []), `Turn all ${flipped} face-down map cards face-up (leave them where they are) and tap each one in the list below.`]
  t.log.push(cs.length ? `Zoom OUT (pay ${names(cs)}).` : 'Zoom OUT (free: you hold your key).')
  return settle(t)
}
export function dig(g: G): G | null {
  if (!canDig(g)) return null
  const t = clone(g)
  const r = t.grid[4].c!
  t.dig = { depth: depthOf(r), flips: 0, loot: [], hostile: -1, found: -1, asking: true }
  t.todo = [`Zoom IN on ${label(r)}: you may flip up to ${t.dig.depth} cards from the pile, one at a time, into a row BELOW the map (the dig row). Every ${SUITS[suit(r)]} card you flip is HOSTILE.`, 'Turn over the TOP card of the pile now and tap it in the list below.']
  t.log.push(`Zoom IN on ${label(r)}: dig up to ${t.dig.depth}; ${SUITS[suit(r)]} cards are hostile here.`)
  return settle(t)
}
export function flip(g: G): G | null {
  if (!canFlip(g)) return null
  const t = clone(g)
  t.dig!.asking = true
  t.todo = ['Turn over the TOP card of the pile and tap it in the list below.']
  return t
}
function endDig(t: G, cleared: boolean) {
  const d = t.dig!
  t.hand.push(...d.loot)
  if (cleared) {
    const r = t.grid[4].c!
    t.hand.push(r)
    t.grid[4] = { ...blank(), done: 2, gap: true }
    t.todo.push(`You dug to the bottom: take ${d.loot.length ? `the dig row (${names(d.loot)}) and ` : ''}the region card ${label(r)} (the middle of the map) into your hand. Leave its spot EMPTY.`)
  } else {
    t.grid[4].done = 1
    t.todo.push(`${d.loot.length ? `Take the dig row (${names(d.loot)}) into your hand. ` : ''}Turn the region card (middle of the map) SIDEWAYS: it is explored.`)
  }
  t.dig = null
}
/** the card the player turned over while digging */
export function enterFlip(g: G, c: number): G | null {
  if (!g.dig?.asking || knownCards(g).includes(c)) return null
  const t = clone(g)
  const d = t.dig!
  t.pile--
  if (suit(c) === t.S) {
    if (isKeyCard(lk(t), c) && t.hand.some(x => rank(x) === rank(c))) {
      d.asking = false; d.found = c
      t.todo = [`${label(c)} is a KEY card (${SUITS[t.S]}), and you hold a ${rankLabel(rank(c))}. It does not count as a flip. Choose: TAKE it now (pay your ${rankLabel(rank(c))}), or LEAVE it waiting beside the pile.`]
      t.log.push(`  ${label(c)} turns up: take it or leave it.`)
      return t
    }
    t.wait.push(c)
    t.todo = [`${label(c)} is ${c === t.vault ? 'the FINISH card' : `a KEY card (${SUITS[t.S]})`}: it does not count. Put it FACE-UP beside the pile (the WAITING spot): it joins the map on your next move.`]
    t.log.push(`  ${label(c)} turns up: it waits beside the pile.`)
    return again(t)
  }
  d.asking = false
  d.flips++
  if (suit(c) === suit(t.grid[4].c!)) {
    d.hostile = c
    t.todo = [`Put ${label(c)} in the dig row: it is HOSTILE. Beat it with a higher ${SUITS[suit(c)]} from your hand, or flee.`]
    t.log.push(`  Flip ${label(c)}: HOSTILE!`)
    return settle(t)
  }
  d.loot.push(c)
  t.todo = [`Put ${label(c)} in the dig row: it is loot.`]
  t.log.push(`  Flip ${label(c)}: loot.`)
  if (d.flips >= d.depth) endDig(t, true)
  return settle(t)
}
/** a key card does not count as a flip: turn over the next card (the dig ends if the pile is empty) */
function again(t: G): G {
  const d = t.dig!
  if (t.pile > 0) { d.asking = true; t.todo.push('Turn over the next card of the pile and tap it in the list below.'); return t }
  d.asking = false
  t.todo.push('The pile is empty: the dig ends.')
  endDig(t, false)
  return settle(t)
}
export function take(g: G, i: number): G | null {
  if (!canTake(g, i)) return null
  const t = clone(g)
  const d = t.dig!, k = d.found
  const [c] = spendIdx(t, [i])
  t.keys.push(k); d.found = -1
  t.todo = [`Put your ${label(c)} face-up on the GONE pile, and ${label(k)} FACE-UP into your KEY ROW.`]
  t.log.push(`  Take ${label(k)} (pay ${label(c)}). Key row: ${[...t.keys].sort((a, b) => rank(a) - rank(b)).map(label).join(' ')}.`)
  return again(t)
}
export function leave(g: G): G | null {
  if (!canLeave(g)) return null
  const t = clone(g)
  const d = t.dig!, k = d.found
  t.wait.push(k); d.found = -1
  t.todo = [`Put ${label(k)} FACE-UP beside the pile (the WAITING spot): it joins the map on your next move.`]
  t.log.push(`  Leave ${label(k)}: it waits beside the pile.`)
  return again(t)
}
export function fight(g: G, i: number): G | null {
  if (!canFight(g, i)) return null
  const t = clone(g)
  const d = t.dig!, h = d.hostile
  const [c] = spendIdx(t, [i])
  d.loot.push(h); d.hostile = -1
  t.todo = [`Put your ${label(c)} face-up on the GONE pile: it beats ${label(h)}, which stays in the dig row as loot.`]
  t.log.push(`  Beat ${label(h)} with ${label(c)}.`)
  if (d.flips >= d.depth) endDig(t, true)
  return settle(t)
}
export function flee(g: G): G | null {
  if (!canFlee(g)) return null
  const t = clone(g)
  const d = t.dig!
  const lost = [...d.loot, d.hostile]
  t.gone.push(...lost)
  t.grid[4].done = 1
  t.dig = null
  t.todo = [`Put the whole dig row (${names(lost)}) face-up on the GONE pile.`, 'Turn the region card (middle of the map) SIDEWAYS: it is explored.']
  if (t.hand.length) {
    t.wound = true
    t.todo.push('The hostile card wounds you: shuffle your hand FACE-DOWN, pull out ONE card at random, put it face-up on the GONE pile, and tap it in the list below.')
  }
  t.log.push(`  Flee from ${label(d.hostile)}: lose the loot.`)
  return settle(t)
}
/** the random card the player lost to a wound */
export function enterWound(g: G, c: number): G | null {
  const i = g.hand.indexOf(c)
  if (!g.wound || i < 0) return null
  const t = clone(g)
  spendIdx(t, [i])
  t.wound = false
  t.log[t.log.length - 1] += ` It wounds you: lose ${label(c)}.`
  return settle(t)
}
export function stop(g: G): G | null {
  if (!canStop(g)) return null
  const t = clone(g)
  t.log.push(`  Stop digging: ${t.dig!.loot.length} card${t.dig!.loot.length === 1 ? '' : 's'} to your hand.`)
  endDig(t, false)
  return settle(t)
}
export function claim(g: G): G | null {
  if (!canClaim(g)) return null
  const t = clone(g)
  const k = t.grid[4].c!
  const shown = t.hand[claimers(t)[0]]
  t.keys.push(k)
  t.grid[4] = { ...blank(), done: 2, gap: true }
  t.todo = [`Show your ${label(shown)} (it stays in your hand).`, `Move ${label(k)} from the middle of the map FACE-UP into your KEY ROW. Leave its spot on the map EMPTY.`]
  t.log.push(`Claim ${label(k)} (show ${label(shown)}). Key row: ${[...t.keys].sort((a, b) => rank(a) - rank(b)).map(label).join(' ')}.`)
  return settle(t)
}
export function finish(g: G): G | null {
  if (!canFinish(g)) return null
  const t = clone(g)
  t.over = 'win'
  t.todo = ['You stand on the finish card holding your key. You win!']
  t.log.push('You stand on the finish card holding your key: YOU WIN!')
  return settle(t)
}
export function discard(g: G, i: number): G | null {
  if (busy(g) || g.dig || !overflow(g) || i < 0 || i >= g.hand.length) return null
  const t = clone(g)
  const [c] = spendIdx(t, [i])
  t.todo = [`Put ${label(c)} from your hand face-up on the GONE pile.`]
  t.log.push(`Hand over ${t.limit}: discard ${label(c)}.`)
  return settle(t)
}

// ---------- advisor (the engine's, on what the player can see) ----------
export function viewOfG(g: G): View {
  return {
    S: g.S, lock: g.lock!, vault: g.vault, limit: g.limit, hand: g.hand, keys: g.keys, gone: g.gone, wait: g.wait,
    gc: g.grid.map(c => (c.gap ? -1 : c.up && c.c !== null ? c.c : -2)), gdone: g.grid.map(c => c.done),
    dig: g.dig && { depth: g.dig.depth, flips: g.dig.flips, loot: g.dig.loot, hostile: g.dig.hostile, found: g.dig.found }, region: g.grid[4].gap ? -1 : g.grid[4].c ?? -1, pile: g.pile,
  }
}
export function advise(g: G): Tip | null {
  if (g.over || g.step !== 'play' || needOf(g)) return null
  return adviseView(viewOfG(g))
}
export { keyCount, rankLabel }
