export default async function run(page) {
  const logs = []
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 160)}`))
  page.on('pageerror', (e) => logs.push(`ERR: ${e.message}`))
  await page.goto('http://localhost:5199', { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  return { introLogs: logs.filter((l) => /INTRO|ERR/.test(l)).slice(0, 12), total: logs.length }
}
