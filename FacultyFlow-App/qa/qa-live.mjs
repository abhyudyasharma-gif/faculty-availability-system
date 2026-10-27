export default async function run(page) {
  const bad = []
  page.on('response', (r) => {
    if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(-60)}`)
  })
  page.on('pageerror', (e) => bad.push('ERR ' + e.message))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.intro canvas', { timeout: 20000 }).catch(() => { })
  await page.waitForTimeout(3000)
  const info = await page.evaluate(() => {
    const c = document.querySelector('.intro canvas')
    if (!c) return { canvas: false }
    const gl = c.getContext('webgl2')
    const px = new Uint8Array(4)
    gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const cs = getComputedStyle(c)
    return {
      canvas: true,
      size: [c.width, c.height],
      px: Array.from(px),
      opacity: cs.opacity,
      zIndex: cs.zIndex,
      parentZ: getComputedStyle(c.parentElement).zIndex,
      introZ: getComputedStyle(document.querySelector('.intro')).zIndex,
    }
  })
  return { bad: bad.slice(0, 8), info }
}
