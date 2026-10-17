// node scripts/record.mjs — the win record: a game played by hand counts once; a game with Hint does not; Undo un-counts a game.
import puppeteer from 'puppeteer-core'
const url = (process.env.URL ?? 'http://localhost:5199/').replace(/\/$/, '')
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1300, height: 1000 })
const errors = []
p.on('pageerror', e => errors.push(String(e)))
await p.evaluateOnNewDocument(() => localStorage.setItem('zoom-seen-intro-v4', '1'))
const sleep = (t) => new Promise(r => setTimeout(r, t))
const click = (text) => p.evaluate((text) => { const e = [...document.querySelectorAll('button')].find(e => (e.textContent.includes(text) || e.getAttribute('aria-label') === text) && !e.disabled); if (e) e.click(); return !!e }, text)
const clickHand = () => p.evaluate(() => { const st = document.querySelector('.stage').getBoundingClientRect(); const c = [...document.querySelectorAll('.stage .acard.clickable')].filter(e => e.getBoundingClientRect().y - st.y > 600); c[0]?.click(); return c.length })
const end = () => p.evaluate(() => document.querySelector('.endbox')?.innerText ?? null)
/** a dumb player: dig everything, flip to the bottom, fight or flee, walk right eating the first card */
async function playByHand() {
  for (let i = 0; i < 600; i++) {
    if (await end()) return end()
    if (await click('Flip next') || await click('Zoom IN') || await click('Claim key') || await click('Finish')) { await sleep(40); continue }
    if (await clickHand()) { await sleep(40); continue } // a fight, a discard or the card to eat
    if (await click('Flee') || await click('Stop')) { await sleep(40); continue }
    await p.evaluate(() => [...document.querySelectorAll('.stage .arrow')].find(e => !e.disabled)?.click()); await sleep(40)
  }
  return end()
}
/** the daily deal starts from the world menu: back with ← Menu, then its button */
const fromMenu = async (label) => { await click('← Menu'); await p.waitForFunction((l) => [...document.querySelectorAll('button')].some(e => e.textContent.includes(l)), {}, label); await click(label); await sleep(1500) }
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1 }
await p.goto(url + '/?play', { waitUntil: 'networkidle0' }); await p.evaluate(() => localStorage.removeItem('zoom-stats-v1'))
await click('New game'); await sleep(300)
let t = await playByHand()
console.log('by hand:', t.split('\n').slice(0, 3).join(' / '))
if (!/of 1 \(/.test(t) || /not counted/.test(t)) fail('a game played by hand should count once')
await click('Undo last move'); await sleep(200); await playByHand(); t = await end()
if (!/of 1 \(/.test(t)) fail('replaying the end after Undo must not count again')
await click('New game'); await sleep(300); await click('Hint: off'); await click('Hint: on'); await sleep(100)
t = await playByHand()
console.log('with hint:', t.split('\n').slice(2, 3).join(''))
if (!/of 1 \(/.test(t) || !/not counted/.test(t)) fail('a game with Hint should not count')
await fromMenu('Daily deal'); t = await playByHand()
console.log('daily:', t.split('\n').slice(1, 3).join(' / '))
if (!/of 2 \(/.test(t) || !/daily deal/.test(t) || !/Copy result/.test(t)) fail('the daily deal should count once and offer Copy result')
await fromMenu('Daily deal'); t = await playByHand()
if (!/of 2 \(/.test(t)) fail('the daily deal counts only once a day')
console.log(errors.length ? 'ERRORS ' + errors.join('\n') : 'no page errors')
console.log(process.exitCode ? 'record: FAILED' : 'record: ok')
await b.close()
