import { writeFileSync } from 'node:fs'

export default async function run(page) {
  await page.goto('http://localhost:5199', { waitUntil: 'load' })
  await page.waitForSelector('.intro canvas', { timeout: 20000 })
  await page.waitForTimeout(200)
  const nums = []
  for (const i of [0, 1, 2]) {
    const url = await page.evaluate(() => {
      const src = document.querySelector('.intro canvas')
      const out = document.createElement('canvas')
      out.width = src.width
      out.height = src.height
      out.getContext('2d').drawImage(src, 0, 0)
      return out.toDataURL()
    })
    writeFileSync(`qa/early-${i}.png`, Buffer.from(url.split(',')[1], 'base64'))
    nums.push(url.length)
    await page.waitForTimeout(500)
  }
  return { nums, title: await page.title() }
}
