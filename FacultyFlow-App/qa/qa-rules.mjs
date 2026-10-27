export default async function run(page) {
  const out = await page.evaluate(() => {
    const hits = []
    for (const sh of document.styleSheets) {
      let rules
      try {
        rules = sh.cssRules
      } catch (e) {
        hits.push('ERR ' + e.message)
        continue
      }
      for (const r of rules) {
        if (r.cssText && r.cssText.indexOf('.main') === 0) hits.push(r.cssText.slice(0, 140))
      }
    }
    return {
      hits,
      narrow: matchMedia('(max-width: 1100px)').matches,
      width: innerWidth,
      mainClass: document.querySelector('.main').className,
      parent: document.querySelector('.main').parentElement.className,
    }
  })
  return out
}
