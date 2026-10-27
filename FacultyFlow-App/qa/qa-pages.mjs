import { writeFileSync } from 'node:fs'

export default async function run(page) {
  const logs = []
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}\n${e.stack}`))
  await page.goto('http://localhost:5199', { waitUntil: 'load' })
  await page.waitForSelector('.shell', { timeout: 20000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'qa/dash-desktop.png' })

  const shots = {}
  const go = async (name) => {
    const btn = page.getByRole('button', { name, exact: true })
    if ((await btn.count()) === 0) return (shots[`${name}`] = 'missing')
    await btn.first().click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `qa/page-${name.replace(/\W+/g, '-').toLowerCase()}.png` })
    const wrap = await page.evaluate(() => {
      const main = document.querySelector('.content')
      const over = []
      main.querySelectorAll('*').forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 4 && getComputedStyle(el).overflowX === 'visible') {
          over.push(`${el.tagName}.${el.className}`.slice(0, 80))
        }
      })
      return { over: over.slice(0, 6), h: document.body.scrollHeight }
    })
    shots[name] = wrap
  }

  for (const name of [
    'Timetable Builder',
    'Faculty Directory',
    'Course Registry',
    'Leave & Substitution',
    'Academic Calendar',
    'Student Portal',
    'Faculty Workload',
    'Activity Timeline',
    'Classroom Booking',
    'Settings',
    'Dashboard',
  ]) {
    await go(name)
  }
  writeFileSync('qa/pages.json', JSON.stringify({ logs: logs.slice(0, 20), shots }, null, 1))
  return { logs: logs.slice(0, 20), shots }
}
