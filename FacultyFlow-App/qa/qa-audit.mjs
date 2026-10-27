/** Audits every page for clipped text and buttons that touch. */
export default async function run(page) {
  await page.addInitScript(() => {
    localStorage.setItem('facultyflow.intro.completed', '1')
    sessionStorage.setItem('facultyflow.intro.seen', '1')
  })
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })

  const pages = [
    'Dashboard', 'Timetable Builder', 'Faculty Workload', 'Classroom Booking', 'Leave & Substitution',
    'Academic Calendar', 'Activity Timeline', 'Faculty Directory', 'Course Registry', 'Classrooms & Labs',
    'Student Portal', 'Reports & CSV',
  ]
  const report = []
  for (const label of pages) {
    const btn = page.getByRole('button', { name: label, exact: true })
    if (!(await btn.count())) {
      report.push({ page: label, missing: true })
      continue
    }
    await btn.first().click()
    await page.waitForTimeout(450)
    report.push(
      await page.evaluate((name) => {
        const issues = []
        // Clipped text: content wider than its box with no scroll affordance.
        document.querySelectorAll('.content td, .content th, .content li, .content p, .content strong').forEach((el) => {
          if (el.children.length) return
          if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') {
            issues.push(`clip: ${el.className || el.tagName} "${(el.textContent || '').trim().slice(0, 28)}"`)
          }
        })
        // Buttons closer than 4px inside the same action group.
        document.querySelectorAll('.row-actions, .actions-cell').forEach((g) => {
          const bs = [...g.querySelectorAll('button')]
          for (let i = 1; i < bs.length; i += 1) {
            const gap = bs[i].getBoundingClientRect().left - bs[i - 1].getBoundingClientRect().right
            if (gap < 4) issues.push(`touch: ${Math.round(gap)}px`)
          }
        })
        return { page: name, issues: issues.slice(0, 4) }
      }, label),
    )
  }
  return report
}
