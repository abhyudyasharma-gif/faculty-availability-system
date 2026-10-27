export default async function run(page) {
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.intro', { timeout: 20000 })
  await page.waitForTimeout(3000)
  const mid = await page.evaluate(() => document.querySelector('.intro-caption')?.className)
  await page.screenshot({ path: 'qa/i-mid.png' })
  await page.waitForSelector('.intro-caption.is-ready', { timeout: 25000 }).catch(() => { })
  await page.waitForTimeout(400)
  const end = await page.evaluate(() => document.querySelector('.intro-caption')?.className)
  await page.screenshot({ path: 'qa/i-end.png' })
  const entered = page.getByRole('button', { name: /Enter FacultyFlow/i })
  if (await entered.count()) await entered.first().click()
  await page.waitForSelector('.shell', { timeout: 15000 })
  await page.waitForTimeout(1400)
  await page.screenshot({ path: 'qa/d-dash.png' })
  return { mid, end }
}
