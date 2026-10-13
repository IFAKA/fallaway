// node scripts/og.mjs — render public/og.png, the 1200×630 link preview (Open Graph / Twitter card) referenced by index.html.
import puppeteer from 'puppeteer-core'
const map = [['?', '?', '?'], ['?', '7♦', '?'], ['?', 'K♣', '?']]
const card = (t) => t === '?'
  ? '<div class="c back"></div>'
  : `<div class="c" style="color:${/[♥♦]/.test(t) ? '#b3261e' : '#14221b'}">${t}</div>`
const html = `<html><head><style>
  body { margin: 0; width: 1200px; height: 630px; background: radial-gradient(circle at 70% 40%, #1d5a3f, #0d3b2a 70%); color: #f4efe1;
    font-family: Georgia, serif; display: flex; align-items: center; gap: 72px; padding: 0 90px; box-sizing: border-box; }
  h1 { font-size: 110px; margin: 0 0 12px; letter-spacing: -2px; }
  p { font-size: 34px; margin: 0 0 10px; color: #d9e6dc; line-height: 1.3; }
  .gold { color: #ffd36b; }
  .grid { display: grid; grid-template-columns: repeat(3, 110px); gap: 16px; flex: none; }
  .c { width: 110px; height: 154px; border-radius: 10px; background: #fffdf6; border: 2px solid #0b2a1d; display: flex;
    align-items: center; justify-content: center; font-size: 44px; box-shadow: 0 6px 14px rgba(0,0,0,.35); }
  .back { background: repeating-linear-gradient(45deg, #2b6b4f 0 8px, #24603f 8px 16px); border-color: #4a9; }
</style></head><body>
  <div><h1>Fallaway</h1><p>A solo game for one deck of cards.</p><p class="gold">Walk the map. Dig. Build your key.</p></div>
  <div class="grid">${map.flat().map(card).join('')}</div>
</body></html>`
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const p = await b.newPage()
await p.setViewport({ width: 1200, height: 630 })
await p.setContent(html)
await p.screenshot({ path: 'public/og.png' })
await b.close()
