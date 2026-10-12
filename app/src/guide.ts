// Zoom — guide engine for playing with a REAL deck. The app never deals: the player flips physical cards and ENTERS what they see.
// Face-down cards are unknown to the app (cell.c === null). Every action returns a new state with `todo`: the physical steps to perform.
import { LIMIT, SUITS, isRed, keepVals, label, lockLen, power, rank, rankLabel, siteK, strength, suit, zoomCost } from './engine'
import type { Advice } from './engine'

export interface Cell { id: number; c: number | null; up: boolean; done: 0 | 1 | 2; gap: boolean }
export type Step = 'intro' | 'lock' | 'vault' | 'pack' | 'grid' | 'hide' | 'play'
export interface G {
  step: Step
  lock: number | null; S: number; L: number; vault: number
  pack: number[]; ashes: number[]
  grid: Cell[]
  site: { cards: number[]; done: boolean[]; k: number } | null // k = cards dealt; cards = those entered so far
  pile: number; behind: number; recycles: number; exhausted: boolean
  over: null | 'win' | 'lose'
  todo: string[]; log: string[]; steps: number
}
export type Need =
  | { kind: 'lock' } | { kind: 'pack'; left: number } | { kind: 'cell'; i: number } | { kind: 'spread'; left: number }

let nextId = 1
const blank = (): Cell => ({ id: nextId++, c: null, up: false, done: 0, gap: false })
/** Saved games from before cells had ids: give every cell a unique id (and keep new ids above them). */
export function fixIds(h: G[]): G[] {
  h.forEach(g => g.grid.forEach(c => { if (c.id === undefined) c.id = nextId++; else nextId = Math.max(nextId, c.id + 1) }))
  return h
}
export const newG = (): G => ({
  step: 'intro', lock: null, S: 0, L: 3, vault: 48,
  pack: [], ashes: [], grid: Array.from({ length: 9 }, blank), site: null,
  pile: 37, behind: 0, recycles: 0, exhausted: false, over: null, todo: [], log: [], steps: 0,
})
const clone = (g: G): G => ({
  ...g, pack: g.pack.slice(), ashes: g.ashes.slice(), grid: g.grid.map(c => ({ ...c })),
  site: g.site && { cards: g.site.cards.slice(), done: g.site.done.slice(), k: g.site.k },
  todo: [], log: g.log.slice(),
})

// ---------- derived ----------
export const overflow = (g: G) => Math.max(0, g.pack.length - LIMIT)
export function knownCards(g: G): number[] {
  return [...(g.lock !== null ? [g.lock] : []), ...g.pack, ...g.ashes, ...g.grid.flatMap(c => (c.c !== null ? [c.c] : [])), ...(g.site?.cards ?? [])]
}
export function needOf(g: G): Need | null {
  if (g.over) return null
  if (g.step === 'lock') return { kind: 'lock' }
  if (g.step === 'pack') return { kind: 'pack', left: 5 - g.pack.length }
  if (g.step === 'grid') return { kind: 'cell', i: 4 }
  if (g.site && g.site.cards.length < g.site.k) return { kind: 'spread', left: g.site.k - g.site.cards.length }
  const i = g.grid.findIndex(c => c.up && c.c === null && !c.gap)
  return i >= 0 ? { kind: 'cell', i } : null
}
export const pendingCells = (g: G) => g.grid.flatMap((c, i) => (c.up && c.c === null && !c.gap ? [i] : []))
const busy = (g: G) => g.step !== 'play' || !!g.over || overflow(g) > 0 || !!needOf(g)
export const centerCard = (g: G) => g.grid[4].c
export function keyHeld(g: G, pack = g.pack): number {
  let best = 0
  for (let a = 2; a + g.L - 1 <= 13; a++) {
    let h = 0
    for (let r = a; r < a + g.L; r++) if (pack.some(c => suit(c) === g.S && rank(c) === r)) h++
    best = Math.max(best, h)
  }
  return best / g.L
}
export const hasKey = (g: G) => keyHeld(g) >= 1
export const canZoom = (g: G) => {
  const c = g.grid[4]
  return !busy(g) && !g.site && !c.gap && c.up && c.c !== null && c.done === 0 && c.c !== g.vault && g.pack.length >= zoomCost(g)
}
export const canScout = (g: G) => !busy(g) && !g.site && g.pack.length >= zoomCost(g) && g.grid.some(c => !c.up && !c.gap)
export const canMove = (g: G) => !busy(g) && !g.site
export const canOpen = (g: G) => !busy(g) && !g.site && g.grid[4].c === g.vault && hasKey(g)

