// Zoom — rules engine (port of ../../sim.mjs, v0 draft rules). Pure functions: every action returns a NEW state or null if illegal.

export const SUITS = ['♠', '♥', '♦', '♣'] as const
export const SUIT_ROLE = ['monster', 'ally', 'treasure', 'obstacle'] as const
const RK: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
export const suit = (c: number) => c & 3
export const rank = (c: number) => (c >> 2) + 2
export const isRed = (c: number) => suit(c) === 1 || suit(c) === 2
export const rankLabel = (r: number) => RK[r] ?? String(r)
export const label = (c: number) => rankLabel(rank(c)) + SUITS[suit(c)]

export const START = 5
export const LIMIT = 10
/** Lap = how many times the pile has been reshuffled. Each lap, looking (zooming) costs one more card: the world is more picked over. */
export const zoomCost = (s: { recycles: number }) => 1 + s.recycles
export const lockLen = (_lockRank: number) => 4 // every game needs 4 in a row (tested: 3 is too easy, 5 too hard)
export const siteK = (r: number) => (r <= 5 ? 1 : r <= 10 ? 2 : 3)
export const strength = (m: number) => Math.ceil(rank(m) / 2)
export const power = (c: number) => rank(c) * (suit(c) === 0 ? 2 : 1)

export interface Site { cards: number[]; done: boolean[] }
export interface State {
  seed: number; rng: number
  S: number; L: number; lock: number; vault: number
  draw: number[]; behind: number[]; ashes: number[]; pack: number[] // draw: top = last
  gc: number[]; gup: boolean[]; gdone: number[] // 9 cells; gc -1 = empty; gdone 0 fresh, 1 left, 2 cleared
  site: Site | null
  recycles: number; exhausted: boolean // exhausted: the world had no card left to deal
  over: null | 'win' | 'stuck'
  seen: boolean[]
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
  draw: s.draw.slice(), behind: s.behind.slice(), ashes: s.ashes.slice(), pack: s.pack.slice(),
  gc: s.gc.slice(), gup: s.gup.slice(), gdone: s.gdone.slice(),
  site: s.site && { cards: s.site.cards.slice(), done: s.site.done.slice() },
  seen: s.seen.slice(), log: s.log.slice(),
})

export function newGame(seed: number): State {
  const t = { rng: seed >>> 0 } as State
  const deck = shuffle([...Array(52).keys()], t)
  const lock = deck.splice(deck.findIndex(c => rank(c) !== 14), 1)[0]
  const S = suit(lock)
  const vault = (12 << 2) | S // Ace of the lock's suit
  deck.splice(deck.indexOf(vault), 1)
  const pack = deck.splice(0, START)
  const grid = deck.splice(0, 9)
  deck.splice(8 + Math.floor(rand(t) * 22), 0, vault) // vault somewhere in the middle of the pile
  const s: State = {
    seed, rng: t.rng, S, L: lockLen(rank(lock)), lock, vault,
    draw: deck.reverse(), behind: [], ashes: [], pack,
    gc: grid, gup: Array(9).fill(false), gdone: Array(9).fill(0),
    site: null, recycles: 0, exhausted: false, over: null,
    seen: Array(52).fill(false), steps: 0, log: [],
  }
  for (const c of pack) s.seen[c] = true
  reveal(s, 4)
  s.log.push(`New game #${seed}. Lock card ${label(lock)}: you need ${s.L} consecutive ${SUITS[S]} in your pack, then stand on the finish card (A${SUITS[S]}).`)
  return s
}

function reveal(t: State, i: number) {
  if (!t.gup[i] && t.gc[i] >= 0) { t.gup[i] = true; t.seen[t.gc[i]] = true }
}
function drawCard(t: State, skipVault: boolean): number {
  for (let k = 0; k < 2; k++) {
    if (!t.draw.length) {
      if (!t.behind.length) { t.exhausted = true; return -1 }
      t.draw = shuffle(t.behind, t)
      t.behind = []
      t.recycles++
      t.log.push(`The pile ran out: BEHIND is shuffled into a new pile. Lap ${t.recycles + 1}: from now on zooming costs ${zoomCost(t)} cards.`)
    }
    const c = t.draw.pop()!
    if (skipVault && c === t.vault) { t.draw.unshift(c); continue }
    return c
  }
  return -1
}

