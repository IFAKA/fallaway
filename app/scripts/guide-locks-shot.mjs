// node scripts/guide-locks-shot.mjs — walk the real-deck guide through a setup and a claim on the running dev server
// (URL=http://localhost:5299 by default); screenshots to /tmp/zoomcheck/guide-*.png
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
fs.mkdirSync('/tmp/zoomcheck', { recursive: true })
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
await p.setViewport({ width: 1300, height: 1500 })
await p.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('init')) { localStorage.clear(); localStorage.setItem('zoom-mode', 'guide'); sessionStorage.setItem('init', '1') } })
await p.goto(process.env.URL ?? 'http://localhost:5299', { waitUntil: 'networkidle0' })
const wait = (ms) => new Promise(r => setTimeout(r, ms))
const btn = async (txt) => { const ok = await p.evaluate(t => { const e = [...document.querySelectorAll('button')].find(e => e.textContent.trim().startsWith(t) && !e.disabled); if (e) e.click(); return !!e }, txt); if (!ok) throw new Error('no button ' + txt); await wait(250) }
const pick = async (card) => { const ok = await p.evaluate(t => { const e = [...document.querySelectorAll('.pbtn')].find(e => e.textContent === t && !e.disabled); if (e) e.click(); return !!e }, card); if (!ok) throw new Error('no picker card ' + card); await wait(250) }
const shot = async (n) => { await wait(900); await p.screenshot({ path: `/tmp/zoomcheck/guide-${n}.png` }) }
await shot('0-intro')
await btn('Start setup'); await pick('7♣'); await btn('Done')
await pick('3♣'); await shot('1-keycard-refused') // a key card dealt to the hand: refused
for (const c of ['9♦', '2♥', 'K♠', '5♦', 'Q♥', '4♠', '8♥', '10♦']) await pick(c)
await pick('9♣'); await shot('2-hide') // middle map card
await btn('Done'); await shot('3-play')
await btn('Claim key card'); await shot('4-claimed')
console.log('errors', JSON.stringify(errs))
await b.close()
