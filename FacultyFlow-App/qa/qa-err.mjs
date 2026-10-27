export default async function run(page) {
  await page.addInitScript(() => {
    // Capture the intro callbacks by wrapping the dynamic import target's usage.
    window.__introErrors = []
    window.addEventListener('error', (e) => window.__introErrors.push(String(e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__introErrors.push('rejection: ' + String(e.reason?.stack || e.reason)))
  })
  await page.goto('http://localhost:5199', { waitUntil: 'load' })
  await page.waitForSelector('.intro canvas', { timeout: 20000 })
  await page.waitForTimeout(4000)
  const info = await page.evaluate(() => {
    const c = document.querySelector('.intro canvas')
    const gl = c.getContext('webgl2')
    const draw = gl.getParameter(gl.DRAW_BUFFER0)
    const px = new Uint8Array(4)
    gl.readPixels(10, 10, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    return {
      errors: window.__introErrors,
      drawBuffer: draw,
      px: Array.from(px),
      transparent: gl.getContextAttributes().alpha,
    }
  })
  return info
}
