// bun scripts/smoke.ts [games] — plays N games with the advisor; it is the sim's careful bot (~54%: `node ../sim/sim.ts careful`)
import { advise, applyAdvice, keyCount, newGame } from '../../core/engine'
const N = +(process.argv[2] ?? 2000)
let win = 0, steps = 0, endless = 0
const why: Record<string, number> = {}, keysAtLoss = [0, 0, 0, 0, 0]
for (let seed = 1; seed <= N; seed++) {
  let s = newGame(seed), guard = 0
  while (!s.over && guard++ < 600) {
    const tip = advise(s)
    if (!tip) throw new Error(`no advice at seed ${seed}`)
    const next = applyAdvice(s, tip.advice)
    if (!next) throw new Error(`illegal advice ${JSON.stringify(tip)} at seed ${seed}`)
    s = next
  }
  if (!s.over) { endless++; continue }
  if (s.over === 'win') win++
  else { why[s.why!] = (why[s.why!] ?? 0) + 1; keysAtLoss[keyCount(s)]++ }
  steps += s.steps
}
console.log(`advisor: win ${(100 * win / N).toFixed(1)}%  avg actions ${(steps / N).toFixed(1)}  endless ${endless}  losses ${JSON.stringify(why)}  keys at loss ${keysAtLoss.join('/')}`)
