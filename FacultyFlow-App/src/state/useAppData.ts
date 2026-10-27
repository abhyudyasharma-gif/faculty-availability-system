import { useCallback, useEffect, useState } from 'react'
import {
  SEED_CALENDAR_EVENTS,
  SEED_NOTIFICATIONS,
  SEED_SUBSTITUTIONS,
  seedData,
  seedSettings,
} from '../data/seed'
import { SAMPLE_TERMS, TEACHING_PERIODS, shiftWithinDay } from '../data/terms'
import { nowStamp } from '../lib/datetime'
import { SETTINGS_KEY, STORAGE_KEY, uid } from '../lib/timetable'
import { useApiSync } from './useApiSync'
import { useMutations } from './useMutations'
import type {
  AcademicCalendarEvent,
  AppData,
  ChangeLog,
  Settings,
  Slot,
  SubstitutionRequest,
  SystemNotification,
  TermKey,
} from '../types'

/**
 * Stored data is merged over the current seed shape so new demo fields are
 * filled in, while edits made in a previous session are preserved.
 */
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as T
    if (Array.isArray(fallback)) return (Array.isArray(parsed) ? parsed : fallback) as T
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

/**
 * A timetable keeps one lecture per section, day and period. Data saved by an
 * older build could hold odd- and even-semester lectures on the same section
 * period; a colliding lecture is moved to a free period of the same day (the
 * seed's own position first) so the semester switch never double-books.
 */
function repairSectionOverlaps(data: AppData): AppData {
  const seedKey = (s: Slot) => `${s.term ?? 'odd'}|${s.section}|${s.day}|${s.period}`
  // The seed itself has room for both semesters, so it tells us where a lecture belongs.
  const seedSlot = new Map<string, Slot>()
  for (const s of seedData.slots) seedSlot.set(seedKey(s), s)
  const taken = new Set<string>()
  const moves = new Map<string, number>()
  const claimed = (slot: Slot) => taken.has(`${slot.section}|${slot.day}|${slot.period}`)
  for (const term of ['odd', 'even'] as const) {
    const termSlots = data.slots.filter((s) => (s.term ?? 'odd') === term)
    // Pass 1 — lectures whose seed slot is still free keep exactly that position.
    for (const slot of termSlots) {
      const seed = seedSlot.get(seedKey(slot))
      if (!seed || seed.courseId !== slot.courseId || claimed(seed)) continue
      taken.add(`${seed.section}|${seed.day}|${seed.period}`)
    }
    // Pass 2 — everything else takes the nearest free period in the same day.
    for (const slot of termSlots) {
      const seed = seedSlot.get(seedKey(slot))
      if (seed && seed.courseId === slot.courseId && !claimed(seed)) continue
      const start = Math.max(0, TEACHING_PERIODS.indexOf(slot.period))
      const free = TEACHING_PERIODS.map((_, i) => shiftWithinDay(slot.period, i + start)).find(
        (p) => !taken.has(`${slot.section}|${slot.day}|${p}`),
      )
      const period = free ?? slot.period
      taken.add(`${slot.section}|${slot.day}|${period}`)
      if (period !== slot.period) moves.set(slot.id, period)
    }
  }
  if (moves.size === 0) return data
  return {
    ...data,
    slots: data.slots.map((s) => (moves.has(s.id) ? { ...s, period: moves.get(s.id) as number } : s)),
  }
}


/** Storage key for calendar events. Older builds may have saved other versions. */
const CALENDAR_KEY = 'facultyflow.calendar.v2'

/**
 * One-time upgrade of calendar data saved by an older build: events from the
 * demo seed are refreshed (date ranges are corrected / validated), while any
 * event created or edited in the app is kept exactly as stored.
 */
function upgradeSavedCalendar(saved: AcademicCalendarEvent[]): AcademicCalendarEvent[] {
  const seedById = new Map(SEED_CALENDAR_EVENTS.map((e) => [e.id, e]))
  const savedIds = new Set(saved.map((e) => e.id))

  // Older builds wrote to a differently-versioned key; carry those events over.
  let extra: AcademicCalendarEvent[] = []
  try {
    for (const key of ['facultyflow.calendar.v1', 'facultyflow.calendar.v3']) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const list = JSON.parse(raw)
      if (Array.isArray(list)) {
        extra = list.filter((e) => e && typeof e.id === 'string' && !savedIds.has(e.id))
      }
    }
  } catch {
    extra = []
  }

  const refreshed = saved.map((ev) => {
    const seed = seedById.get(ev.id)
    return seed ? { ...seed } : ev
  })
  // Seed events that never made it into the saved copy are added back.
  for (const seed of SEED_CALENDAR_EVENTS) {
    if (!savedIds.has(seed.id)) refreshed.push({ ...seed })
  }
  return [...refreshed, ...extra]
}

function normaliseSettings(s: Settings): Settings {
  const merged = { ...seedSettings, ...s }
  return {
    ...merged,
    activeTerm: merged.activeTerm ?? 'odd',
    academicYear: merged.academicYear ?? seedSettings.academicYear,
    terms: {
      odd: { ...SAMPLE_TERMS.odd, ...(s.terms?.odd ?? {}) },
      even: { ...SAMPLE_TERMS.even, ...(s.terms?.even ?? {}) },
    },
  }
}

export type LogInput = Pick<ChangeLog, 'action' | 'summary' | 'detail'>

