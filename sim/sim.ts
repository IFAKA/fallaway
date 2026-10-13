// Zoom — simulator. It plays the app's rules engine (core/engine.ts), so the simulator and the app cannot disagree.
// Usage: node sim/sim.ts [careful|beginner|random|mix] [games=2000] [seed0=1]   -> win rate + game stats
//        node sim/sim.ts report [games]      -> skill ladder (careful / beginner / random) + what each decision is worth
//        node sim/sim.ts bylock [games]      -> win rate by lock rank and key suit (fairness)
//        node sim/sim.ts luck [deals] [n]    -> replay each deal n times with 5% random moves: how many deals can be won at all
//        node sim/sim.ts run [policy] [seed] -> narrated game (RUN_EXAMPLE.md is `node sim/sim.ts run careful 57`)
// There are no rule knobs: to test a rule change, change core/engine.ts (on a branch) and compare reports.
// The rule variants tested while designing v4 (BIOME, TRAIL, FIGHT=..., EDGE=gone, ...) live in archive/sim-v4.mjs.
// Bot knobs (env): SIMPLE=nav,zoom,push,fight,pay,scout,take (for `mix`: swap those decisions for the beginner's), NOISE=0.05 (random moves).

import {
  EDGE, RUN, SUITS, TARGET, adviseMove, advise, canClaim, canDig, canFinish, canFlip, canMove, canScout, claim, dig, discard, fight,
  fightersOf, finish, flee, flip, hasKey, isKeyCard, keepVals, keyCount, label, legalActions, lockWant, move, newGame, overflow, rank,
  rankLabel, scout, stop, suit, take, leave, vaultCell, viewOf, visibleCards,
} from '../core/engine.ts'
import type { Advice, State } from '../core/engine.ts'

type Rng = () => number
type Policy = (s: State, R: Rng) => Advice | null
const E = process.env
const MAX_STEPS = 600

function mkRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- policies ----------
/** the careful bot is the app's advisor: it only uses what the player can see */
const careful: Policy = s => advise(s)?.advice ?? null
const randomP: Policy = (s, R) => { const l = legalActions(s); return l.length ? l[Math.floor(R() * l.length)] : null }

const lowestRank = (hand: number[], idx = [...hand.keys()]) => idx.reduce((w, i) => (rank(hand[i]) < rank(hand[w]) ? i : w), idx[0])
/** a beginner fights with the lowest card that wins, ignoring what it opens */
const lowFight = (s: State): Advice => ({ kind: 'fight', i: lowestRank(s.hand, fightersOf(s.hand, keepVals(s), s.dig!.hostile)) })
/** a beginner steps toward the best-looking card and eats their lowest card */
function beginnerMove(s: State, R: Rng): Advice | null {
  if (!canMove(s)) return null
  const val = (i: number) => {
    const c = s.gc[i]
    const v = c < 0 || s.gdone[i] || c === s.vault ? -1 : s.gup[i] && isKeyCard(s, c) ? (s.hand.some(x => rank(x) === rank(c)) ? 50 : -1) : s.gup[i] ? rank(c) : 5
    return v + R() * 0.1
  }
  const sc = TARGET.map(val)
  const d = sc.indexOf(Math.max(...sc))
  return { kind: 'move', d, eat: lowestRank(s.hand) }
}
/** a beginner takes every key card met while digging, paying with the lowest card of its rank (all match in rank: the first one) */
const takeAny = (s: State): Advice => ({ kind: 'take', i: s.hand.findIndex(c => rank(c) === rank(s.dig!.found)) })
/** the obvious plan: dig whatever you stand on, flip to the bottom, fight whenever you can, claim every key card, step to the best-looking card */
const beginner: Policy = (s, R) => {
  if (s.dig) {
    if (s.dig.found >= 0) return takeAny(s)
    if (s.dig.hostile >= 0) return fightersOf(s.hand, keepVals(s), s.dig.hostile).length ? lowFight(s) : { kind: 'flee' }
    return canFlip(s) ? { kind: 'flip' } : { kind: 'stop' }
  }
  if (overflow(s)) return { kind: 'discard', i: lowestRank(s.hand) }
  if (canFinish(s)) return { kind: 'finish' }
  if (canClaim(s)) return { kind: 'claim' }
  if (hasKey(s)) {
    const vi = vaultCell(s)
    if (vi >= 0 && canMove(s)) { const r = Math.floor(vi / 3), c = vi % 3; return { kind: 'move', d: r < 1 ? 0 : r > 1 ? 1 : c < 1 ? 2 : 3, eat: lowestRank(s.hand) } }
    if (canScout(s)) return { kind: 'scout', pay: [] }
  }
  if (canDig(s)) return { kind: 'dig' }
  return beginnerMove(s, R)
}
/** per-decision skill: the careful bot with some decisions swapped for the beginner's */
function mixOf(swap: Set<string>): Policy {
  return (s, R) => {
    const tip = careful(s, R)
    if (s.dig) {
      if (s.dig.found >= 0) return swap.has('take') ? takeAny(s) : tip
      if (s.dig.hostile >= 0) {
        if (swap.has('fight')) { const f = fightersOf(s.hand, keepVals(s), s.dig.hostile); return !f.length ? { kind: 'flee' } : swap.has('pay') ? lowFight(s) : { kind: 'fight', i: f[0] } }
        return tip?.kind === 'fight' && swap.has('pay') ? lowFight(s) : tip
      }
      return swap.has('push') ? (canFlip(s) ? { kind: 'flip' } : { kind: 'stop' }) : tip
    }
    if (overflow(s)) return swap.has('pay') ? { kind: 'discard', i: lowestRank(s.hand) } : tip
    if (hasKey(s) || canFinish(s) || canClaim(s)) return tip
    if (swap.has('zoom') && canDig(s)) return { kind: 'dig' }
    let a = tip
    if (a?.kind === 'scout' && swap.has('scout')) a = adviseMove(viewOf(s))?.advice ?? null // a beginner never zooms out before holding the key
    if (a?.kind === 'move' && swap.has('nav')) { const b = beginnerMove(s, R); if (b?.kind === 'move') a = { ...b, eat: a.eat } }
    if (a?.kind === 'move' && swap.has('pay')) a = { ...a, eat: lowestRank(s.hand) }
    return a
  }
}
const SIMPLE = new Set((E.SIMPLE ?? '').split(',').filter(Boolean))
const POLICIES: Record<string, Policy> = { careful, beginner, random: randomP, mix: mixOf(SIMPLE) }