// ---------- values & key ----------
export function keepVals(pack: number[], S: number, L: number): number[] {
  const kv = pack.map(c => 1 + ((rank(c) - 2) / 12) * 0.4)
  let best = 0
  let wins: number[] = []
  for (let a = 2; a + L - 1 <= 13; a++) {
    let h = 0
    for (let r = a; r < a + L; r++) if (pack.some(c => suit(c) === S && rank(c) === r)) h++
    if (h > best) { best = h; wins = [a] } else if (h === best && h > 0) wins.push(a)
  }
  pack.forEach((c, i) => {
    if (suit(c) !== S) return
    const r = rank(c)
    kv[i] += best > 0 && wins.some(a => r >= a && r < a + L) ? 2.5 + 0.6 * best : 0.8
  })
  return kv
}
export function keyProgress(s: State): number {
  let best = 0
  for (let a = 2; a + s.L - 1 <= 13; a++) {
    let h = 0
    for (let r = a; r < a + s.L; r++) if (s.pack.some(c => suit(c) === s.S && rank(c) === r)) h++
    best = Math.max(best, h)
  }
  return best / s.L
}
export const hasKey = (s: State) => keyProgress(s) >= 1
export const vaultCell = (s: State) => s.gc.findIndex((c, i) => c === s.vault && s.gup[i])
const lowestIdx = (s: State, extra: number[] = []) => {
  const kv = keepVals(s.pack, s.S, s.L)
  return [...kv.keys()].filter(i => !extra.includes(i)).sort((a, b) => kv[a] - kv[b])
}

// ---------- prices ----------
export type Pay = number[] // indices into pack
export const overflow = (s: State) => Math.max(0, s.pack.length - LIMIT)
/** Is this selection a valid payment for taking site card j? */
export function validTake(s: State, j: number, pay: Pay): boolean {
  if (!s.site || s.site.done[j] || overflow(s)) return false
  const m = s.site.cards[j]
  const cs = pay.map(i => s.pack[i])
  if (new Set(pay).size !== pay.length || pay.some(i => i < 0 || i >= s.pack.length)) return false
  if (suit(m) === 1 || suit(m) === 2) return pay.length === 0
  if (suit(m) === 3) return (cs.length === 1 && isRed(cs[0]) === isRed(m)) || cs.length === 2
  return cs.length > 0 && cs.reduce((x, c) => x + power(c), 0) >= strength(m)
}
/** cheapest valid payment by keep-value (used by the advisor and "auto-pay") */
export function cheapestPay(s: State, j: number): { pay: Pay; cost: number } | null {
  if (!s.site) return null
  const m = s.site.cards[j], t = suit(m)
  if (t === 1 || t === 2) return { pay: [], cost: 0 }
  const kv = keepVals(s.pack, s.S, s.L), n = s.pack.length
  let best: Pay | null = null
  let bc = Infinity
  if (t === 3) {
    for (let i = 0; i < n; i++) if (isRed(s.pack[i]) === isRed(m) && kv[i] < bc) { bc = kv[i]; best = [i] }
    const idx = [...kv.keys()].sort((a, b) => kv[a] - kv[b])
    if (n >= 2 && kv[idx[0]] + kv[idx[1]] < bc) { bc = kv[idx[0]] + kv[idx[1]]; best = [idx[0], idx[1]] }
  } else {
    const need = strength(m)
    for (let mask = 1; mask < 1 << n; mask++) {
      let pw = 0, cost = 0
      for (let i = 0; i < n; i++) if (mask >> i & 1) { pw += power(s.pack[i]); cost += kv[i] }
      if (pw >= need && cost < bc) { bc = cost; best = [...Array(n).keys()].filter(i => mask >> i & 1) }
    }
  }
  return best ? { pay: best, cost: bc } : null
}

