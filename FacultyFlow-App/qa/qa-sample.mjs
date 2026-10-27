export default async function run(page) {
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  const samples = []
  for (let i = 0; i < 8; i += 1) {
    await page.waitForTimeout(500)
    samples.push(
      await page.evaluate(() => {
        const c = document.querySelector('.intro-caption')
        const p = document.querySelector('.intro-progress span')
        return { cls: c?.className ?? 'none', prog: p?.getAttribute('style') ?? '', t: Date.now() % 100000 }
      }),
    )
  }
  return { samples }
}
