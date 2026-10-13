// bun scripts/guide-smoke.ts [games] [seed|0] — cross-check the real-deck GUIDE against the rules engine.
// The engine plays the role of the physical deck (it knows every card); the guide only learns what we "enter".
// After every step we compare pile, waiting cards, hand, key row, gone pile, map and dig. Also reports the win rate of the guide's suggestions.
import * as E from '../../core/engine'
import * as G from '../src/guide'

const N = +(process.argv[2] ?? 2000)
const only = process.argv[3] && +process.argv[3] ? +process.argv[3] : null
const eq = (a: unknown, b: unknown, what: string, seed: number, step: number) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`MISMATCH seed ${seed} step ${step}: ${what}\n guide=${JSON.stringify(a)}\n engine=${JSON.stringify(b)}`)
}
const must = <T,>(x: T | null, what: string): T => { if (x === null) throw new Error('illegal: ' + what); return x }

let win = 0, lose = 0, refused = 0
for (let seed = only ?? 1; seed <= (only ?? N); seed++) {
  let e = E.newGame(seed)
  let g = G.newG()
  g = must(G.nextStep(g), 'intro'); g = must(G.setLock(g, e.lock), 'lock')
  { // a key-suit card dealt to the hand is sent back, not kept
    const k = e.pile.find(c => E.suit(c) === e.S)
    if (k !== undefined) { const g2 = must(G.enterPack(g, k), 'key card in hand'); eq(g2.hand.length, 0, 'key card refused', seed, -1); refused++; g = g2 }
  }
  for (const c of e.hand) g = must(G.enterPack(g, c), 'hand')
  g = must(G.enterCell(g, 4, e.gc[4]), 'center')
  let step = 0
  let flipFeed: number[] = [], woundFeed: number | null = null
  while (true) {
    // the player enters whatever the guide asks for, reading it off the physical (= engine) table
    for (let need = G.needOf(g), guard = 0; need; need = G.needOf(g)) {
      if (++guard > 40) throw new Error(`need loop stuck seed ${seed} step ${step}: ${JSON.stringify(need)}`)
      if (need.kind === 'cell') g = must(G.enterCell(g, need.i, e.gc[need.i]), 'cell')
      else if (need.kind === 'flip') g = must(G.enterFlip(g, must(flipFeed.shift() ?? null, 'nothing to flip')), 'flip')
      else if (need.kind === 'wound') { g = must(G.enterWound(g, must(woundFeed, 'no wound')), 'wound'); woundFeed = null }
      else throw new Error('unexpected need ' + need.kind)
    }
    eq(flipFeed.length, 0, 'every flipped card entered', seed, step)
    // invariants
    eq(g.pile, e.pile.length, 'pile', seed, step); eq(g.wait, e.wait, 'waiting', seed, step)
    eq(g.hand, e.hand, 'hand', seed, step); eq(g.keys, e.keys, 'key row', seed, step)
    eq([...g.gone].sort((a, b) => a - b), [...e.gone].sort((a, b) => a - b), 'gone', seed, step)
    eq(g.dig && { ...g.dig, asking: undefined }, e.dig && { ...e.dig, asking: undefined }, 'dig', seed, step)
    eq(g.over, e.over, 'over', seed, step); eq(g.why, e.why, 'why', seed, step)
    if (g.over) break
    eq(g.grid.map(c => (c.gap ? -1 : c.up ? c.c : -2)), e.gc.map((c, i) => (c < 0 ? -1 : e.gup[i] ? c : -2)), 'map', seed, step)
    eq(g.grid.map(c => (c.gap ? 0 : c.done)), e.gdone.map((d, i) => (e.gc[i] < 0 ? 0 : d)), 'explored', seed, step)
    eq(JSON.stringify(G.advise(g)), JSON.stringify(E.advise(e)), 'advice', seed, step)
    const tip = G.advise(g)
    if (!tip) throw new Error('no advice at seed ' + seed)
    const a = tip.advice
    const before = e
    switch (a.kind) {
      case 'move': g = must(G.move(g, a.d, a.eat), 'move'); e = must(E.move(e, a.d, a.eat), 'e move'); break
      case 'scout': g = must(G.scout(g, a.pay), 'scout'); e = must(E.scout(e, a.pay), 'e scout'); break
      case 'dig': case 'flip': case 'take': case 'leave': { // zooming in flips the first card; taking or leaving a key card flips again
        const gs = { dig: () => G.dig(g), flip: () => G.flip(g), take: () => G.take(g, (a as { i: number }).i), leave: () => G.leave(g) }
        const es = { dig: () => E.dig(e), flip: () => E.flip(e), take: () => E.take(e, (a as { i: number }).i), leave: () => E.leave(e) }
        g = must(gs[a.kind](), a.kind); e = must(es[a.kind](), 'e ' + a.kind)
        const n = before.pile.length - e.pile.length
        flipFeed = before.pile.slice(before.pile.length - n).reverse() // the cards turned over, top first
        break
      }
      case 'stop': g = must(G.stop(g), 'stop'); e = must(E.stop(e), 'e stop'); break
      case 'fight': g = must(G.fight(g, a.i), 'fight'); e = must(E.fight(e, a.i), 'e fight'); break
      case 'flee': {
        g = must(G.flee(g), 'flee'); e = must(E.flee(e), 'e flee')
        const lost = before.hand.filter(c => !e.hand.includes(c))
        woundFeed = lost.length ? lost[0] : null
        break
      }
      case 'discard': g = must(G.discard(g, a.i), 'discard'); e = must(E.discard(e, a.i), 'e discard'); break
      case 'claim': g = must(G.claim(g), 'claim'); e = must(E.claim(e), 'e claim'); break
      case 'finish': g = must(G.finish(g), 'finish'); e = must(E.finish(e), 'e finish'); break
    }
    if (++step > 700) throw new Error('endless game at seed ' + seed)
  }
  if (g.over === 'win') win++; else lose++
}
console.log(`guide == engine on ${only ? 1 : N} games (${refused} key-suit hand cards refused). guide suggestions: win ${(100 * win / (win + lose)).toFixed(1)}%  (lose ${lose})`)