// ---------- actions ----------
const DIR = ['up', 'down', 'left', 'right']
export const DIR_NAME = DIR
function settle(t: State): State {
  t.steps++
  if (!t.over && !t.site && t.exhausted) {
    t.over = 'stuck'
    t.log.push('The world has no cards left to show you. You lose.')
  } else if (!t.over && !t.site && !hasKey(t) && t.pack.length < zoomCost(t)) {
    t.over = 'stuck'
    t.log.push(`You cannot afford to zoom any more (it costs ${zoomCost(t)}) and you do not hold your key. You lose.`)
  }
  return t
}
function spendPack(t: State, pay: Pay): number[] {
  const cs = [...pay].sort((a, b) => b - a).map(i => t.pack.splice(i, 1)[0])
  t.ashes.push(...cs)
  return cs
}
const busy = (s: State) => !!s.over || overflow(s) > 0

export function canZoom(s: State) {
  const c = s.gc[4]
  return !busy(s) && !s.site && c >= 0 && s.gup[4] && s.gdone[4] === 0 && c !== s.vault && s.pack.length >= zoomCost(s)
}
export const canScout = (s: State) => !busy(s) && !s.site && s.pack.length >= zoomCost(s) && s.gup.some((u, i) => !u && s.gc[i] >= 0)
export const canMove = (s: State) => !busy(s) && !s.site
export const canOpen = (s: State) => !busy(s) && !s.site && s.gc[4] === s.vault && hasKey(s)

export const validZoomPay = (s: State, pay: Pay) => pay.length === zoomCost(s) && new Set(pay).size === pay.length && pay.every(i => i >= 0 && i < s.pack.length)
export function scout(s: State, pay: Pay): State | null {
  if (!canScout(s) || !validZoomPay(s, pay)) return null
  const t = cloneState(s)
  const cs = spendPack(t, pay)
  for (let i = 0; i < 9; i++) reveal(t, i)
  t.log.push(`Zoom OUT: spend ${cs.map(label).join(' + ')} to flip the whole map.`)
  return settle(t)
}
export function zoom(s: State, pay: Pay): State | null {
  if (!canZoom(s) || !validZoomPay(s, pay)) return null
  const t = cloneState(s)
  const cs = spendPack(t, pay)
  const reg = t.gc[4]
  const cards: number[] = []
  for (let i = 0; i < siteK(rank(reg)); i++) { const x = drawCard(t, true); if (x >= 0) { cards.push(x); t.seen[x] = true } }
  t.site = { cards, done: cards.map(() => false) }
  t.log.push(`Zoom IN on ${label(reg)}: spend ${cs.map(label).join(' + ')}, ${cards.length} card${cards.length === 1 ? '' : 's'} spread: ${cards.map(label).join(' ')}.`)
  if (!cards.length) finishSite(t)
  return settle(t)
}
export function move(s: State, d: number): State | null {
  if (!canMove(s)) return null
  const t = cloneState(s)
  const fresh = [0, 1, 2].map(() => drawCard(t, false))
  const oc = t.gc, od = t.gdone, ou = t.gup
  const nc = Array(9).fill(-1), nd = Array(9).fill(0), nu = Array(9).fill(false)
  const put = (to: number, from: number) => { nc[to] = oc[from]; nd[to] = od[from]; nu[to] = ou[from] }
  const gone: number[] = []
  if (d === 0) { for (let i = 0; i < 6; i++) put(i + 3, i); for (let k = 0; k < 3; k++) nc[k] = fresh[k]; gone.push(6, 7, 8) }
  if (d === 1) { for (let i = 0; i < 6; i++) put(i, i + 3); for (let k = 0; k < 3; k++) nc[6 + k] = fresh[k]; gone.push(0, 1, 2) }
  if (d === 2) for (let r = 0; r < 3; r++) { for (let c = 0; c < 2; c++) put(r * 3 + c + 1, r * 3 + c); nc[r * 3] = fresh[r]; gone.push(r * 3 + 2) }
  if (d === 3) for (let r = 0; r < 3; r++) { for (let c = 0; c < 2; c++) put(r * 3 + c, r * 3 + c + 1); nc[r * 3 + 2] = fresh[r]; gone.push(r * 3) }
  for (const g of gone) if (oc[g] >= 0) t.behind.push(oc[g])
  t.gc = nc; t.gdone = nd; t.gup = nu
  reveal(t, 4)
  t.log.push(`Move ${DIR[d]}: you arrive at ${t.gc[4] >= 0 ? label(t.gc[4]) : 'an empty spot'}.`)
  return settle(t)
}
function finishSite(t: State) {
  if (t.site!.done.every(Boolean)) {
    const r = t.gc[4]
    t.log.push(`Everything taken: region ${label(r)} joins your pack.`)
    t.pack.push(r)
    t.gc[4] = -1
    t.gdone[4] = 2
  } else t.gdone[4] = 1
  t.site = null
}
export function take(s: State, j: number, pay: Pay): State | null {
  if (!validTake(s, j, pay)) return null
  const t = cloneState(s)
  const m = t.site!.cards[j], k = suit(m)
  const spent = spendPack(t, pay)
  t.pack.push(m)
  t.site!.done[j] = true
  t.log.push(k === 1 || k === 2 ? `  Take ${label(m)} (${SUIT_ROLE[k]}): free.`
    : k === 3 ? `  Take ${label(m)} (obstacle): swap it for ${spent.map(label).join(' + ')}.`
    : `  Take ${label(m)} (monster, strength ${strength(m)}): beat it with ${spent.map(label).join(' + ')}.`)
  if (t.site!.done.every(Boolean)) finishSite(t)
  return settle(t)
}
/** Rule: you must take every spread card you can pay for. You may leave only when nothing left is affordable. */
export const canLeave = (s: State) => !!s.site && !s.over && !overflow(s) && s.site.cards.every((_, j) => s.site!.done[j] || !cheapestPay(s, j))
export function leave(s: State): State | null {
  if (!canLeave(s)) return null
  const t = cloneState(s)
  t.log.push('  You cannot pay for the rest; those cards are forgotten.')
  finishSite(t)
  return settle(t)
}
export function open(s: State): State | null {
  if (!canOpen(s)) return null
  const t = cloneState(s)
  t.over = 'win'
  t.log.push('You stand on the finish card holding your run: YOU WIN!')
  return settle(t)
}
export function discard(s: State, i: number): State | null {
  if (!overflow(s) || i < 0 || i >= s.pack.length) return null
  const t = cloneState(s)
  const [c] = spendPack(t, [i])
  t.log.push(`Pack over ${LIMIT}: discard ${label(c)}.`)
  return t
}

