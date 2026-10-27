import { writeFileSync } from 'node:fs'

export default async function run(page) {
  const logs = []
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 200)}`))
  page.on('pageerror', (e) => logs.push('ERR ' + e.message))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.intro canvas', { timeout: 20000 })
  const shots = []
  for (let i = 0; i < 4; i += 1) {
    await page.waitForTimeout(1600)
    const url = await page.evaluate(() => {
      const src = document.querySelector('.intro canvas')
      const out = document.createElement('canvas')
      out.width = src.width
      out.height = src.height
      out.getContext('2d').drawImage(src, 0, 0)
      return out.toDataURL()
    })
    const file = `qa/shot-${i}.png`
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
    shots.push({ file, len: url.length })
  }
  return { logs: logs.slice(0, 8), shots }
}
