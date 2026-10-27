/** Regression sweep: every page loads without console errors or horizontal overflow. */
export default async function run(page) {
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' && !t.includes('WebSocket')) errs.push(t.slice(0, 160))
  })
  await page.addInitScript(() => sessionStorage.setItem('facultyflow.intro.seen', '1'))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })
  await page.waitForTimeout(700)

  const pages = [
    'Dashboard', 'Timetable Builder', 'Faculty Workload', 'Classroom Booking', 'Leave & Substitution',
    'Academic Calendar', 'Activity Timeline', 'Faculty Directory', 'Course Registry', 'Classrooms & Labs',
  ]
  const problems = {}
  for (const label of pages) {
    const btn = page.getByRole('button', { name: label, exact: true })
    if ((await btn.count()) === 0) {
      problems[label] = 'nav missing'
      continue
    }
    await btn.first().click()
    await page.waitForTimeout(500)
    problems[label] = await page.evaluate(() => {
      const over = []
      document.querySelectorAll('.content *').forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 6 && !['auto', 'scroll'].includes(getComputedStyle(el).overflowX)) {
          over.push(`${el.tagName}.${String(el.className).slice(0, 40)}`)
        }
      })
      return over.slice(0, 3)
    })
  }
  return { errs: errs.slice(0, 6), problems }
}