export type Where = 'pack' | 'gone' | 'table' | 'vault' | 'unknown'
export function whereIs(g: G, c: number): Where {
  if (g.step !== 'play' && g.step !== 'hide' && g.step !== 'grid') return 'unknown'
  if (c === g.vault) return g.pack.includes(c) ? 'pack' : g.grid.some(x => x.c === c) ? 'table' : 'vault'
  if (g.pack.includes(c)) return 'pack'
  if (g.ashes.includes(c)) return 'gone'
  if (g.grid.some(x => x.c === c) || g.site?.cards.includes(c)) return 'table'
  return 'unknown'
}
export interface KeyPlan { ranks: number[]; have: number[]; missing: number[]; dead: boolean }
export function keyPlan(g: G): KeyPlan {
  let best: KeyPlan | null = null
  let bs = -1
  const of = (r: number) => (r - 2) * 4 + g.S
  for (let a = 2; a + g.L - 1 <= 13; a++) {
    const ranks = Array.from({ length: g.L }, (_, k) => a + k)
    const have = ranks.filter(r => g.pack.includes(of(r)))
    const missing = ranks.filter(r => !have.includes(r))
    if (missing.some(r => g.ashes.includes(of(r)))) continue
    const score = have.length * 10 + missing.filter(r => whereIs(g, of(r)) === 'table').length
    if (score > bs) { bs = score; best = { ranks, have, missing, dead: false } }
  }
  return best ?? { ranks: [], have: [], missing: [], dead: true }
}

// ---------- physical piles ----------
/** Deal k cards from the pile (reshuffling BEHIND when it runs out). Mutates t; returns how many could be dealt + the steps to do. */
function drawPlan(t: G, k: number, what: string): { n: number; steps: string[] } {
  let need = k
  let n = 0
  const steps: string[] = []
  while (need > 0) {
    if (t.pile === 0) {
      if (t.behind === 0) { t.exhausted = true; steps.push('The world has no cards left to deal.'); break }
      t.recycles++
      steps.push(`The pile is empty: take the BEHIND pile (${t.behind} card${t.behind === 1 ? '' : 's'}), shuffle it, and put it face-down where the pile was. That is your new pile. Lap ${t.recycles + 1} starts: from now on zooming costs ${zoomCost(t)} cards.`)
      t.pile = t.behind
      t.behind = 0
    }
    const take = Math.min(need, t.pile)
    t.pile -= take; need -= take; n += take
    steps.push(`Deal ${take} card${take > 1 ? 's' : ''} from the top of the pile ${what}.`)
  }
  return { n, steps }
}
function settle(t: G): G {
  t.steps++
  if (!t.over && !t.site && t.exhausted) {
    t.over = 'lose'
    t.log.push('The world has no cards left to show you. You lose.')
  } else if (!t.over && !t.site && t.step === 'play' && !hasKey(t) && t.pack.length < zoomCost(t)) {
    t.over = 'lose'
    t.log.push(`You cannot afford to zoom any more (it costs ${zoomCost(t)}) and you do not hold your key. You lose.`)
  }
  return t
}
const spendIdx = (t: G, idx: number[]) => [...idx].sort((a, b) => b - a).map(i => t.pack.splice(i, 1)[0]).reverse().map(c => { t.ashes.push(c); return c })
const names = (cs: number[]) => cs.map(label).join(' + ')