// ---------- running ----------
interface Stats { digs: number; flips: number; fights: number; flees: number; takes: number; leaves: number; moves: number; lostWantedKeys: number }
interface Game { s: State; stats: Stats; over: 'win' | 'lose' | 'stall' }

/** apply one action; the wound when fleeing comes from the bot's random stream, so replays of one deal differ */
function act(s: State, a: Advice, R: Rng): State | null {
  switch (a.kind) {
    case 'move': return move(s, a.d, a.eat)
    case 'scout': return scout(s, a.pay)
    case 'dig': return dig(s)
    case 'flip': return flip(s)
    case 'stop': return stop(s)
    case 'fight': return fight(s, a.i)
    case 'flee': return flee(s, s.hand.length ? Math.floor(R() * s.hand.length) : undefined)
    case 'take': return take(s, a.i)
    case 'leave': return leave(s)
    case 'discard': return discard(s, a.i)
    case 'claim': return claim(s)
    case 'finish': return finish(s)
  }
}
/** play one deal; `onAct` sees every state after an action (for the narrated run) */
export function play(seed: number, policy: string, rs = 0, noise = +(E.NOISE ?? 0), onAct?: (s: State, a: Advice) => void): Game {
  let s = newGame(seed)
  const R = mkRng(seed * 7919 + 13 + rs * 104729)
  const pol = POLICIES[policy]
  const stats: Stats = { digs: 0, flips: 0, fights: 0, flees: 0, takes: 0, leaves: 0, moves: 0, lostWantedKeys: 0 }
  while (!s.over) {
    if (s.steps > MAX_STEPS) return { s, stats, over: 'stall' }
    const a = (noise && R() < noise ? randomP(s, R) : pol(s, R)) ?? randomP(s, R)
    if (!a) throw new Error(`seed ${seed}: no legal action, but the game is not over`)
    if (a.kind === 'move') {
      const { want } = lockWant(s, visibleCards(s))
      stats.lostWantedKeys += EDGE[a.d].filter(i => isKeyCard(s, s.gc[i]) && want.has(rank(s.gc[i]))).length
      stats.moves++
    }
    if (a.kind === 'dig') stats.digs++
    if (a.kind === 'flip') stats.flips++
    if (a.kind === 'fight') stats.fights++
    if (a.kind === 'flee') stats.flees++
    if (a.kind === 'take') stats.takes++
    if (a.kind === 'leave') stats.leaves++
    const next = act(s, a, R)
    if (!next) throw new Error(`seed ${seed}: illegal action ${JSON.stringify(a)}`)
    s = next
    onAct?.(s, a)
  }
  return { s, stats, over: s.over }
}

function render(s: State) {
  const rows: string[] = []
  for (let r = 0; r < 3; r++) {
    let line = ''
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c, k = s.gc[i]
      const cell = k < 0 ? '..' : !s.gup[i] ? '??' : label(k) + (s.gdone[i] ? '✓' : '')
      line += (i === 4 ? `[${cell}]` : ` ${cell} `).padEnd(7)
    }
    rows.push('   ' + line)
  }
  const byRank = (a: number, b: number) => rank(a) - rank(b)
  rows.push(`   Hand(${s.hand.length}): ${s.hand.slice().sort((a, b) => suit(a) - suit(b) || byRank(a, b)).map(label).join(' ')}`)
  rows.push(`   Key row: ${s.keys.slice().sort(byRank).map(label).join(' ')}   Pile: ${s.pile.length}${s.wait.length ? `   Waiting: ${s.wait.map(label).join(' ')}` : ''}   Gone: ${s.gone.length}`)
  return rows.join('\n')
}

