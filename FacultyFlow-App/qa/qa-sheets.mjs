export default async function run(page) {
  return page.evaluate(() => {
    const out = []
    for (const sh of document.styleSheets) {
      out.push(`--- ${sh.href ? sh.href.slice(0, 70) : 'inline'}`)
      let rules
      try {
        rules = sh.cssRules
      } catch (e) {
        out.push('ERR ' + e.message)
        continue
      }
      out.push(`rules=${rules.length}`)
      for (const r of rules) out.push(r.cssText.slice(0, 100))
    }
    return out.slice(0, 90)
  })
}
