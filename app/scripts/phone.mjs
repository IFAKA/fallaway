// node scripts/phone.mjs — screenshot both modes at phone size (390x844) to check the table scales to fit. URL env = dev server.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
fs.mkdirSync('/tmp/shots', { recursive: true })
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const url = process.env.URL ?? 'http://localhost:5199/'
await p.evaluateOnNewDocument(() => { if (!localStorage.getItem('zoom-mode')) localStorage.setItem('zoom-mode', 'practice'); localStorage.setItem('zoom-seen-intro-v4', '1') })
await p.goto(url + '?seed=1', { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 1200))
const wide = await p.evaluate(() => document.documentElement.scrollWidth)
await p.screenshot({ path: '/tmp/shots/phone-practice.png', fullPage: true })
await p.evaluate(() => localStorage.setItem('zoom-mode', 'guide')); await p.goto(url, { waitUntil: 'networkidle0' })
for (const t of ['Start setup']) await p.evaluate((t) => [...document.querySelectorAll('button')].find(e => e.textContent.includes(t))?.click(), t)
for (const c of ['7♣', 'Q♥', '2♦', '9♠', '10♥', 'K♦', '3♠', '5♥', '6♦', '8♠', '4♥']) await p.evaluate((c) => [...document.querySelectorAll('.pbtn')].find(e => e.textContent === c && !e.disabled)?.click(), c)
await new Promise(r => setTimeout(r, 1200))
await p.screenshot({ path: '/tmp/shots/phone-guide.png' })
console.log('page width', wide, '(viewport 390)')
await b.close()
