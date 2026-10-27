export default async function run(page) {
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(m.text().slice(0, 160))
  })
  await page.addInitScript(() => {
    sessionStorage.setItem('facultyflow.intro.seen', '1')
  })
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })
  await page.waitForTimeout(900)

  const pages = [
    ['Dashboard', 'dash'],
    ['Timetable Builder', 'timetable'],
    ['Faculty Directory', 'faculty'],
    ['Course Registry', 'courses'],
    ['Leave & Substitution', 'subs'],
    ['Academic Calendar', 'calendar'],
    ['Student Portal', 'student'],
    ['Faculty Workload', 'workload'],
    ['Classroom Booking', 'booking'],
    ['Activity Timeline', 'timeline'],
    ['Settings', 'settings'],
  ]
  const problems = {}
  for (const [label, file] of pages) {
    const btn = page.getByRole('button', { name: label, exact: true })
    if ((await btn.count()) === 0) {
      problems[label] = 'nav missing'
      continue
    }
    await btn.first().click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `qa/p-${file}.png` })
    problems[label] = await page.evaluate(() => {
      const over = []
      document.querySelectorAll('.content *').forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 6 && !['auto', 'scroll'].includes(getComputedStyle(el).overflowX)) {
          over.push(`${el.tagName}.${String(el.className).slice(0, 50)}`)
        }
      })
      return over.slice(0, 4)
    })
  }
  return { errs: errs.slice(0, 8), problems }
}
