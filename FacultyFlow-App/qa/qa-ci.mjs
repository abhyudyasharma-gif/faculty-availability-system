export default async function run(page) {
  page.on('console', (m) => {
    const t = m.text()
    if (!t.includes('WebSocket')) console.log('BROWSER', m.type(), t.slice(0, 200))
  })
  page.on('pageerror', (e) => console.log('BROWSER-ERR', e.message))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForTimeout(3000)
  return { done: true }
}