// ---------- setup ----------
export function setLock(g: G, c: number): G | null {
  if (g.step !== 'lock' || rank(c) === 14) return null
  const t = clone(g)
  t.lock = c; t.S = suit(c); t.L = lockLen(rank(c)); t.vault = (12 << 2) | t.S; t.step = 'vault'
  t.log.push(`Lock card ${label(c)}: you need ${t.L} consecutive ${SUITS[t.S]}; the finish card is A${SUITS[t.S]}.`)
  return t
}
export function nextStep(g: G): G | null {
  const t = clone(g)
  if (g.step === 'intro') { t.step = 'lock'; return t }
  if (g.step === 'vault') { t.step = 'pack'; return t }
  if (g.step === 'hide') { t.step = 'play'; t.log.push('The game begins.'); return t }
  return null
}
export function enterPack(g: G, c: number): G | null {
  if (g.step !== 'pack' || g.pack.length >= 5) return null
  const t = clone(g)
  t.pack.push(c)
  if (t.pack.length === 5) { t.step = 'grid'; t.grid[4] = { ...blank(), up: true } }
  return t
}

// ---------- entering cards ----------
export function enterCell(g: G, i: number, c: number): G | null {
  const cell = g.grid[i]
  if (!cell.up || cell.c !== null || cell.gap) return null
  const t = clone(g)
  t.grid[i].c = c
  if (g.step === 'grid') { t.step = 'hide'; t.pile = 37 }
  else if (pendingCells(t).length) t.todo = g.todo // still flipping (zoom out): keep the instructions on screen
  return t
}
export function enterSpread(g: G, c: number): G | null {
  if (!g.site || g.site.cards.length >= g.site.k) return null
  const t = clone(g)
  const st = t.site!
  const dealNext = (): string[] => {
    if (st.cards.length >= st.k) return ['The spread is complete. Now take the cards (see below).']
    const d = drawPlan(t, 1, 'FACE-UP next to the others in the spread')
    if (d.n === 0) st.k = st.cards.length
    return d.steps
  }
  if (c === t.vault) {
    // the vault never appears inside a spread: it goes to the bottom of the pile and the next card is dealt instead
    const onlyVaultLeft = t.pile === 0
    t.pile += 1
    const steps = onlyVaultLeft ? ((st.k = st.cards.length), ['Only the finish card is left in the pile, so the spread stops here.']) : dealNext()
    t.todo = [`That is the FINISH card (${label(c)}): it cannot be in a spread. Put it FACE-DOWN at the BOTTOM of the pile.`, ...steps]
    t.log.push(`  ${label(c)} (the finish card) turned up in the spread: back to the bottom of the pile.`)
  } else {
    st.cards.push(c); st.done.push(false)
    t.log[t.log.length - 1] += ` ${label(c)}`
    t.todo = dealNext()
  }
  return st.k === 0 ? settle(finishSite(t)) : t
}