/** The demo coordinator signed in to the app, as configured in Settings. */
export const SIGNED_IN_NAME = 'Shreya Raghavan'

export function signedInName() {
  return 'S. Raghavan'
}

export function useAppData() {
  // Opt out of the API with VITE_DISABLE_API=1 (offline demo).
  const apiEnabled = import.meta.env.VITE_DISABLE_API !== '1'
  // Bumping this re-reads MySQL (used after writes that change many rows).
  const [refreshKey, setRefreshKey] = useState(0)
  // Faculty, courses, rooms and timetable ARE the MySQL tables once the API has
  // answered. The stored copy below only fills the screen while it connects.
  const [data, setData] = useState<AppData>(() => repairSectionOverlaps(load(STORAGE_KEY, seedData)))
  const [settings, setSettings] = useState<Settings>(() => normaliseSettings(load(SETTINGS_KEY, seedSettings)))
  // Declared before `commit` because each new activity log entry is tagged with it.
  const activeTerm: TermKey = settings.activeTerm
  const termConfig = settings.terms[activeTerm]

  /** Merge rows fetched from the Express/MySQL backend into the working data. */
  const hydrateFromApi = useCallback((patch: Partial<AppData> & { substitutions?: SubstitutionRequest[] }) => {
    const { substitutions: fetchedSubs, ...collections } = patch
    // `collections.log` is not in the MySQL schema; keep whatever local activity
    // log entries were recorded during the session rather than resetting them.
    setData((current) => ({ ...current, ...collections, log: current.log }))
    if (fetchedSubs) {
      setSubstitutions(fetchedSubs.map((s) => ({ ...s, term: s.term ?? 'odd' })))
      // Offline cache for the seconds before MySQL answers on the next load.
      localStorage.setItem('facultyflow.substitutions.v3', JSON.stringify(fetchedSubs))
    }
  }, [])

  const { status: apiStatus, error: apiError } = useApiSync(apiEnabled, hydrateFromApi, refreshKey)
  const isOnline = apiStatus === 'online'
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Substitution desk records live beside the timetable data (ER: Substitution).
  const [substitutions, setSubstitutions] = useState<SubstitutionRequest[]>(() =>
    load('facultyflow.substitutions.v2', SEED_SUBSTITUTIONS).map((s) => ({ ...s, term: s.term ?? 'odd' })),
  )
  const [notifications, setNotifications] = useState<SystemNotification[]>(() =>
    load('facultyflow.notifications.v2', SEED_NOTIFICATIONS),
  )
  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>(() =>
    upgradeSavedCalendar(load(CALENDAR_KEY, SEED_CALENDAR_EVENTS)),
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem('facultyflow.substitutions.v2', JSON.stringify(substitutions))
  }, [substitutions])



  useEffect(() => {
    localStorage.setItem('facultyflow.notifications.v2', JSON.stringify(notifications))
  }, [notifications])

  useEffect(() => {
    localStorage.setItem(CALENDAR_KEY, JSON.stringify(calendarEvents))
  }, [calendarEvents])

  const commit = useCallback(
    (updater: (current: AppData) => AppData, entry?: LogInput) => {
      setData((current) => {
        const next = updater(current)
        if (!entry) return next
        const record: ChangeLog = {
          // A new activity always carries the current timestamp and belongs to
          // the semester that is open, so semester filtering stays correct.
          term: activeTerm,
          ...entry,
          id: uid('log'),
          timestamp: nowStamp(),
          actor: signedInName(),
        }
        return { ...next, log: [record, ...next.log].slice(0, 40) }
      })
    },
    [activeTerm],
  )

  /**
   * Restore the sample data. When MySQL is connected the seeded tables are
   * reloaded from the database; otherwise the in-browser copy is reset.
   */
  const resetData = useCallback(() => {
    setSettings(normaliseSettings({ ...seedSettings }))
    setNotifications(SEED_NOTIFICATIONS)
    setCalendarEvents(SEED_CALENDAR_EVENTS)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(SETTINGS_KEY)
    if (isOnline) {
      refresh()
      return
    }
    setData(repairSectionOverlaps({ ...seedData }))
    setSubstitutions(SEED_SUBSTITUTIONS)
  }, [isOnline, refresh])

  /** Switch semester everywhere: timetable views, reports, calendar and availability. */
  const setTerm = useCallback((term: TermKey) => {
    setSettings((current) => ({
      ...current,
      activeTerm: term,
      term: `${current.terms[term].label} · ${current.terms[term].academicYear}`,
    }))
  }, [])

  /** Every timetable entry for the semester currently selected. */
  const termSlots = data.slots.filter((s) => (s.term ?? 'odd') === activeTerm)

  // Database writes: each call updates MySQL first and the local copy after.
  const mutations = useMutations(commit, isOnline)

  return {
    data,
    settings,
    terms: settings.terms,
    termConfig,
    activeTerm,
    setTerm,
    setSettings,
    commit,
    resetData,
    mutations,
    isOnline,
    refresh,
    substitutions,
    setSubstitutions,
    notifications,
    setNotifications,
    calendarEvents,
    setCalendarEvents,
    termSlots,
    apiStatus,
    apiError,
    exportJson: () =>
      JSON.stringify({ data, settings, substitutions, notifications, calendarEvents }, null, 2),
  }
}

export type AppStore = ReturnType<typeof useAppData>

/** Small helper used by pages that only need the term a slot belongs to. */
export function slotTerm(slot: Slot): TermKey {
  return slot.term ?? 'odd'
}
