export default async function run(page) {
  const bad = []
  page.on('response', async (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`)
  })
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  return { bad }
}
