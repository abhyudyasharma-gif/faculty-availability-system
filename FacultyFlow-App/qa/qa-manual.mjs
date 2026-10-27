import { writeFileSync } from 'node:fs'

export default async function run(page) {
  const logs = []
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text().slice(0, 200)}`))
  page.on('pageerror', (e) => logs.push('ERR ' + e.message))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.intro canvas', { timeout: 20000 }).catch(() => { })
  await page.waitForTimeout(2500)
  const data = await page.evaluate(async () => {
    const { buildIntroScene } = await import('/src/experience/buildIntroScene.ts')
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;width:640px;height:360px'
    document.body.appendChild(host)
    const events = []
    const stop = buildIntroScene(host, {
      onProgress: (p) => events.push(p),
      onReveal: () => events.push('reveal'),
      onComplete: () => events.push('complete'),
    })
    await new Promise((r) => setTimeout(r, 3000))
    const c = host.querySelector('canvas')
    const gl = c.getContext('webgl2')
    const px = new Uint8Array(4)
    gl.readPixels(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const out = document.createElement('canvas')
    out.width = c.width
    out.height = c.height
    out.getContext('2d').drawImage(c, 0, 0)
    const url = out.toDataURL()
    stop()
    host.remove()
    return { px: Array.from(px), events: events.slice(0, 5), frames: events.length, url }
  })
  writeFileSync('qa/manual-scene.png', Buffer.from(data.url.split(',')[1], 'base64'))
  return { logs: logs.slice(0, 10), px: data.px, events: data.events, frames: data.frames }
}
