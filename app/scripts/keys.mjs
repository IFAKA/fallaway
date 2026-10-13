// node scripts/keys.mjs — keyboard play: Space digs and flips, arrows + a digit move and eat, and a focused button never doubles a key press.
import puppeteer from 'puppeteer-core'
const url = (process.env.URL ?? 'http://localhost:5199/').replace(/\/$/, '')
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1300, height: 1000 })
const errors = []
p.on('pageerror', e => errors.push(String(e)))
await p.evaluateOnNewDocument(() => localStorage.setItem('zoom-seen-intro-v4', '1'))
const sleep = (t) => new Promise(r => setTimeout(r, t))
const log = () => p.evaluate(() => [...document.querySelectorAll('.log > div')].map(e => e.textContent))
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1 }
await p.goto(url + '/?seed=5', { waitUntil: 'networkidle0' }); await sleep(500)
const n0 = (await log()).length
await p.keyboard.press('Space'); await sleep(200)
let l = await log()
if (l.length !== n0 + 1 || !/Zoom IN/.test(l.at(-1))) fail('Space should dig once: ' + l.slice(n0).join(' | '))
await p.keyboard.press('Space'); await sleep(200)
l = await log()
if (!/Flip/.test(l.at(-1))) fail('Space in a dig should flip: ' + l.at(-1))
// a focused button must not double the key press
await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.includes('Stop'))?.focus())
const n1 = (await log()).length
await p.keyboard.press('s'); await sleep(200)
l = await log()
if (l.length !== n1 + 1 || !/Stop/.test(l.at(-1))) fail('S should stop once: ' + l.slice(n1).join(' | '))
await p.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent.includes('New game'))?.focus())
const n2 = (await log()).length
await p.keyboard.press('ArrowRight'); await sleep(100); await p.keyboard.press('1'); await sleep(900)
l = await log()
if (l.length !== n2 + 1 || !/Move right \(eat/.test(l.at(-1))) fail('arrow + 1 should move right eating the first card: ' + l.slice(n2).join(' | '))
const n3 = (await log()).length
await p.keyboard.press('Space'); await sleep(300)
l = await log()
if (/New game/.test(l.join(' ')) && l.length < n3) fail('Space on a focused New game button started a new game')
if (l.length !== n3 + 1 && l.length !== n3) fail('Space should do at most one game action: ' + l.slice(n3).join(' | '))
console.log('log tail:', l.slice(-3).join(' | '))
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no page errors')
console.log(process.exitCode ? 'keys: FAILED' : 'keys: ok')
await b.close()
