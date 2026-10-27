import { PERIODS } from '../data/seed'
import type { AppData, Day, Settings, Slot, SubstitutionRequest, TermKey } from '../types'

export type Availability = 'Teaching' | 'Free' | 'On leave' | 'Substituted'

export interface AvailabilityRow {
  facultyId: string
  status: Availability
  /** Slot the faculty is teaching right now / next. */
  slot: Slot | null
  substitute: SubstitutionRequest | null
  /** Period number the status refers to. */
  period: number | null
}

export interface AvailabilityInput {
  data: AppData
  settings: Settings
  substitutions: SubstitutionRequest[]
  term: TermKey
}

export function termSlotsFor(data: AppData, term: TermKey, section?: string) {
  return data.slots.filter((s) => (s.term ?? 'odd') === term && (!section || s.section === section))
}

/** Approved substitutions that apply to one timetable entry. */
export function substitutionFor(
  subs: SubstitutionRequest[],
  slot: Slot,
  term: TermKey,
): SubstitutionRequest | null {
  return (
    subs.find(
      (s) =>
        s.status === 'Approved' &&
        (s.term ?? 'odd') === term &&
        (s.timetableId === slot.id || (s.facultyId === slot.facultyId && s.day === slot.day && s.period === slot.period)),
    ) ?? null
  )
}

function actualPeriod(now = new Date()) {
  const clock = now.getHours() * 60 + now.getMinutes()
  return (
    PERIODS.find((p) => {
      const [sh, sm] = p.start.split(':').map(Number)
      const [eh, em] = p.end.split(':').map(Number)
      return clock >= sh * 60 + sm && clock < eh * 60 + em
    })?.period ?? null
  )
}

/**
 * Derives a faculty member's current state from the timetable, their leave
 * marking and the substitution desk — nothing is hard-coded.
 */
export function facultyAvailability({ data, substitutions, term }: AvailabilityInput) {
  const today = todayOf(new Date()) ?? 'Mon'
  const periodNow = actualPeriod()

  const rows = new Map<string, AvailabilityRow>()

  for (const faculty of data.faculty) {
    const own = data.slots.filter((s) => s.facultyId === faculty.id && (s.term ?? 'odd') === term)
    const todays = own.filter((s) => s.day === today).sort((a, b) => a.period - b.period)

    // Currently timetabled period, otherwise the next one today.
    const activeSlot =
      (periodNow ? todays.find((s) => s.period === periodNow) : undefined) ??
      todays.find((s) => (periodNow ? s.period > periodNow : true)) ??
      todays[0] ??
      null

    const approvedLeave = substitutions.find(
      (s) => s.facultyId === faculty.id && (s.term ?? 'odd') === term && s.status === 'Approved',
    )

    let status: Availability = 'Free'
    if (faculty.status === 'On leave' || approvedLeave) status = 'On leave'
    else if (activeSlot) status = 'Teaching'

    // A substitute covering this faculty member's lecture reads as "Substituted".
    const covering = substitutions.find(
      (s) => s.substituteFacultyId === faculty.id && (s.term ?? 'odd') === term && s.status === 'Approved',
    )
    if (covering && status !== 'On leave') status = 'Substituted'

    rows.set(faculty.id, {
      facultyId: faculty.id,
      status,
      slot: activeSlot,
      substitute: covering ?? approvedLeave ?? null,
      period: activeSlot?.period ?? null,
    })
  }

  return rows
}

/** Next scheduled period for a faculty member within the week. */
export function nextScheduled(data: AppData, term: TermKey, facultyId: string) {
  const today = todayOf(new Date()) ?? 'Mon'
  const days: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const order: Day[] = [today, ...days.filter((d) => d !== today)]
  for (const day of order) {
    const slots = data.slots
      .filter((s) => s.facultyId === facultyId && s.day === day && (s.term ?? 'odd') === term)
      .sort((a, b) => a.period - b.period)
    if (slots.length > 0) return { day, slot: slots[0] }
  }
  return null
}

export function todayOf(date: Date): Day | null {
  const map: (Day | null)[] = [null, 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return map[date.getDay()] ?? 'Mon'
}

export function availabilityTone(status: Availability) {
  return status.toLowerCase().replace(' ', '-')
}

/** Human wording for the availability pill. */
export function availabilityLabel(row: AvailabilityRow) {
  if (row.status === 'Teaching' && row.slot) return 'Teaching now'
  if (row.status === 'On leave') return 'On leave'
  if (row.status === 'Substituted') return 'Substituting'
  return 'Free today'
}
