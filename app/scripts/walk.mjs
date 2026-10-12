// node scripts/walk.mjs [seed] — play a whole real-deck guide game in headless Chrome, following the glowing suggestion,
// entering random unseen cards when asked; prints every screen (title, body, table steps, what it asks) to read for gaps.
import puppeteer from 'puppeteer-core'
let seed = +(process.argv[2] ?? 1)
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 1000 })
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' })
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('zoom-mode', 'guide') })
await p.reload({ waitUntil: 'networkidle0' })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const screen = () => p.evaluate(() => {
  const t = (s) => document.querySelector(s)?.innerText.trim() ?? ''
  return { title: t('.gtitle'), body: t('.gbody'), todo: t('.donow'), ask: t('.enter .dntitle'), status: [...document.querySelectorAll('.stat')].map(e => e.innerText).join(' | ') }
})
let last = ''
for (let i = 0; i < 400; i++) {
  const sc = await screen()
  const key = JSON.stringify(sc)
  if (key !== last) {
    console.log(`\n=== [${i}] ${sc.title}   ${sc.status}`)
    if (sc.todo) console.log('TABLE:', sc.todo.replace(/\n/g, '\n       '))
    console.log('GUIDE:', sc.body.replace(/\n/g, '\n       '))
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
    for (const t of ['Start setup', 'Done — next', 'Done — start playing', 'Confirm', 'Auto-pick cheapest']) { const e = btn(t); if (e) return click(e) }
    const g = document.querySelector('.hand .gcard.glow:not(.selected)') ?? document.querySelector('.spread .gcard.glow') ?? document.querySelector('.actions button.glow:not(:disabled), .arrow2.glow:not(:disabled)')
    if (g) return 'glow ' + click(g)
    return null
  }, rnd())
  if (!did) { console.log('!! STUCK: nothing to click'); break }
  console.log('  > click', did.replace(/\n/g, ' ').slice(0, 40))
  await sleep(60)
}
await b.close()
