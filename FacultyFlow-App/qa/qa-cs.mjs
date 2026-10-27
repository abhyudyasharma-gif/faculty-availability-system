export default async function run(page) {
  return page.evaluate(() => {
    const m = document.querySelector('.main')
    const out = []
    const check = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return out.push(`MISSING ${sel}`)
      const cs = getComputedStyle(el)
      out.push(`${sel} -> display:${cs.display} pos:${cs.position} ml:${cs.marginLeft} flexDir:${cs.flexDirection}`)
    }
      ;['.shell', '.sidebar', '.main', '.topbar', '.content', '.role-dock', '.app-foot', '.brand', '.logo-mark'].forEach(check)
    out.push('sheets: ' + [...document.styleSheets].map((s) => (s.href ? s.href.slice(0, 60) : 'inline')).join(' | '))
    void m
    return out
  })
}
