import { writeFileSync } from 'node:fs'

/**
 * Renders the intro scene's WebGL canvas through a 2D canvas so the frame can
 * be inspected even when the headless compositor drops WebGL layers.
 */
export default async function run(page) {
  await page.goto('http://localhost:5199', { waitUntil: 'load' })
  await page.waitForSelector('.intro canvas', { timeout: 20000 })
  const grab = async (name, wait) => {
    await page.waitForTimeout(wait)
    const url = await page.evaluate(() => {
      const src = document.querySelector('.intro canvas')
      const out = document.createElement('canvas')
      out.width = src.width
      out.height = src.height
      const ctx = out.getContext('2d')
      ctx.drawImage(src, 0, 0)
      return out.toDataURL('image/png')
    })
    writeFileSync(`qa/${name}.png`, Buffer.from(url.split(',')[1], 'base64'))
    return url.length
  }
  const a = await grab('intro-a', 900)
  const b = await grab('intro-b', 2600)
  const c = await grab('intro-c', 3200)
  return { a, b, c }
}
