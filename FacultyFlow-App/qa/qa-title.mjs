export default async function run(page) {
  await page.goto('http://localhost:5199', { waitUntil: 'load' })
  await page.waitForTimeout(3500)
  return { title: await page.title() }
}
