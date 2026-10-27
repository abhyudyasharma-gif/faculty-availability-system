export default async function run(page) {
  return page.evaluate(() => {
    const out = []
    for (const sh of document.styleSheets) {
      if (!sh.ownerNode || sh.href) continue
      for (const r of sh.cssRules) out.push(r.cssText.slice(0, 110))
    }
    return out.filter((t) => /brand|logo|topbar|role-dock|app-foot|institution/.test(t)).slice(0, 60)
  })
}
