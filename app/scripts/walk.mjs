// node scripts/walk.mjs [seed] — play a whole real-deck guide game in headless Chrome, following the glowing suggestion and
// entering random unseen cards when asked; prints every screen (title, body, table steps, what it asks) to read for gaps.
// URL env = dev server (default http://localhost:5199). SHOTS=10,31 also saves those screens to /tmp/shots/walk-N.png.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
fs.mkdirSync('/tmp/shots', { recursive: true })
let seed = +(process.argv[2] ?? 1)
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 1100 })
const errors = []
p.on('pageerror', e => errors.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await p.goto((process.env.URL ?? 'http://localhost:5199/') + '?play', { waitUntil: 'networkidle0' })
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('zoom-mode', 'guide') })
await p.reload({ waitUntil: 'networkidle0' })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const screen = () => p.evaluate(() => {
  const t = (s) => document.querySelector(s)?.innerText.trim() ?? ''
  return { title: t('.gtitle'), body: t('.gbody'), todo: t('.donow'), ask: t('.enter .dntitle'), status: [...document.querySelectorAll('.stat')].map(e => e.innerText).join(' | ') }
})
let last = '', i = 0
for (; i < 700; i++) {
  const sc = await screen()
  const key = JSON.stringify(sc)
  if (key !== last) {
    console.log(`\n=== [${i}] ${sc.title}   ${sc.status}`)
    if (sc.todo) console.log('TABLE:', sc.todo.replace(/\n/g, '\n       '))
    if (!process.env.QUIET) console.log('GUIDE:', sc.body.replace(/\n/g, '\n       '))
    if (sc.ask) console.log('ASKS :', sc.ask)
    last = key
  }
  if (process.env.SHOTS && String(process.env.SHOTS).split(',').includes(String(i))) await p.screenshot({ path: `/tmp/shots/walk-${i}.png` })
  if (/You won|You lost/.test(sc.title)) break
  const did = await p.evaluate((r) => {
    const click = (e) => { e.click(); return e.innerText || e.className }
    const btn = (txt) => [...document.querySelectorAll('button')].find(e => e.innerText.includes(txt) && !e.disabled)
    const picks = [...document.querySelectorAll('.enter .pbtn')].filter(e => !e.disabled)
    if (picks.length) return 'pick ' + click(picks[Math.floor(r * picks.length)])
    for (const t of ['Start setup']) { const e = btn(t); if (e) return click(e) }
    const g = document.querySelector('.actions button.glow:not(:disabled)') ?? document.querySelector('.stage .arrow.glow:not(:disabled):not(.on)') ?? document.querySelector('.stage .acard.glow.clickable')
    if (g) return 'glow ' + click(g)
    return null
  }, rnd())
  if (!did) { console.log('!! STUCK: nothing to click'); process.exitCode = 1; break }
  console.log('  > click', did.replace(/\n/g, ' ').slice(0, 40))
  await sleep(30)
}
await p.screenshot({ path: '/tmp/shots/walk-end.png' })
await b.close()
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exitCode = 1 }
console.log(`\nwalk finished after ${i} clicks${errors.length ? ' WITH ERRORS' : ''}`)