// ---------- advisor (the sim's greedy heuristic, ~47% wins) ----------
export type Advice =
  | { kind: 'move'; d: number } | { kind: 'zoom'; pay: Pay } | { kind: 'scout'; pay: Pay }
  | { kind: 'take'; j: number; pay: Pay } | { kind: 'leave' } | { kind: 'open' } | { kind: 'discard'; i: number }
export interface Tip { advice: Advice; text: string }

const siteBonus = (c: number, S: number) => (suit(c) === S ? 2 : 0)
function cellScore(s: State, i: number): number {
  const c = s.gc[i]
  if (c < 0) return 0
  if (!s.gup[i]) return 5.2
  if (c === s.vault) return hasKey(s) ? 900 : keyProgress(s) >= 0.66 ? 8 : 2
  if (s.gdone[i]) return 0.5
  return 4 + 1.6 * siteK(rank(c)) + siteBonus(c, s.S)
}
const TARGET = [1, 7, 3, 5]
const DISC = [[6, 7, 8], [0, 1, 2], [2, 5, 8], [0, 3, 6]]

export function advise(s: State): Tip | null {
  if (s.over) return null
  if (overflow(s)) {
    const i = lowestIdx(s)[0]
    return { advice: { kind: 'discard', i }, text: `Your pack is over ${LIMIT}. Discard ${label(s.pack[i])}: it helps your key the least.` }
  }
  if (s.site) {
    let best = null as Tip | null
    let bc = Infinity
    s.site.cards.forEach((m, j) => {
      if (s.site!.done[j]) return
      const cp = cheapestPay(s, j)
      if (!cp || cp.cost >= bc) return
      bc = cp.cost
      const how = cp.pay.length ? ` (pay ${cp.pay.map(i => label(s.pack[i])).join(' + ')}: the cards you need least)` : ' (free)'
      best = { advice: { kind: 'take', j, pay: cp.pay }, text: `Take ${label(m)}${how}. You must take everything you can pay for; free cards first, then the cheapest.` }
    })
    return best ?? { advice: { kind: 'leave' }, text: 'You cannot pay for anything left here. Finish the site.' }
  }
  if (canOpen(s)) return { advice: { kind: 'open' }, text: 'You are on the finish card and hold your run. Finish the game!' }
  const keyed = hasKey(s)
  const down = s.gup.filter((u, i) => !u && s.gc[i] >= 0).length
  const vi = vaultCell(s)
  const payZ = lowestIdx(s).slice(0, zoomCost(s))
  const payNames = payZ.map(i => label(s.pack[i])).join(' + ')
  let bestS = -Infinity
  let best = null as Tip | null
  const consider = (sc: number, tip: Tip) => { if (sc > bestS) { bestS = sc; best = tip } }
  if (canZoom(s)) consider(s.pack.length >= zoomCost(s) + 1 ? 5 + 1.6 * siteK(rank(s.gc[4])) : 1, { advice: { kind: 'zoom', pay: payZ }, text: `Zoom in on ${label(s.gc[4])} (pay ${payNames}): unexplored regions are where loot is.` })
  if (canScout(s)) consider(s.pack.length >= zoomCost(s) + 2 ? 0.55 * down : 0, { advice: { kind: 'scout', pay: payZ }, text: `Zoom out (pay ${payNames}) to see the whole map and find the finish card.` })
  if (canMove(s)) {
    for (let d = 0; d < 4; d++) {
      let sc = cellScore(s, TARGET[d]) - 0.25 * DISC[d].reduce((x, g) => x + cellScore(s, g), 0)
      if (keyed && vi >= 0) {
        const r = Math.floor(vi / 3), c = vi % 3
        if ((d === 0 && r < 1) || (d === 1 && r > 1) || (d === 2 && c < 1) || (d === 3 && c > 1)) sc += 30
      }
      const tc = s.gc[TARGET[d]]
      consider(sc, { advice: { kind: 'move', d }, text: `Move ${DIR[d]}${tc >= 0 && s.gup[TARGET[d]] ? ` to ${label(tc)}` : ' into the unknown'}${keyed && vi >= 0 ? ' (toward the finish card)' : ''}.` })
    }
  }
  return best
}

