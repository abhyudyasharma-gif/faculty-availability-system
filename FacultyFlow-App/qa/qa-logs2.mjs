export default async function run(page) {
  const logs = []
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 200)}`))
  page.on('pageerror', (e) => logs.push(`ERR: ${e.message}`))
  await page.addInitScript(() => {
    sessionStorage.clear()
  })
  await page.goto('http://localhost:5199', { waitUntil: 'load' })
  await page.waitForTimeout(3500)
  return { logs: logs.slice(0, 15), intro: Boolean(await page.$('.intro')) }
}
