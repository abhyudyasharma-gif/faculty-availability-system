export default async function run(page) {
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  return page.evaluate(async () => {
    // Walk the intro canvas' renderer scene by intercepting requestAnimationFrame is not possible;
    // instead re-build via the module and inspect the returned scene graph through a probe render.
    const mod = await import('/src/experience/buildIntroScene.ts')
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;top:0;left:0;width:700px;height:400px;z-index:99999'
    document.body.appendChild(host)
    // capture meshes by wrapping Scene.prototype.add
    const THREE = await import('/node_modules/.vite/deps/three.js')
    const added = []
    const origAdd = THREE.Object3D.prototype.add
    THREE.Object3D.prototype.add = function (...objs) {
      objs.forEach((o) => added.push(`${o.type}:${o.name || ''}@${o.position.x.toFixed(1)},${o.position.y.toFixed(1)},${o.position.z.toFixed(1)}`))
      return origAdd.apply(this, objs)
    }
    const stop = mod.buildIntroScene(host, { onProgress: () => { }, onReveal: () => { }, onComplete: () => { } })
    await new Promise((r) => setTimeout(r, 200))
    stop()
    THREE.Object3D.prototype.add = origAdd
    host.remove()
    return { added: added.slice(0, 40), total: added.length }
  })
}
