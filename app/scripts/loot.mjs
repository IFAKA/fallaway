// node scripts/loot.mjs — practice mode: zoom in, check "Done" is locked while something is affordable, follow the advice until the site ends.
import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
const p = await b.newPage(); await p.setViewport({ width: 1300, height: 950 })
await p.goto('http://localhost:5199/', { waitUntil: 'networkidle0' })
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('zoom-mode', 'practice') })
await p.goto('http://localhost:5199/?seed=7', { waitUntil: 'networkidle0' })
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const btn = (text) => p.evaluate((text) => { const e = [...document.querySelectorAll('button')].find(e => e.textContent.includes(text)); return e ? { dis: e.disabled } : null }, text)
const click = (text) => p.evaluate((text) => [...document.querySelectorAll('button')].find(e => e.textContent.includes(text) && !e.disabled)?.click(), text)
// follow advice ("Do it" style button) until we are in a site
for (let i = 0; i < 30; i++) {
  const done = await btn("Done: can't pay")
  if (done) break
  await click('Hint'); await sleep(50); await click('Do it'); await sleep(250)
}
console.log('in site, Done button:', await btn("Done: can't pay"))
console.log('guide:', await p.evaluate(() => document.querySelector('.guide')?.innerText.slice(0, 300)))
await p.screenshot({ path: '/tmp/shots/loot1.png' })
for (let i = 0; i < 8 && await btn("Done: can't pay"); i++) { await click('Hint'); await sleep(50); await click('Do it'); await sleep(300) }
console.log('after:', await btn("Done: can't pay"), (await p.evaluate(() => document.querySelector('.log')?.innerText ?? '')).split('\n').slice(-6).join(' | '))
await b.close()
