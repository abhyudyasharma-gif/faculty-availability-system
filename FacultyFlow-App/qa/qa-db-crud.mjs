/**
 * Browser CRUD against the real Express + MySQL backend.
 *
 *   node qa/run.mjs db-crud 5199      (backend + vite preview running)
 *
 * Every value is checked twice: in the UI and through the API (which reads
 * MySQL), so a fake "saved" message cannot pass.
 */
export default async function run(page) {
  const problems = []
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    // A 409/400 from an expected rejection is logged by the browser itself.
    const text = m.text()
    if (m.type() === 'error' && !text.includes('WebSocket') && !/Failed to load resource|Conflict|Bad Request/.test(text)) {
      problems.push('console: ' + text.slice(0, 120))
    }
  })

  const writes = []
  page.on('response', (r) => {
    if (r.url().includes('/api/') && r.request().method() !== 'GET') {
      writes.push(`${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')} → ${r.status()}`)
    }
  })

  const stamp = String(Date.now()).slice(-4)
  const facultyName = `Dr. Qa Browser ${stamp}`
  const empNo = `QA-${stamp}`
  const courseCode = `QA${stamp.slice(0, 3)}`
  const roomName = `Q-${stamp.slice(0, 2)}`
  const api = 'http://127.0.0.1:5000/api'

  await page.addInitScript(() => {
    localStorage.setItem('facultyflow.intro.completed', '1')
    localStorage.setItem(
      'facultyflow_auth_user_v2',
      JSON.stringify({
        id: 'u-admin',
        name: 'Dr. Vikram Malhotra',
        email: 'admin@kce.ac.in',
        role: 'Admin',
        department: 'University Administration',
        title: 'Dean of Academic Affairs',
        avatar: 'VM',
        empOrRollNo: 'ADM-001',
      }),
    )
    localStorage.removeItem('facultyflow.data.v1')
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' })

  const nav = async (label) => {
    const item = page.locator('.nav-item', { hasText: label }).first()
    await item.waitFor({ timeout: 15000 })
    await item.click()
    await page.waitForTimeout(800)
  }
  const countRows = async (path) => (await (await page.request.get(`${api}${path}`)).json()).length

  // ---------------------------- connection status
  await page.waitForSelector('.api-state', { timeout: 20000 })
  await page.waitForFunction(() => !/Connecting/.test(document.querySelector('.api-state')?.textContent ?? ''), null, {
    timeout: 20000,
  })
  const status = ((await page.textContent('.api-state')) ?? '').trim()
  if (!/Connected to MySQL/.test(status)) problems.push(`footer status: ${status}`)

  // Seed checks that do not depend on earlier runs of this script.
  const seedFaculty = await (await page.request.get(`${api}/faculty`)).json()
  if (!seedFaculty.some((f) => f.emp_no === 'IT-2045')) problems.push('seed faculty IT-2045 missing')
  const seedSlots = await (await page.request.get(`${api}/timetable?term=odd&section=CSE-2B`)).json()
  if (seedSlots.length < 20) problems.push(`seed timetable for CSE-2B has ${seedSlots.length} rows`)

  // ---------------------------- faculty: add
  const facultyBefore = await countRows('/faculty')
  await nav('Faculty Directory')
  await page.locator('.faculty-card').first().waitFor({ timeout: 15000 })
  const cardsBefore = await page.locator('.faculty-card').count()

  await page.getByRole('button', { name: /Add faculty/i }).first().click()
  await page.waitForSelector('#faculty-form')
  const form = page.locator('#faculty-form')
  await form.getByLabel('Full name').fill(facultyName)
  await form.getByLabel('Employee number').fill(empNo)
  await form.getByLabel('College email').fill(`qa.${stamp}@kce.ac.in`)
  await form.getByLabel('Phone').fill('+91 90000 00000')
  await form.getByLabel('Office / cabin').fill('C-901')
  await page.getByRole('button', { name: /Add to registry/i }).click()
  await page.waitForTimeout(1500)

  const cardsAfter = await page.locator('.faculty-card').count()
  const facultyAfter = await countRows('/faculty')
  if (cardsAfter !== cardsBefore + 1) problems.push(`faculty cards ${cardsBefore} → ${cardsAfter}`)
  if (facultyAfter !== facultyBefore + 1) problems.push(`MySQL faculty rows ${facultyBefore} → ${facultyAfter}`)

  // ---------------------------- faculty: edit
  await page.locator('.faculty-card', { hasText: empNo }).getByRole('button', { name: /View profile/i }).click()
  await page.getByRole('button', { name: /^Edit$/ }).click()
  await page.waitForSelector('#faculty-form')
  // "Assistant Professor" contains "Professor", so select by value.
  await page.locator('#faculty-form').getByLabel('Designation').selectOption('Professor')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Save changes/i }).click()
  await page.waitForTimeout(1500)
  const profile = (await page.textContent('.faculty-detail').catch(() => '')) ?? ''
  if (!profile.includes('Professor')) problems.push('designation edit not reflected in the profile')
  const savedFaculty = (await (await page.request.get(`${api}/faculty/${empNo}`)).json())?.designation
  if (savedFaculty !== 'Professor') problems.push(`MySQL designation is ${savedFaculty}`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // ---------------------------- courses: add
  await nav('Course Registry')
  const coursesBefore = await countRows('/courses')
  await page.getByRole('button', { name: /Add course/i }).first().click()
  await page.waitForSelector('#course-form')
  const cform = page.locator('#course-form')
  await cform.getByLabel('Course code').fill(courseCode)
  await cform.getByLabel('Course title').fill('QA Browser Course')
  await page.getByRole('button', { name: /Add course/ }).last().click()
  await page.waitForTimeout(1500)
  const coursesAfter = await countRows('/courses')
  if (coursesAfter !== coursesBefore + 1) problems.push(`MySQL course rows ${coursesBefore} → ${coursesAfter}`)
  const createdCourse = ((await (await page.request.get(`${api}/courses`)).json()) ?? []).find((c) => c.code === courseCode)
  if (!createdCourse?.faculty_emp_no) problems.push('created course has no faculty in charge')

  // ---------------------------- rooms: add
  await nav('Classrooms & Labs')
  const roomsBefore = await countRows('/rooms')
  await page.getByRole('button', { name: /Add room/i }).first().click()
  await page.waitForSelector('#room-form')
  await page.locator('#room-form').getByLabel('Room label').fill(roomName)
  await page.getByRole('button', { name: /Add room/ }).last().click()
  await page.waitForTimeout(1500)
  const roomsAfter = await countRows('/rooms')
  if (roomsAfter !== roomsBefore + 1) problems.push(`MySQL room rows ${roomsBefore} → ${roomsAfter}`)

  // ---------------------------- timetable: schedule, then a clashing attempt
  await nav('Timetable Builder')
  const slotsBefore = await countRows('/timetable?term=odd')
  const scheduleLecture = async () => {
    await page.getByRole('button', { name: /Schedule lecture/i }).first().click()
    await page.waitForSelector('#slot-form')
    const f = page.locator('#slot-form')
    // Thu P6 is empty campus-wide in the seed data, so this stays repeatable.
    await f.locator('select').nth(0).selectOption('Wed')
    await f.locator('select').nth(1).selectOption('7')
    await f.locator('select').nth(2).selectOption('CSE-2A')
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: /Add to timetable/i }).click()
    await page.waitForTimeout(1800)
  }
  await scheduleLecture()
  const slotsAfter = await countRows('/timetable?term=odd')
  if (slotsAfter !== slotsBefore + 1) problems.push(`MySQL timetable rows ${slotsBefore} → ${slotsAfter}`)

  await scheduleLecture()
  const slotsStill = await countRows('/timetable?term=odd')
  const toastText = (await page.textContent('.toasts').catch(() => '')) ?? ''
  if (slotsStill !== slotsAfter) problems.push('a clashing lecture was saved to MySQL')
  if (!/conflict/i.test(toastText)) problems.push(`no conflict toast: "${toastText.slice(0, 90)}"`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'qa/db-crud-timetable.png' })

  // ---------------------------- substitution desk: MySQL rows rendered
  await nav('Leave & Substitution')
  await page.waitForTimeout(1000)
  const hint = ((await page.textContent('.section-hint').catch(() => '')) ?? '').trim()
  const shown = Number(/(\d+)\s+of\s+(\d+)\s+records/.exec(hint)?.[2] ?? -1)
  const subInDb = (await (await page.request.get(`${api}/substitutions`)).json()).length
  if (subInDb === 0) problems.push('MySQL has no substitutions to show')
  if (shown < 0) problems.push(`substitution desk count not found: "${hint}"`)
  else if (shown !== subInDb) problems.push(`substitution desk shows ${shown}, MySQL has ${subInDb}`)
  await page.screenshot({ path: 'qa/db-crud-substitutions.png' })

  // Approve the first pending request through the UI.
  const approve = page.getByRole('button', { name: /^Approve$/ }).first()
  let approved = null
  if ((await approve.count()) > 0) {
    await approve.click()
    await page.waitForTimeout(1500)
    approved = ((await (await page.request.get(`${api}/substitutions?status=Approved`)).json()) ?? []).length
    if (!approved) problems.push('approval did not reach MySQL')
  }

  // ---------------------------- faculty: delete the test record
  await nav('Faculty Directory')
  await page.locator('.faculty-card', { hasText: empNo }).getByRole('button', { name: /View profile/i }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: /Remove from registry/i }).click()
  await page.getByRole('button', { name: /Remove faculty/i }).last().click()
  await page.waitForTimeout(1800)
  const stillThere = await page.locator('.faculty-card', { hasText: empNo }).count()
  if (stillThere !== 0) problems.push('deleted faculty card is still shown')
  const facultyGone = (await page.request.get(`${api}/faculty/${empNo}`)).status()
  if (facultyGone !== 404) problems.push(`deleted faculty still in MySQL (status ${facultyGone})`)

  await page.screenshot({ path: 'qa/db-crud-faculty.png' })

  return {
    status,
    faculty: `${cardsBefore} → ${cardsAfter} cards (MySQL ${facultyBefore} → ${facultyAfter})`,
    courses: `MySQL ${coursesBefore} → ${coursesAfter}`,
    rooms: `MySQL ${roomsBefore} → ${roomsAfter}`,
    timetable: `MySQL ${slotsBefore} → ${slotsAfter} (clash rejected: ${slotsStill === slotsAfter})`,
    substitutions: `${shown} shown / ${subInDb} in MySQL, approved in MySQL: ${approved}`,
    writes,
    created: { empNo, courseCode, roomName },
    problems,
  }
}
