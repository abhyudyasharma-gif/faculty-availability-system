export default async function run(page) {
  const logs = []
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 200)}`))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const t0 = Date.now()
  await page.waitForSelector('.intro-caption.is-ready', { timeout: 25000 }).catch(() => { })
  return { ms: Date.now() - t0, logs: logs.slice(0, 8) }
}