// ---------- actions ----------
const TARGET = [1, 7, 3, 5]
export function move(g: G, d: number): G | null {
  if (!canMove(g)) return null
  const t = clone(g)
  const old = g.grid
  const nu: (Cell | null)[] = Array(9).fill(null)
  const gone: number[] = []
  if (d === 0) { for (let i = 0; i < 6; i++) nu[i + 3] = old[i]; gone.push(6, 7, 8) }
  if (d === 1) { for (let i = 0; i < 6; i++) nu[i] = old[i + 3]; gone.push(0, 1, 2) }
  if (d === 2) for (let r = 0; r < 3; r++) { for (let c = 0; c < 2; c++) nu[r * 3 + c + 1] = old[r * 3 + c]; gone.push(r * 3 + 2) }
  if (d === 3) for (let r = 0; r < 3; r++) { for (let c = 0; c < 2; c++) nu[r * 3 + c] = old[r * 3 + c + 1]; gone.push(r * 3) }
  const goneCards = gone.filter(i => !old[i].gap).length
  const { n, steps } = drawPlan(t, 3, 'FACE-DOWN into the new row/column')
  let k = 0
  t.grid = nu.map(c => (c ? { ...c } : k++ < n ? blank() : { ...blank(), gap: true }))
  t.grid[4] = { ...t.grid[4], up: !t.grid[4].gap }
  t.behind += goneCards
  const words = ['UP', 'DOWN', 'LEFT', 'RIGHT'][d]
  const outgoing = ['BOTTOM row', 'TOP row', 'RIGHT column', 'LEFT column'][d]
  const incoming = ['TOP row', 'BOTTOM row', 'LEFT column', 'RIGHT column'][d]
  const slide = ['down', 'up', 'right', 'left'][d]
  t.todo = [
    `Move ${words}: pick up the ${outgoing} (${goneCards} card${goneCards === 1 ? '' : 's'}) and HOLD them for now.`,
    `Slide the other cards one place ${slide}, so the ${incoming} is empty. Keep each card as it is (face-up stays face-up, sideways stays sideways, empty spots move too).`,
    ...steps.map(s => s.replace('into the new row/column', `into the ${incoming}${n < 3 ? ` (fill it from the ${d < 2 ? 'left' : 'top'}; leave the rest of it empty)` : ''}`)),
    ...(goneCards ? [`Now put the ${goneCards} cards you were holding FACE-DOWN on the BEHIND pile.`] : []),
    t.grid[4].gap ? 'The middle spot is empty (nothing to flip). You stand there.' : t.grid[4].c !== null ? 'You now stand on the middle card (it is already face-up).' : 'Turn the MIDDLE card face-up and tap it in the list below.',
  ]
  t.log.push(`Move ${words.toLowerCase()}.`)
  return settle(t)
}
const validZoomPay = (g: G, pay: number[]) => pay.length === zoomCost(g) && new Set(pay).size === pay.length && pay.every(i => i >= 0 && i < g.pack.length)
export function scout(g: G, pay: number[]): G | null {
  if (!canScout(g) || !validZoomPay(g, pay)) return null
  const t = clone(g)
  const c = names(spendIdx(t, pay))
  let flipped = 0
  t.grid.forEach(x => { if (!x.up && !x.gap) { x.up = true; flipped++ } })
  t.todo = [`Put ${c} from your hand face-up on the GONE pile.`, `Turn all ${flipped} face-down cards on the map face-up (leave them where they are) and tap each one in the list below.`]
  t.log.push(`Zoom OUT: spend ${c}.`)
  return settle(t)
}
export function zoom(g: G, pay: number[]): G | null {
  if (!canZoom(g) || !validZoomPay(g, pay)) return null
  const t = clone(g)
  const c = names(spendIdx(t, pay))
  const reg = t.grid[4].c!
  const { n, steps } = drawPlan(t, 1, 'FACE-UP in a row under the map (the spread)')
  t.site = { cards: [], done: [], k: n ? siteK(rank(reg)) : 0 }
  t.todo = [`Put ${c} from your hand face-up on the GONE pile.`, ...steps, ...(n ? [`Tap that card in the list below. This spread gets ${t.site.k} card${t.site.k > 1 ? 's' : ''} (${rankLabel(rank(reg))} is ${rank(reg) <= 5 ? '2-5' : rank(reg) <= 10 ? '6-10' : 'J-A'}), dealt ONE AT A TIME: I tell you when to deal the next.`] : [])]
  t.log.push(`Zoom IN on ${label(reg)}: spend ${c}; spread:`)
  if (n === 0) return settle(finishSite(t))
  return settle(t)
}
function finishSite(t: G): G {
  const st = t.site!
  const done = st.done.length === st.k && st.done.every(Boolean)
  if (done) {
    const r = t.grid[4].c!
    t.pack.push(r)
    t.grid[4] = { ...blank(), done: 2, gap: true }
    t.todo.push(`You took everything, so the region card ${label(r)} (the middle card of the map) joins your hand too: pick it up and leave its spot EMPTY.`)
    t.log.push(`  Everything taken: region ${label(r)} joins your hand.`)
  } else t.grid[4].done = 1
  t.site = null
  return t
}
export function validTake(g: G, j: number, pay: number[]): boolean {
  if (!g.site || g.site.done[j] === undefined || g.site.done[j] || overflow(g) || g.site.cards.length < g.site.k) return false
  const m = g.site.cards[j]
  const cs = pay.map(i => g.pack[i])
  if (new Set(pay).size !== pay.length || pay.some(i => i < 0 || i >= g.pack.length)) return false
  if (suit(m) === 1 || suit(m) === 2) return pay.length === 0
  if (suit(m) === 3) return (cs.length === 1 && isRed(cs[0]) === isRed(m)) || cs.length === 2
  return cs.length > 0 && cs.reduce((x, c) => x + power(c), 0) >= strength(m)
}
export function cheapestPay(g: G, j: number): { pay: number[]; cost: number } | null {
  if (!g.site) return null
  const m = g.site.cards[j], k = suit(m)
  if (k === 1 || k === 2) return { pay: [], cost: 0 }
  const kv = keepVals(g.pack, g.S, g.L), n = g.pack.length
  let best: number[] | null = null
  let bc = Infinity
  if (k === 3) {
    for (let i = 0; i < n; i++) if (isRed(g.pack[i]) === isRed(m) && kv[i] < bc) { bc = kv[i]; best = [i] }
    const idx = [...kv.keys()].sort((a, b) => kv[a] - kv[b])
    if (n >= 2 && kv[idx[0]] + kv[idx[1]] < bc) { bc = kv[idx[0]] + kv[idx[1]]; best = [idx[0], idx[1]] }
  } else {
    for (let mask = 1; mask < 1 << n; mask++) {
      let pw = 0, cost = 0
      for (let i = 0; i < n; i++) if (mask >> i & 1) { pw += power(g.pack[i]); cost += kv[i] }
      if (pw >= strength(m) && cost < bc) { bc = cost; best = [...Array(n).keys()].filter(i => mask >> i & 1) }
    }
  }
  return best ? { pay: best, cost: bc } : null
}
export function take(g: G, j: number, pay: number[]): G | null {
  if (!validTake(g, j, pay)) return null
  const t = clone(g)
  const m = t.site!.cards[j], k = suit(m)
  const spent = spendIdx(t, pay)
  t.pack.push(m)
  t.site!.done[j] = true
  if (k === 1 || k === 2) { t.todo = [`Take ${label(m)} from the spread into your hand.`]; t.log.push(`  Take ${label(m)} (free).`) }
  else if (k === 3) { t.todo = [`Put ${names(spent)} from your hand face-up on the GONE pile.`, `Take ${label(m)} (obstacle) from the spread into your hand.`]; t.log.push(`  Take ${label(m)}: swap for ${names(spent)}.`) }
  else { t.todo = [`Put ${names(spent)} from your hand face-up on the GONE pile.`, `Take ${label(m)} (monster) from the spread into your hand.`]; t.log.push(`  Take ${label(m)}: beat it with ${names(spent)}.`) }
  if (t.site!.done.length === t.site!.k && t.site!.done.every(Boolean)) return settle(finishSite(t))
  return settle(t)
}
/** Rule: you must take every spread card you can pay for. You may leave only when nothing left is affordable. */
export const canLeave = (g: G) => !!g.site && !g.over && g.site.cards.length >= g.site.k && !overflow(g) && g.site.cards.every((_, j) => g.site!.done[j] || !cheapestPay(g, j))
export function leave(g: G): G | null {
  if (!canLeave(g)) return null
  const t = clone(g)
  const left = g.site!.done.filter(d => !d).length
  t.todo = [
    ...(left ? [`You cannot pay for the ${left} card${left > 1 ? 's' : ''} left in the spread: set ${left > 1 ? 'them' : 'it'} aside, OUT OF PLAY (not on BEHIND).`] : []),
    'Turn the region card (middle of the map) sideways: it is explored, you cannot zoom into it again.',
  ]
  t.log.push('  Finish the site (cannot pay for the rest).')
  return settle(finishSite(t))
}
export function open(g: G): G | null {
  if (!canOpen(g)) return null
  const t = clone(g)
  t.over = 'win'
  t.todo = ['You reached the finish card. You win!']
  t.log.push('You stand on the finish card holding your run: YOU WIN!')
  return settle(t)
}
export function discard(g: G, i: number): G | null {
  if (!overflow(g) || i < 0 || i >= g.pack.length) return null
  const t = clone(g)
  const [c] = spendIdx(t, [i])
  t.todo = [`Put ${label(c)} from your hand face-up on the GONE pile.`]
  t.log.push(`Hand over ${LIMIT}: discard ${label(c)}.`)
  return t
}

