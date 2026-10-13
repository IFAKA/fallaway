// node scripts/icons.mjs — render public/favicon.svg into the PNG icons the manifest and iOS need (192, 512, apple-touch 180).
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const svg = fs.readFileSync('public/favicon.svg', 'utf8'), out = 'public'
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const p = await b.newPage()
for (const [n, f] of [[192, 'icon-192.png'], [512, 'icon-512.png'], [180, 'apple-touch-icon.png']]) {
  await p.setViewport({ width: n, height: n })
  await p.setContent(`<html><body style="margin:0;background:#14442f">${svg.replace('<svg ', `<svg width="${n}" height="${n}" `)}</body></html>`)
  await p.screenshot({ path: `${out}/${f}` })
}
await b.close()
