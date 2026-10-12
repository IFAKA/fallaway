// node scripts/locks-shot.mjs — play a game with the Hint button on the running dev server; screenshots to /tmp/zoomcheck
import puppeteer from 'puppeteer-core'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] })
const p = await b.newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
await p.setViewport({ width: 1300, height: 1000 })
await p.evaluateOnNewDocument(() => { localStorage.setItem('zoom-mode', 'practice'); localStorage.setItem('zoom-seen-intro', '1') })
await p.goto(`${process.env.URL ?? 'http://localhost:5199'}/?seed=7`, { waitUntil: 'networkidle0' })
await new Promise(r => setTimeout(r, 1200))
await p.screenshot({ path: '/tmp/zoomcheck/locks-0-start.png' })
const click = (txt) => p.evaluate(t => { const e = [...document.querySelectorAll('button')].find(e => e.textContent.startsWith(t) && !e.disabled); if (e) e.click(); return !!e }, txt)
await click('Hint')
let n = 0, claimed = false
while (n++ < 80) {
  if (!(await click('Do it'))) break
  await new Promise(r => setTimeout(r, 700))
  const log = await p.evaluate(() => document.querySelector('.log').textContent)
  if (!claimed && log.includes('Claim ')) { claimed = true; await new Promise(r => setTimeout(r, 600)); await p.screenshot({ path: '/tmp/zoomcheck/locks-1-claim.png' }); }
  if (await p.evaluate(() => !!document.querySelector('.endbox'))) break
}
await p.screenshot({ path: '/tmp/zoomcheck/locks-2-end.png' })
console.log('steps', n, 'claimed', claimed, 'errors', JSON.stringify(errs))
await b.close()
