// node scripts/play.mjs [seed] [games] — play whole practice games in headless Chrome on the dev server (localhost:5199):
// first a few moves by hand (arrow + eat card, dig, flip, fight/flee by clicking cards), then follow the hint's "Do it" to the end.
// Fails on any page error; saves screenshots to /tmp/shots/play-*.png.
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
fs.mkdirSync('/tmp/shots', { recursive: true })
const seed0 = +(process.argv[2] ?? 7), games = +(process.argv[3] ?? 3)
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
await p.setViewport({ width: 1300, height: 1000 })
const errors = []
p.on('pageerror', e => errors.push(String(e)))
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await p.evaluateOnNewDocument(() => { localStorage.setItem('zoom-mode', 'practice'); localStorage.setItem('zoom-seen-intro-v4', '1') })
const sleep = (t) => new Promise(r => setTimeout(r, t))
const click = (text) => p.evaluate((text) => { const e = [...document.querySelectorAll('button')].find(e => e.textContent.includes(text) && !e.disabled); if (e) e.click(); return !!e }, text)
const title = () => p.evaluate(() => document.querySelector('.gtitle')?.textContent ?? '')
const handCards = () => p.evaluate(() => { const st = document.querySelector('.stage').getBoundingClientRect(); return [...document.querySelectorAll('.stage .acard')].filter(e => e.getBoundingClientRect().y - st.y > 600).length })
let wins = 0
for (let g = 0; g < games; g++) {
  const seed = seed0 + g
  await p.goto(`${(process.env.URL ?? 'http://localhost:5199/').replace(/\/$/, '')}/?seed=${seed}`, { waitUntil: 'networkidle0' })
  await sleep(900)
  if (g === 0) {
    await p.screenshot({ path: '/tmp/shots/play-0-start.png' })
    // by hand: arrow, then eat the first hand card
    const before = await handCards()
    await p.evaluate(() => [...document.querySelectorAll('.stage .arrow')].find(e => e.textContent === '▶').click())
    await sleep(150)
    const t1 = await title()
    if (!/eat a card/.test(t1)) throw new Error('arrow did not ask for a card to eat: ' + t1)
    await p.screenshot({ path: '/tmp/shots/play-1-eat.png' })
    await p.evaluate(() => { const st = document.querySelector('.stage').getBoundingClientRect(); [...document.querySelectorAll('.stage .acard.clickable')].find(e => e.getBoundingClientRect().y - st.y > 600).click() })
    await sleep(900)
    const after = await handCards()
    if (after !== before - 1) throw new Error(`moving should eat one card: ${before} -> ${after}`)
    await p.screenshot({ path: '/tmp/shots/play-2-moved.png' })
    // dig and flip by hand until something happens
    if (await click('Zoom IN')) {
      for (let k = 0; k < 8; k++) {
        await sleep(250)
        const t = await title()
        if (/HOSTILE/.test(t)) {
          await p.screenshot({ path: '/tmp/shots/play-3-hostile.png' })
          const fought = await p.evaluate(() => { const c = document.querySelector('.stage .acard.glow.clickable'); if (c) c.click(); return !!c })
          if (!fought) await click('Flee')
          await sleep(400)
          continue
        }
        if (!/Digging/.test(t)) break
        if (!(await click('Flip next'))) { await click('Stop'); break }
      }
      await sleep(600)
      await p.screenshot({ path: '/tmp/shots/play-4-dug.png' })
    }
  }
  // the rest: follow the hint
  await click('Hint off')
  let n = 0
  for (; n < 400; n++) {
    const done = await p.evaluate(() => !!document.querySelector('.endbox'))
    if (done) break
    if (!(await click('Do it'))) throw new Error(`seed ${seed}: no suggestion at step ${n}: ${await title()}`)
    await sleep(40)
  }
  await sleep(800)
  const result = await p.evaluate(() => document.querySelector('.endbox .result')?.textContent ?? 'none')
  if (/WIN/.test(result)) wins++
  console.log(`seed ${seed}: ${result} after ${n} hinted actions`)
  await click('Hint on')
  if (g === 0) await p.screenshot({ path: '/tmp/shots/play-5-end.png' })
}
await b.close()
if (errors.length) { console.log('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1) }
console.log(`ok: ${games} games, ${wins} won, no page errors`)
