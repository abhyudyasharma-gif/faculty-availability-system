/**
 * Verifies the semester switch: no section period is claimed by two lectures
 * in the same semester, and switching odd -> even -> odd keeps the timetables
 * free of overlap warnings.
 */
export default async function run(page) {
  const summary = async () =>
    page.evaluate(() => ({
      notice: document.querySelector('.notice')?.textContent?.slice(0, 120) ?? 'none',
      sectionCopy: document.querySelector('.tt-section-copy .muted')?.textContent?.trim() ?? '',
      cells: document.querySelectorAll('.tt-cell .lecture').length,
    }))

  await page.addInitScript(() => sessionStorage.setItem('facultyflow.intro.seen', '1'))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })
  await page.evaluate(() => localStorage.removeItem('facultyflow.data.v1'))
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })

  const nav = page.getByRole('button', { name: 'Timetable Builder', exact: true }).first()
  if (await nav.count()) await nav.click()
  await page.waitForTimeout(700)

  const odd = await summary()
  await page.screenshot({ path: 'qa/sem-odd.png' })

  const even = page.getByRole('radio', { name: /Even Semester/i }).first()
  if (await even.count()) await even.click()
  await page.waitForTimeout(700)
  const evenState = await summary()
  await page.screenshot({ path: 'qa/sem-even.png' })

  const oddBack = page.getByRole('radio', { name: /Odd Semester/i }).first()
  if (await oddBack.count()) await oddBack.click()
  await page.waitForTimeout(600)
  const oddAgain = await summary()

  // Raw data check: duplicates inside each semester.
  const dup = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('facultyflow.data.v1') || '{"slots":[]}')
    const seen = new Map()
    let total = 0
    for (const s of data.slots) {
      const k = `${s.term ?? 'odd'}|${s.section}|${s.day}|${s.period}`
      seen.set(k, (seen.get(k) || 0) + 1)
      total += 1
    }
    const dups = [...seen.entries()].filter(([, n]) => n > 1)
    return { total, dupKeys: dups.length, sample: dups.slice(0, 5).map(([k, n]) => `${k} x${n}`) }
  })

  return { odd, evenState, oddAgain, dup }
}
