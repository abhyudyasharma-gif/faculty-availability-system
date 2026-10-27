export default async function run(page) {
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForTimeout(300)
  const early = await page.evaluate(() => document.querySelector('.intro-caption')?.className)
  await page.waitForTimeout(9000)
  const late = await page.evaluate(() => ({
    cls: document.querySelector('.intro-caption')?.className,
    prog: document.querySelector('.intro-progress span')?.getAttribute('style'),
  }))
  await page.screenshot({ path: 'qa/end-state.png' })
  return { early, late }
}
