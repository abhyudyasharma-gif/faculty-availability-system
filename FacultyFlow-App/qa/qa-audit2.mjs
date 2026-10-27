import { writeFileSync } from 'node:fs'

export default async function run(page) {
  await page.addInitScript(() => sessionStorage.setItem('facultyflow.intro.seen', '1'))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })
  const pages = [
    'Dashboard',
    'Timetable Builder',
    'Faculty Directory',
    'Course Registry',
    'Leave & Substitution',
    'Academic Calendar',
    'Student Portal',
    'Faculty Workload',
    'Classroom Booking',
    'Activity Timeline',
    'Settings',
  ]
  const missing = new Set()
  for (const label of pages) {
    const btn = page.getByRole('button', { name: label, exact: true })
    if ((await btn.count()) === 0) continue
    await btn.first().click()
    await page.waitForTimeout(450)
    const found = await page.evaluate(() => {
      const used = new Set()
      document.querySelectorAll('.content *').forEach((el) => el.classList.forEach((c) => used.add(c)))
      const defined = new Set()
      const walk = (rules) => {
        for (const r of rules) {
          if (r.selectorText) r.selectorText.replace(/\.([a-zA-Z0-9_-]+)/g, (_, c) => defined.add(c))
          if (r.cssRules) walk(r.cssRules)
        }
      }
      for (const sh of document.styleSheets) {
        try {
          walk(sh.cssRules)
        } catch {
          /* cross-origin */
        }
      }
      return [...used].filter((c) => !defined.has(c)).sort()
    })
    found.forEach((c) => missing.add(c))
  }
  writeFileSync('qa/missing-list.txt', [...missing].join('\n'))
  return { count: missing.size }
}
