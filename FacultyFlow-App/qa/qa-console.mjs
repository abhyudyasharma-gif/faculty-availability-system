export default async function run(page) {
  const bad = []
  page.on('console', (m) => {
    const t = m.text()
    if (!t.includes('WebSocket') && !t.includes('[vite]')) bad.push(`${m.type()}: ${t.slice(0, 160)}`)
  })
  page.on('pageerror', (e) => bad.push('ERR ' + e.message))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  // Does the module function exist?
  const mod = await page.evaluate(async () => {
    try {
      const m = await import('/src/experience/buildIntroScene.ts')
      return { ok: typeof m.buildIntroScene }
    } catch (e) {
      return { err: String(e).slice(0, 300) }
    }
  })
  return { bad: bad.slice(0, 10), mod }
}
