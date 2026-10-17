// node scripts/shot-ui.mjs — screenshot the practice screen mid-game (danger tags) and at the end of a hinted game (record, near-miss).
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
fs.mkdirSync('/tmp/shots', { recursive: true })
const url = (process.env.URL ?? 'http://localhost:5199/').replace(/\/$/, '')
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1300, height: 1000 })
const errors = []
p.on('pageerror', e => errors.push(String(e)))
await p.evaluateOnNewDocument(() => { localStorage.setItem('zoom-seen-intro-v4', '1') })
const sleep = (t) => new Promise(r => setTimeout(r, t))
const click = (text) => p.evaluate((text) => { const e = [...document.querySelectorAll('button')].find(e => (e.textContent.includes(text) || e.getAttribute('aria-label') === text) && !e.disabled); if (e) e.click(); return !!e }, text)
await p.goto(url + '/?play', { waitUntil: 'networkidle0' })
await click('New game'); await sleep(700)
await click('Hint: off'); await sleep(200)
await click('Zoom OUT'); await sleep(300)
await p.evaluate(() => [...document.querySelectorAll('.stage .acard.clickable')].pop()?.click()); await sleep(900)
await p.screenshot({ path: '/tmp/shots/ui-danger.png' })
const tags = await p.evaluate(() => [...document.querySelectorAll('.ctag')].map(e => e.textContent))
for (let i = 0; i < 400 && !(await p.$('.endbox')); i++) { if (!(await click('Do it'))) break; await sleep(60) }
await sleep(900)
await p.screenshot({ path: '/tmp/shots/ui-end.png' })
console.log('tags', tags.join(' | '))
console.log('end:', await p.evaluate(() => document.querySelector('.endbox')?.innerText))
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no page errors')
await b.close()