/** Apply a tip's advice to the state (used by the "do it" button and the smoke test). */
export function applyAdvice(s: State, a: Advice): State | null {
  switch (a.kind) {
    case 'move': return move(s, a.d)
    case 'zoom': return zoom(s, a.pay)
    case 'scout': return scout(s, a.pay)
    case 'take': return take(s, a.j, a.pay)
    case 'leave': return leave(s)
    case 'open': return open(s)
    case 'discard': return discard(s, a.i)
  }
}

/** Where is each card of the key suit? For the "ranks of the key suit" tracker. */
export type Where = 'pack' | 'gone' | 'table' | 'vault' | 'unknown'
export function whereIs(s: State, c: number): Where {
  if (c === s.vault) return 'vault'
  if (s.pack.includes(c)) return 'pack'
  if (s.ashes.includes(c)) return 'gone'
  if (s.gc.some((x, i) => x === c && s.gup[i]) || s.site?.cards.includes(c)) return 'table'
  return 'unknown'
}

/** The most promising run of the key suit: what you hold, what is missing, and whether it is still possible. */
export interface KeyPlan { ranks: number[]; have: number[]; missing: number[]; dead: boolean }
export function keyPlan(s: State): KeyPlan | null {
  let best: KeyPlan | null = null
  let bestScore = -1
  for (let a = 2; a + s.L - 1 <= 13; a++) {
    const ranks = Array.from({ length: s.L }, (_, k) => a + k)
    const cardOf = (r: number) => (r - 2) * 4 + s.S
    const have = ranks.filter(r => s.pack.includes(cardOf(r)))
    const missing = ranks.filter(r => !have.includes(r))
    const dead = missing.some(r => s.ashes.includes(cardOf(r)))
    if (dead) continue
    // prefer more cards held, then more of the missing ones already visible on the table
    const visible = missing.filter(r => whereIs(s, cardOf(r)) === 'table').length
    const score = have.length * 10 + visible
    if (score > bestScore) { bestScore = score; best = { ranks, have, missing, dead: false } }
  }
  return best ?? { ranks: [], have: [], missing: [], dead: true }
}
