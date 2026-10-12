// bun scripts/guide-smoke.ts [games] — cross-check the real-deck GUIDE against the rules engine.
// The engine plays the role of the physical deck (it knows every card); the guide only learns what we "enter".
// After every step we compare piles, hand, gone pile and map. Also reports the win rate of the guide's suggestions.
import * as E from '../src/engine'
import * as G from '../src/guide'

const N = +(process.argv[2] ?? 2000)
const only = process.argv[3] ? +process.argv[3] : null
const eq = (a: unknown, b: unknown, what: string, seed: number, step: number) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`MISMATCH seed ${seed} step ${step}: ${what}\n guide=${JSON.stringify(a)}\n engine=${JSON.stringify(b)}`)
}
const must = <T,>(x: T | null, what: string): T => { if (x === null) throw new Error('illegal: ' + what); return x }

let win = 0, lose = 0, endless = 0
for (let seed = only ?? 1; seed <= (only ?? N); seed++) {
  let e = E.newGame(seed)
  let g = G.newG()
  g = must(G.nextStep(g), 'intro'); g = must(G.setLock(g, e.lock), 'lock'); g = must(G.nextStep(g), 'vault')
  for (const c of e.pack) g = must(G.enterPack(g, c), 'pack')
  g = must(G.enterCell(g, 4, e.gc[4]), 'center'); g = must(G.nextStep(g), 'hide')
  let step = 0
  while (true) {
    // the player enters whatever the guide asks for, reading it off the physical (= engine) table
    let guard = 0
    for (let need = G.needOf(g); need; need = G.needOf(g)) {
      if (++guard > 30) throw new Error(`need loop stuck seed ${seed} step ${step}: ${JSON.stringify(need)} site=${JSON.stringify(g.site)} engineSite=${JSON.stringify(e.site)} pile=${g.pile}/${e.draw.length}`)
      if (need.kind === 'cell') g = must(G.enterCell(g, need.i, e.gc[need.i]), 'cell')
      else if (need.kind === 'spread') { const sc = e.site?.cards ?? [], i = g.site!.cards.length; g = must(G.enterSpread(g, i < sc.length ? sc[i] : e.vault), 'spread') }
      else throw new Error('unexpected need ' + need.kind)
    }
    // invariants
    eq(g.pile, e.draw.length, 'pile', seed, step); eq(g.behind, e.behind.length, 'behind', seed, step); eq(g.recycles, e.recycles, 'recycles', seed, step)
    eq(g.pack, e.pack, 'hand', seed, step); eq([...g.ashes].sort((a, b) => a - b), [...e.ashes].sort((a, b) => a - b), 'gone', seed, step)
    if (!g.over) eq(g.grid.map(c => (c.gap ? -1 : c.c ?? -2)), e.gc.map((c, i) => (c < 0 ? -1 : e.gup[i] ? c : -2)), 'map', seed, step)
    if (!g.over) eq(g.grid.map(c => c.done), e.gdone.map((d, i) => (e.gc[i] < 0 && d === 0 ? 0 : d)), 'explored', seed, step)
    eq(g.over, e.over === 'win' ? 'win' : e.over === 'stuck' ? 'lose' : null, 'over', seed, step)
    if (g.over || e.over) break
    const tip = G.advise(g)
    if (!tip) throw new Error('no advice at seed ' + seed + ' ' + JSON.stringify(g.grid))
    const a = tip.advice
    switch (a.kind) {
      case 'move': g = must(G.move(g, a.d), 'move'); e = must(E.move(e, a.d), 'e move'); break
      case 'zoom': g = must(G.zoom(g, a.pay), 'zoom'); e = must(E.zoom(e, a.pay), 'e zoom'); break
      case 'scout': g = must(G.scout(g, a.pay), 'scout'); e = must(E.scout(e, a.pay), 'e scout'); break
      case 'take': g = must(G.take(g, a.j, a.pay), 'take'); e = must(E.take(e, a.j, a.pay), 'e take'); break
      case 'leave': g = must(G.leave(g), 'leave'); e = must(E.leave(e), 'e leave'); break
      case 'open': g = must(G.open(g), 'open'); e = must(E.open(e), 'e open'); break
      case 'discard': g = must(G.discard(g, a.i), 'discard'); e = must(E.discard(e, a.i), 'e discard'); break
    }
    if (++step > 700) { endless++; break }
  }
  if (step > 700) continue
  if (g.over === 'win') win++; else lose++
}
console.log(`guide == engine on ${N} games. guide suggestions: win ${(100 * win / N).toFixed(1)}%  (lose ${lose}, endless ${endless})`)
