export default async function run(page) {
  await page.addInitScript(() => sessionStorage.removeItem('facultyflow.data.v1'))
  await page.addInitScript(() => sessionStorage.setItem('facultyflow.intro.seen', '1'))
  await page.goto('http://localhost:5199/', { waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })
  await page.evaluate(() => localStorage.removeItem('facultyflow.data.v1'))
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })
  await page.getByRole('button', { name: 'Timetable Builder', exact: true }).first().click()
  await page.waitForTimeout(800)
  return page.evaluate(() => ({
    notice: document.querySelector('.notice')?.textContent?.slice(0, 100) ?? 'none',
    dupWarning: document.body.innerText.includes('overlap with another class'),
  }))
}
