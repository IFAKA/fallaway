// bun scripts/smoke.ts [games]  — plays N games with the advisor; should land near the sim's ~40%.
import { advise, applyAdvice, newGame } from '../src/engine'
const N = +(process.argv[2] ?? 2000)
let win = 0, steps = 0, endless = 0
for (let seed = 1; seed <= N; seed++) {
  let s = newGame(seed), guard = 0
  while (!s.over && guard++ < 600) {
    const tip = advise(s)
    if (!tip) break
    const next = applyAdvice(s, tip.advice)
    if (!next) throw new Error(`illegal advice ${JSON.stringify(tip)} at seed ${seed}`)
    s = next
  }
  if (guard >= 600) { endless++; continue } // bot walks in circles holding its key (a human would steer)
  if (s.over === 'win') win++
  steps += s.steps
}
console.log(`advisor: win ${(100 * win / N).toFixed(1)}%  avg actions ${(steps / N).toFixed(1)}  endless ${endless}`)
