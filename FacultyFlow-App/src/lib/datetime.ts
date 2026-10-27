/**
 * Date/time helpers shared by the activity timeline and the academic calendar.
 *
 * Dates are handled as `YYYY-MM-DD` keys in local time — never `new Date('YYYY-MM-DD')`,
 * which parses as UTC and can shift an event to the previous day in IST.
 */

/** Local `YYYY-MM-DD` key for a Date (month/day padded, no timezone conversion). */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Midnight (local) for a `YYYY-MM-DD` key. */
export function parseDateKey(key: string): Date {
  const [y, m, d] = String(key).slice(0, 10).split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Monday-first start of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0, 0, 0, 0)
  return d
}

/** Inclusive day count of an event (`1` for a single-day event). */
export function dayCount(start: string, end?: string): number {
  const a = parseDateKey(start).getTime()
  const b = parseDateKey(end ?? start).getTime()
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1)
}

/**
 * `9–14 Nov 2026` / `28 Dec 2026 – 3 Jan 2027` / `9 Nov 2026` for a single day.
 * Always shows the year so a date is never ambiguous.
 */
export function formatRange(start: string, end?: string, opts?: { short?: boolean }): string {
  const a = parseDateKey(start)
  const last = end && end > start ? end : undefined
  if (!last) return a.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const b = parseDateKey(last)
  const sameYear = a.getFullYear() === b.getFullYear()
  const sameMonth = sameYear && a.getMonth() === b.getMonth()
  const left = sameMonth
    ? String(a.getDate())
    : a.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  if (opts?.short && sameYear) {
    return `${left} – ${b.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  }
  return `${left} – ${b.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

/**
 * Parse a stored timestamp (`2026-10-19T08:42:00` or `2026-10-19 08:42:00`).
 * Returns `null` for anything unparseable so callers can show the raw value.
 */
export function parseTimestamp(value: string | undefined | null): Date | null {
  if (!value) return null
  const d = new Date(String(value).trim().replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

/** `19 Oct 2026, 08:42` */
export function formatDateTime(value: string | undefined | null): string {
  const d = parseTimestamp(value)
  if (!d) return String(value ?? '—')
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** `19 Oct 2026` */
export function formatDateKey(value: string | undefined | null): string {
  const d = parseTimestamp(value)
  if (!d) return String(value ?? '—')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
/** How far ahead of the clock an entry may sit and still count as "just now". */
const FUTURE_TOLERANCE = MINUTE

/**
 * Human relative time, but only when it is truthful:
 *   ≤ 1 min  → "Just now"           < 60 min → "5 minutes ago"
 *   < 24 h   → "2 hours ago"        < 7 d    → "3 days ago"
 *   anything older or scheduled in the future → the real date and time.
 *
 * `futureTimestamp` is for sources whose date is a *scheduled* date (calendar
 * events): there a timestamp ahead of the clock is normal, so it is shown as the
 * actual date rather than being described as "Just now". A real activity record
 * with a future timestamp is also shown as a date, never as "Just now", which is
 * what made every demo entry look identical.
 */
export function relativeTime(
  value: string | undefined | null,
  now = new Date(),
  { futureTimestamp = false }: { futureTimestamp?: boolean } = {},
): string {
  const d = parseTimestamp(value)
  if (!d) return String(value ?? '—')
  const diff = now.getTime() - d.getTime()

  if (diff < 0) {
    // A scheduled date, or clock skew of a few seconds on a real activity.
    if (futureTimestamp || diff > -FUTURE_TOLERANCE) {
      return Math.abs(diff) < MINUTE && !futureTimestamp ? 'Just now' : formatDateTime(value)
    }
    return formatDateTime(value)
  }
  if (diff < MINUTE) return 'Just now'

  if (diff < HOUR) {
    const mins = Math.max(1, Math.floor(diff / MINUTE))
    return `${mins} minute${mins === 1 ? '' : 's'} ago`
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  if (diff < WEEK) {
    const days = Math.floor(diff / DAY)
    return `${days} day${days === 1 ? '' : 's'} ago`
  }
  return formatDateTime(value)
}

/** Timestamp for a new record: current local time in the same format the log stores. */
export function nowStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}