function run(policy: string, games: number, seed0: number) {
  const res = { win: 0, lose: 0, stall: 0 }
  const why: Record<string, number> = {}
  const keysAtLoss = Array(RUN + 1).fill(0)
  const tot: Stats = { digs: 0, flips: 0, fights: 0, flees: 0, takes: 0, leaves: 0, moves: 0, lostWantedKeys: 0 }
  let steps = 0
  for (let g = 0; g < games; g++) {
    const { s, stats, over } = play(seed0 + g, policy)
    res[over]++
    if (over === 'lose') { why[s.why!] = (why[s.why!] ?? 0) + 1; keysAtLoss[keyCount(s)]++ }
    steps += s.steps
    for (const k of Object.keys(tot) as (keyof Stats)[]) tot[k] += stats[k]
  }
  const perGame = Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, v / games]))
  return { policy, win: (100 * res.win) / games, steps: steps / games, why, keysAtLoss, perGame, stall: res.stall }
}
const fmt = (r: ReturnType<typeof run>) =>
  `${r.policy.padEnd(9)} win ${r.win.toFixed(1).padStart(5)}%  actions ${r.steps.toFixed(1)}  per game: ${Object.entries(r.perGame).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}  losses: ${Object.entries(r.why).map(([k, v]) => `${k} ${v}`).join(' ')} keys-at-loss (0/1/2/3/4) ${r.keysAtLoss.join('/')}${r.stall ? `  STALL ${r.stall}` : ''}`

const args = process.argv.slice(2)
if (args[0] === 'run') {
  const policy = args[1] ?? 'careful', seed = +(args[2] ?? 1)
  const s0 = newGame(seed)
  const out = [s0.log[0], '', 'START', render(s0), '']
  let seen = s0.log.length
  const { s } = play(seed, policy, 0, 0, (st, a) => {
    out.push(...st.log.slice(seen)); seen = st.log.length
    if (!st.dig && ['move', 'scout', 'claim', 'stop', 'flee', 'flip', 'fight', 'take', 'leave'].includes(a.kind)) out.push(render(st), '')
  })
  out.push('', `RESULT: ${s.over!.toUpperCase()} after ${s.steps} actions.`)
  console.log(out.join('\n'))
} else if (args[0] === 'report') {
  const G = +(args[1] ?? 3000)
  for (const p of ['careful', 'beginner', 'random']) console.log(fmt(run(p, G, 1)))
  for (const x of ['nav', 'zoom', 'push', 'fight', 'pay', 'scout', 'take']) { POLICIES.mix = mixOf(new Set([x])); console.log(`swap ${x.padEnd(6)} ${run('mix', G, 1).win.toFixed(1)}%`) }
} else if (args[0] === 'bylock') { // win rate by lock rank and by key suit
  const G = +(args[1] ?? 4000), pol = args[2] ?? 'careful'
  const br: Record<string, [number, number]> = {}, bs: Record<string, [number, number]> = {}
  for (let g = 1; g <= G; g++) {
    const { s, over } = play(g, pol), r = rankLabel(rank(s.lock)), k = SUITS[s.S]
    ;(br[r] ??= [0, 0])[1]++; (bs[k] ??= [0, 0])[1]++
    if (over === 'win') { br[r][0]++; bs[k][0]++ }
  }
  const order = (k: string) => +k || 20 + k.charCodeAt(0)
  const f = (m: Record<string, [number, number]>) => Object.entries(m).sort((a, b) => order(a[0]) - order(b[0])).map(([k, [w, n]]) => `${k}:${((100 * w) / n).toFixed(0)}%`).join(' ')
  console.log(`${pol} by lock rank: ${f(br)}\n${pol} by key suit: ${f(bs)}`)
} else if (args[0] === 'luck') { // replay each deal with different random streams: how many deals can be won at all?
  const G = +(args[1] ?? 300), N = +(args[2] ?? 20), noise = +(E.NOISE ?? 0.05), rates: number[] = []
  for (let g = 1; g <= G; g++) { let w = 0; for (let k = 0; k < N; k++) if (play(g, 'careful', k, noise).over === 'win') w++; rates.push(w / N) }
  const b = (lo: number, hi: number) => rates.filter(r => r >= lo && r < hi).length
  console.log(`deals ${G} x ${N} replays: never won ${b(0, 1e-9)}  1-25% ${b(1e-9, 0.25)}  25-50% ${b(0.25, 0.5)}  50-75% ${b(0.5, 0.75)}  75-99% ${b(0.75, 1)}  always ${b(1, 2)}`)
} else if (args.length && POLICIES[args[0]]) {
  console.log(fmt(run(args[0], +(args[1] ?? 2000), +(args[2] ?? 1))))
} else {
  console.log('usage: node sim/sim.ts [careful|beginner|random|mix|report|bylock|luck|run] ...')
}
