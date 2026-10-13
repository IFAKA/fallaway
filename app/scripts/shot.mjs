// node scripts/shot.mjs [outdir] — drive the running dev server (URL env, default localhost:5199) in headless Chrome, press a move arrow,
// eat a card, and sample card positions during the animation. A smooth slide shows intermediate x/y values; a jump shows only start and end.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const out = process.argv[2] ?? '/tmp/shots'
fs.mkdirSync(out, { recursive: true })
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1300, height: 950 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('zoom-mode', 'practice'); localStorage.setItem('zoom-seen-intro-v4', '1') })
await p.goto(`${process.env.URL ?? 'http://localhost:5199/'}?seed=7`, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 1200))
await p.screenshot({ path: `${out}/0-start.png` })
const rects = () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.stage .acard')].map(e => { const r = e.getBoundingClientRect(); return [e.textContent.slice(0, 3), [Math.round(r.x), Math.round(r.y)]] })))
const stageTop = await p.evaluate(() => document.querySelector('.stage').getBoundingClientRect().y)
const before = await rects()
await p.evaluate(() => [...document.querySelectorAll('.stage .arrow')].find(e => e.textContent === '◀').click())
await new Promise(r => setTimeout(r, 100))
// eat the first hand card (the move happens now)
await p.evaluate(() => { const st = document.querySelector('.stage').getBoundingClientRect(); [...document.querySelectorAll('.stage .acard.clickable')].find(e => e.getBoundingClientRect().y - st.y > 600).click() })
const t0 = Date.now(), samples = []
for (const t of [60, 180, 320, 450, 900]) {
  await new Promise(r => setTimeout(r, Math.max(0, t - (Date.now() - t0))))
  samples.push([t, await rects()])
  await p.screenshot({ path: `${out}/shift-${t}.png`, clip: { x: 0, y: stageTop - 10, width: 720, height: 420 } })
}
const first = Object.keys(before).find(k => k in samples[4][1] && JSON.stringify(before[k]) !== JSON.stringify(samples[4][1][k]))
console.log('tracked card', first, 'start', before[first], samples.map(([t, r]) => `${t}ms:${JSON.stringify(r[first])}`).join('  '))
await b.close()
