// node scripts/shot-hostile.mjs [seed] [steps] — practice screen: follow the hint for N steps (seed 1, 13 steps = a hostile card
// you can beat) and screenshot the dig with the hint on and off. URL env = dev server (default http://localhost:5199).
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
fs.mkdirSync('/tmp/shots', { recursive: true })
const seed = +(process.argv[2] ?? 1), steps = +(process.argv[3] ?? 13)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1300, height: 1000 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('zoom-mode', 'practice'); localStorage.setItem('zoom-seen-intro-v4', '1') })
await p.goto(`${process.env.URL ?? 'http://localhost:5199'}/?seed=${seed}`, { waitUntil: 'networkidle0' })
const sleep = (t) => new Promise(r => setTimeout(r, t))
const click = (text) => p.evaluate((text) => { const e = [...document.querySelectorAll('button')].find(e => e.textContent.includes(text) && !e.disabled); if (e) e.click(); return !!e }, text)
await click('Hint off')
for (let i = 0; i < steps; i++) { await click('Do it'); await sleep(60) }
await sleep(900)
await p.screenshot({ path: '/tmp/shots/hostile-hint.png' })
await click('Hint on'); await sleep(300)
await p.screenshot({ path: '/tmp/shots/hostile.png' })
console.log(await p.evaluate(() => document.querySelector('.gtitle')?.textContent))
await b.close()
