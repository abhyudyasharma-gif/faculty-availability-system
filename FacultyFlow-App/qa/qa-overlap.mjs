export default async function run(page) {
  await page.addInitScript(() => sessionStorage.setItem('facultyflow.intro.seen', '1'))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })
  await page.getByRole('button', { name: 'Timetable Builder', exact: true }).first().click()
  await page.waitForTimeout(700)
  return page.evaluate(() => {
    const wallet = localStorage.getItem('facultyflow.data.v1')
    const data = JSON.parse(wallet)
    const slots = data.slots.filter((s) => s.section === 'CSE-2B' && (s.term ?? 'odd') === 'odd')
    const byKey = {}
    const dup = []
    slots.forEach((s) => {
      const k = `${s.day}-${s.period}`
      if (byKey[k]) dup.push([byKey[k], s])
      else byKey[k] = s
    })
    return {
      slotCount: slots.length,
      dups: dup.map(([a, b]) => `${a.day} P${a.period}: ${a.id}/${a.courseId} and ${b.id}/${b.courseId}`),
      totalAll: data.slots.length,
      oddTotal: data.slots.filter((s) => (s.term ?? 'odd') === 'odd').length,
      evenTotal: data.slots.filter((s) => s.term === 'even').length,
      notice: document.querySelector('.notice')?.textContent?.slice(0, 120),
    }
  })
}