// ---------- advisor (same greedy heuristic as the simulator) ----------
export interface Tip { advice: Advice; text: string }
function cellScore(g: G, i: number): number {
  const x = g.grid[i]
  if (x.gap) return 0
  if (!x.up || x.c === null) return 5.2
  if (x.c === g.vault) return hasKey(g) ? 900 : keyHeld(g) >= 0.66 ? 8 : 2
  if (x.done) return 0.5
  return 4 + 1.6 * siteK(rank(x.c)) + (suit(x.c) === g.S ? 2 : 0)
}
const DISC = [[6, 7, 8], [0, 1, 2], [2, 5, 8], [0, 3, 6]]
const DIRS = ['up', 'down', 'left', 'right']
export function advise(g: G): Tip | null {
  if (g.over || g.step !== 'play' || needOf(g)) return null
  const lowest = () => { const kv = keepVals(g.pack, g.S, g.L); return [...kv.keys()].sort((a, b) => kv[a] - kv[b]) }
  if (overflow(g)) {
    const i = lowest()[0]
    return { advice: { kind: 'discard', i }, text: `Your hand is over ${LIMIT}: discard ${label(g.pack[i])} (it helps your key the least).` }
  }
  if (g.site) {
    let best = null as Tip | null
    let bc = Infinity
    g.site.cards.forEach((m, j) => {
      if (g.site!.done[j]) return
      const cp = cheapestPay(g, j)
      if (!cp || cp.cost >= bc) return
      bc = cp.cost
      const how = cp.pay.length ? ` (pay ${names(cp.pay.map(i => g.pack[i]))}: the cards you need least)` : ' (free)'
      best = { advice: { kind: 'take', j, pay: cp.pay }, text: `Take ${label(m)}${how}. You must take everything you can pay for; free cards first, then the cheapest.` }
    })
    return best ?? { advice: { kind: 'leave' }, text: 'You cannot pay for anything left here. Finish the site.' }
  }
  if (canOpen(g)) return { advice: { kind: 'open' }, text: 'You are on the finish card and hold your run. Finish the game!' }
  const keyed = hasKey(g)
  const down = g.grid.filter(c => !c.up && !c.gap).length
  const vi = g.grid.findIndex(c => c.c === g.vault && c.up)
  const payZ = lowest().slice(0, zoomCost(g))
  const payNames = names(payZ.map(i => g.pack[i]))
  let bs = -Infinity
  let best = null as Tip | null
  const consider = (sc: number, tip: Tip) => { if (sc > bs) { bs = sc; best = tip } }
  const here = g.grid[4].c
  if (canZoom(g)) consider(g.pack.length >= zoomCost(g) + 1 ? 5 + 1.6 * siteK(rank(here!)) : 1, { advice: { kind: 'zoom', pay: payZ }, text: `Zoom in on ${label(here!)} (pay ${payNames}): unexplored regions are where the loot is.` })
  if (canScout(g)) consider(g.pack.length >= zoomCost(g) + 2 ? 0.55 * down : 0, { advice: { kind: 'scout', pay: payZ }, text: `Zoom out (pay ${payNames}) to see the whole map and find the finish card.` })
  if (canMove(g)) {
    for (let d = 0; d < 4; d++) {
      let sc = cellScore(g, TARGET[d]) - 0.25 * DISC[d].reduce((x, i) => x + cellScore(g, i), 0)
      if (keyed && vi >= 0) {
        const r = Math.floor(vi / 3), c = vi % 3
        if ((d === 0 && r < 1) || (d === 1 && r > 1) || (d === 2 && c < 1) || (d === 3 && c > 1)) sc += 30
      }
      const tc = g.grid[TARGET[d]]
      consider(sc, { advice: { kind: 'move', d }, text: `Move ${DIRS[d]}${tc.up && tc.c !== null ? ` to ${label(tc.c)}` : ' into the unknown'}${keyed && vi >= 0 ? ' (toward the finish card)' : ''}.` })
    }
  }
  return best
}
export { rankLabel }
