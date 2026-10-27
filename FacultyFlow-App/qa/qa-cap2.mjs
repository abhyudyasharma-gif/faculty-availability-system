export default async function run(page) {
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.intro-caption', { timeout: 20000 })
  const samples = []
  for (let i = 0; i < 6; i += 1) {
    samples.push(
      await page.evaluate(() => ({
        cls: document.querySelector('.intro-caption').className,
        inner: document.querySelector('.intro-caption').querySelector('.intro-enter')?.textContent,
        prog: document.querySelector('.intro-progress span')?.getAttribute('style'),
      })),
    )
    await page.waitForTimeout(1500)
  }
  return { samples }
}
