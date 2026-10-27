import { BREAK_AFTER_PERIOD, DAYS, PERIODS, SUBJECT_COLORS } from '../data/seed'
import { relativeTime } from './datetime'
import type {
  AppData,
  Day,
  Faculty,
  Settings,
  Slot,
  TermKey,
} from '../types'

export const STORAGE_KEY = 'facultyflow.data.v1'
export const SETTINGS_KEY = 'facultyflow.settings.v1'
export const SEED_VERSION = 2

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`
}

export function initialsOf(name: string) {
  const cleaned = name.replace(/(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)/g, '').trim()
  const parts = cleaned.split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

export function shortName(name: string) {
  return name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*/, '')
}

export function todayKey(date = new Date()): Day {
  const map: (Day | null)[] = [null, 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return map[date.getDay()] ?? 'Mon'
}

export function formatDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Relative time for a stored timestamp. Older entries show the real date and
 * time instead of an ever-growing "N days ago" (see lib/datetime.ts).
 */
export function formatStamp(iso: string) {
  return relativeTime(iso)
}

export function periodLabel(period: number) {
  return PERIODS.find((p) => p.period === period)?.label ?? ''
}

export const SUBJECT_TONES = SUBJECT_COLORS

export function toneIndex(courseCode: string) {
  let hash = 0
  for (let i = 0; i < courseCode.length; i += 1) hash = (hash * 31 + courseCode.charCodeAt(i)) % 997
  return hash % SUBJECT_COLORS.length
}

export function colorFor(courseCode: string) {
  return SUBJECT_COLORS[toneIndex(courseCode)]
}

export function facultyHours(data: AppData, facultyId: string, term?: TermKey) {
  return data.slots.filter((s) => s.facultyId === facultyId && (!term || (s.term ?? 'odd') === term)).length
}

export function facultyLoad(data: AppData, faculty: Faculty, term?: TermKey) {
  const hours = facultyHours(data, faculty.id, term)
  const pct = Math.min(100, Math.round((hours / faculty.maxHours) * 100))
  return { hours, pct }
}

export interface Clash {
  type: 'faculty' | 'room' | 'section' | 'leave' | 'limit'
  message: string
}

/** Returns every conflict for a proposed slot. `ignoreId` skips the slot being edited. */
export function detectConflicts(data: AppData, candidate: Omit<Slot, 'id'>, _settings: Settings, ignoreId?: string): Clash[] {
  const clashes: Clash[] = []
  const term = candidate.term ?? 'odd'
  const sameIf = (s: Slot) =>
    s.id !== ignoreId &&
    (s.term ?? 'odd') === term &&
    s.day === candidate.day &&
    s.period === candidate.period &&
    s.section === candidate.section
  const faculty = data.faculty.find((f) => f.id === candidate.facultyId)
  const course = data.courses.find((c) => c.id === candidate.courseId)

  for (const slot of data.slots.filter(sameIf)) {
    const otherFaculty = data.faculty.find((f) => f.id === slot.facultyId)
    const otherRoom = data.rooms.find((r) => r.id === slot.roomId)
    const otherCourse = data.courses.find((c) => c.id === slot.courseId)
    if (slot.facultyId === candidate.facultyId) {
      clashes.push({
        type: 'faculty',
        message: `${otherFaculty?.name ?? 'This faculty'} is already teaching ${otherCourse?.code ?? 'a class'} in ${otherRoom?.name} (${slot.section}).`,
      })
    }
    if (slot.roomId === candidate.roomId) {
      clashes.push({
        type: 'room',
        message: `Room ${otherRoom?.name} is occupied by ${otherCourse?.code ?? 'another class'} for ${slot.section}.`,
      })
    }
    if (slot.section === candidate.section) {
      clashes.push({
        type: 'section',
        message: `Section ${slot.section} already has ${otherCourse?.code ?? 'a lecture'} scheduled in this period.`,
      })
    }
  }

  if (faculty?.status === 'On leave') {
    clashes.push({ type: 'leave', message: `${faculty.name} is marked on leave. Assign a substitute before scheduling.` })
  }
  if (faculty?.status === 'Inactive') {
    clashes.push({ type: 'leave', message: `${faculty.name} is inactive and cannot be allotted new lectures.` })
  }
  if (faculty && course && faculty.department !== course.department && course.department !== 'Humanities') {
    clashes.push({
      type: 'limit',
      message: `${faculty.name} belongs to ${faculty.department}; ${course.code} is offered by ${course.department}.`,
    })
  }
  if (faculty) {
    // Only this semester's periods count towards the weekly teaching limit.
    const load = data.slots.filter(
      (s) => s.facultyId === faculty.id && s.id !== ignoreId && (s.term ?? 'odd') === term,
    ).length
    if (load + 1 > faculty.maxHours) {
      clashes.push({ type: 'limit', message: `Weekly limit exceeded: ${faculty.name} is allotted ${load}/${faculty.maxHours} periods.` })
    }
  }
  return clashes
}

export function overlapsBreak(period: number) {
  return period === BREAK_AFTER_PERIOD
}

export function slotContext(data: AppData, slot: Slot) {
  return {
    course: data.courses.find((c) => c.id === slot.courseId),
    faculty: data.faculty.find((f) => f.id === slot.facultyId),
    room: data.rooms.find((r) => r.id === slot.roomId),
  }
}

export function nextId(data: { id: string }[], prefix: string) {
  const nums = data.map((d) => Number(d.id.replace(/\D/g, '')) || 0)
  return `${prefix}${Math.max(0, ...nums) + 1}`
}

export function visibleDays(settings: Settings): Day[] {
  return settings.showSaturday ? DAYS : DAYS.filter((d) => d !== 'Sat')
}

export function formatTimeNow(date = new Date()) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * The single source of truth for weekly figures, so every dashboard number
 * (and the printed timetable) is derived from exactly the same calculation.
 */
export function weeklyStats(data: AppData, section: string, settings: Settings) {
  const days = visibleDays(settings)
  const term = settings.activeTerm ?? 'odd'
  const inTerm = data.slots.filter((s) => (s.term ?? 'odd') === term)
  const rows = days.map((day) => {
    const slots = inTerm
      .filter((s) => s.section === section && s.day === day)
      .sort((a, b) => a.period - b.period)
    return { day, slots, count: slots.length }
  })
  const slots = inTerm.filter((s) => s.section === section)
  const today = todayKey()
  const todayRow = rows.find((r) => r.day === today)
  const activeCourseIds = new Set(slots.map((s) => s.courseId))
  const usedRooms = new Set(slots.map((s) => s.roomId))
  return {
    days,
    rows,
    total: slots.length,
    todayCount: todayRow?.count ?? 0,
    firstPeriod: todayRow?.slots[0]?.period ?? null,
    courses: data.courses.filter((c) => activeCourseIds.has(c.id)),
    facultyInvolved: new Set(slots.map((s) => s.facultyId)).size,
    roomsUsed: usedRooms.size,
    busiest: Math.max(1, ...rows.map((r) => r.count)),
  }
}

