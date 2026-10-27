import { chromium } from 'playwright'
import { preview } from 'vite'

async function verifyAll() {
  const server = await preview({ root: 'facultyflow', preview: { port: 5199 } })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const pageErrors = []
  page.on('pageerror', (err) => pageErrors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text())
  })

  try {
    await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' })
    console.log('Title:', await page.title())

    const canvasCount = await page.$$eval('canvas', (els) => els.length)
    console.log('WebGL canvases (should be 0):', canvasCount)

    const bodyText = await page.textContent('body')
    for (const banned of ['3D University ERP', 'University ERP 3D', 'Red Velvet × Ice Blue × Lavender 3D']) {
      console.log(`Contains "${banned}" (should be false):`, bodyText.includes(banned))
    }

    const navItems = await page.$$eval('.nav-item span', (el) => el.map((e) => e.textContent))
    console.log('Nav items:', navItems)

    // Font size sanity: computed body + heading sizes
    const sizes = await page.evaluate(() => ({
      body: parseFloat(getComputedStyle(document.body).fontSize),
      h1: getComputedStyle(document.querySelector('.topbar-title h1') || document.body).fontSize,
    }))
    console.log('Computed sizes:', sizes)

    // Visit each page and check for console errors + horizontal overflow
    const pages = ['Activity Timeline', 'Timetable', 'Workload Analytics', 'Classroom Booking', 'Leaves & Alerts', 'Academic Calendar', 'Faculty', 'Courses', 'Rooms & Labs', 'Reports', 'Settings', 'Dashboard']
    for (const name of pages) {
      const btn = page.locator('.nav-item', { hasText: name }).first()
      if (await btn.count() > 0) {
        await btn.click()
        await page.waitForTimeout(350)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
        console.log(`Visited "${name}" — horizontal overflow: ${overflow}`)
      }
    }

    console.log('Errors:', pageErrors.length, pageErrors.slice(0, 4))
    console.log(pageErrors.length === 0 ? 'SUCCESS' : 'FAILURES PRESENT')
  } finally {
    await browser.close()
    await server.close()
  }
}

verifyAll().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
