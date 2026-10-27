import { chromium } from 'playwright'

const name = process.argv[2] ?? 'review'
const port = process.argv[3] ?? '5199'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !t.includes('WebSocket')) errors.push(t.slice(0, 140))
})
const mod = await import(`./qa-${name}.mjs`)
let out = null
try {
  out = await mod.default(page)
} catch (e) {
  out = { FAILED: e.message.split('\n')[0] }
}
await browser.close()
console.log(JSON.stringify(out, null, 1))
if (errors.length) console.log('ERRORS:', [...new Set(errors)].slice(0, 5))
