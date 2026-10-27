import { useEffect, useRef, useState } from 'react'

import { api, mapping } from '../lib/api'
import type {
  AppData,
  Course,
  Faculty,
  Room,
  Slot,
  SubstitutionRequest,
  SubstitutionStatus,
} from '../types'

export type ApiStatus = 'checking' | 'online' | 'offline'

export interface ApiSnapshot {
  faculty?: Faculty[]
  courses?: Course[]
  rooms?: Room[]
  slots?: Slot[]
  substitutions?: SubstitutionRequest[]
}

/**
 * Join Substitution rows with the timetable, course, faculty and room they
 * refer to — that is everything the substitution desk and the timetable grid
 * render.
 */
export function deriveSubstitutions(
  rows: Record<string, unknown>[],
  slots: Slot[],
  courses: Course[],
  faculty: Faculty[],
  rooms: Room[],
): SubstitutionRequest[] {
  const slotById = new Map(slots.map((s) => [s.id, s]))
  const courseById = new Map(courses.map((c) => [c.id, c]))
  const facultyById = new Map(faculty.map((f) => [f.id, f]))
  const roomById = new Map(rooms.map((r) => [r.id, r]))

  return rows.map((row) => {
    const slot = slotById.get(String(row.timetable_id))
    const originalId = String(row.original_emp_no)
    const substituteId = String(row.substitute_emp_no)
    const course = slot ? courseById.get(slot.courseId) : undefined
    const room = slot ? roomById.get(slot.roomId) : undefined
    return {
      id: String(row.substitution_id),
      timetableId: slot?.id ?? String(row.timetable_id),
      term: slot?.term ?? 'odd',
      facultyId: originalId,
      facultyName: facultyById.get(originalId)?.name ?? originalId,
      substituteFacultyId: substituteId,
      substituteFacultyName: facultyById.get(substituteId)?.name ?? substituteId,
      day: slot?.day ?? 'Mon',
      period: slot?.period ?? 0,
      date: String(row.sub_date ?? '').slice(0, 10),
      courseCode: course?.code ?? '',
      section: slot?.section ?? '',
      roomName: room?.name ?? '',
      reason: String(row.reason ?? ''),
      status: row.status as SubstitutionStatus,
      appliedAt: String(row.applied_at ?? '').slice(0, 16),
    }
  })
}

/**
 * Loads the FacultyFlow collections from the Express/MySQL backend.
 *
 * When the API answers, its rows become the working data (`onHydrate`), and
 * every later write goes through the same API. When it does not answer,
 * `status` reports `offline` and the app keeps using the browser copy.
 */
export function useApiSync(enabled: boolean, onHydrate: (patch: Partial<AppData> & ApiSnapshot) => void, refreshKey = 0) {
  const [status, setStatus] = useState<ApiStatus>(enabled ? 'checking' : 'offline')
  const [error, setError] = useState<string | null>(null)
  const hasLoaded = useRef(false)

  useEffect(() => {
    // VITE_DISABLE_API=1 turns the backend off completely (offline demo).
    if (!enabled) return
    let cancelled = false

    const run = async () => {
      if (!hasLoaded.current) setStatus('checking')
      const health = await api.health()
      if (cancelled) return
      if (!health.ok || health.data?.database !== 'connected') {
        setStatus('offline')
        setError(health.error ?? 'Database unavailable')
        return
      }

      const [facultyRes, coursesRes, roomsRes, slotsRes, subsRes] = await Promise.all([
        api.list<Record<string, unknown>>('faculty'),
        api.list<Record<string, unknown>>('courses'),
        api.list<Record<string, unknown>>('rooms'),
        api.list<Record<string, unknown>>('timetable'),
        api.list<Record<string, unknown>>('substitutions'),
      ])
      if (cancelled) return

      const failed = [facultyRes, coursesRes, roomsRes, slotsRes, subsRes].find((r) => !r.ok)
      if (failed) {
        setStatus('offline')
        setError(failed.error ?? 'Load failed')
        return
      }

      const faculty = (facultyRes.data ?? []).map(mapping.faculty) as Faculty[]
      const courses = (coursesRes.data ?? []).map(mapping.course) as Course[]
      const rooms = (roomsRes.data ?? []).map(mapping.room) as Room[]
      const slots = (slotsRes.data ?? []).map(mapping.slot) as Slot[]

      onHydrate({
        faculty,
        courses,
        rooms,
        slots,
        substitutions: deriveSubstitutions(subsRes.data ?? [], slots, courses, faculty, rooms),
      })
      hasLoaded.current = true
      setStatus('online')
      setError(null)
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, refreshKey])

  return { status, error }
}

/** Re-read MySQL on demand (after a write that changes many rows). */
export function useRefreshSignal() {
  const [key, setKey] = useState(0)
  return [key, () => setKey((k) => k + 1)] as const
}

