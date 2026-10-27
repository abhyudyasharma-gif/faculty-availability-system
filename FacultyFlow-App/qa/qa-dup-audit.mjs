/** Audits the persisted timetable for duplicate (day, period, section) entries. */
export default async function run(page) {
  await page.addInitScript(() => sessionStorage.setItem('facultyflow.intro.seen', '1'))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })
  await page.waitForTimeout(800)
  return page.evaluate(() => {
    const parse = (raw) => {
      const data = JSON.parse(raw)
      const out = {}
      for (const s of data.slots) {
        const key = `${s.term ?? 'odd'}|${s.section}|${s.day}|P${s.period}`
          ; (out[key] ??= []).push(s.id)
      }
      const dup = Object.entries(out).filter(([, ids]) => ids.length > 1)
      return {
        total: data.slots.length,
        dupKeys: dup.length,
        sample: dup.slice(0, 12).map(([k, ids]) => `${k} -> ${ids.join(', ')}`),
      }
    }
    // 1) what the seed produces in a fresh session
    const seed = parse(new Function('return window.__facultyflowSeed ?? "null"')() ?? 'null')
    return seed
  })
}
