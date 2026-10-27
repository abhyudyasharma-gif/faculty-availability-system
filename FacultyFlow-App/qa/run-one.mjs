// Runs one semantic QA module (default: semesters) against the dev server.
// Usage: node qa/run-one.mjs [name] [port]
import { chromium } from 'playwright'

const name = process.argv[2] ?? 'semesters'
const port = process.argv[3] ?? '4180'

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  const t = m.text()
  if (m.type() === 'error' && !t.includes('WebSocket')) errors.push('console: ' + t)
})

const mod = await import(`./qa-${name}.mjs`)
let out = null
let failure = null
try {
  out = await mod.default(page, { BASE: `http://localhost:${port}/` })
} catch (e) {
  failure = e.message.split('\n').slice(0, 4).join(' | ')
}

await browser.close()

console.log(`===== ${name} =====`)
if (failure) console.log('FAILED:', failure)
else console.log(JSON.stringify(out, null, 1))
if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 6))

