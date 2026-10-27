/**
 * Thin client for the FacultyFlow Express + MySQL API (backend/server.js).
 *
 * The API never exposes database credentials — the browser only sees this HTTP
 * interface. Calls fail soft: callers get `ok: false` with a message instead of
 * an exception, so the UI can fall back to its local copy when the server or
 * MySQL is down.
 */

import type { Course, Faculty } from '../types'

const DEFAULT_BASE =
  typeof window === 'undefined'
    ? 'http://127.0.0.1:5000/api'
    : `${window.location.protocol}//${window.location.hostname}:5000/api`

export const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? DEFAULT_BASE).replace(/\/$/, '')

export interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  /** Human-readable error, e.g. the backend's validation message. */
  error?: string
  /** Timetable conflicts, when the API rejected a clashing slot. */
  conflicts?: string[]
}

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    const text = await res.text()
    let parsed: any = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = null
    }
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? (parsed as T) : null,
      error: res.ok ? undefined : parsed?.error ?? `Request failed (${res.status})`,
      conflicts: res.ok ? undefined : parsed?.conflicts,
    }
  } catch {
    // A network failure or a CORS block both land here: the browser hides the
    // reason, so the message names the two fixes that actually apply.
    return {
      ok: false,
      status: 0,
      data: null,
      error: `Cannot reach the API at ${BASE}. Start the backend (npm start in backend) and add this page's origin to CORS_ORIGINS if you use a custom port.`,
    }
  }
}

const encode = (value: string) => encodeURIComponent(value)

export const api = {
  base: BASE,

  health: () => call<{ status: string; database: string }>('/health'),

  list: <T>(resource: string, query = '') => call<T[]>(`/${resource}${query}`),
  create: <T>(resource: string, payload: unknown) =>
    call<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(payload) }),
  update: <T>(resource: string, key: string, payload: unknown) =>
    call<T>(`/${resource}/${encode(key)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  remove: (resource: string, key: string) =>
    call<{ deleted: string }>(`/${resource}/${encode(key)}`, { method: 'DELETE' }),

  /** Approve / decline / cancel a substitution. */
  setSubstitutionStatus: (substitutionId: string, status: 'Approved' | 'Declined' | 'Cancelled') =>
    call<Record<string, any>>(`/substitutions/${encode(substitutionId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}

/* -------------------------------------------------------------------------- */
/* Row → app model                                                            */
/* -------------------------------------------------------------------------- */

export function initialsOf(name: string) {
  return String(name ?? '')
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*/, '')
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** `2026-10-20 14:30:00` → `2026-10-20 14:30` (the format the app renders). */
export const sqlStamp = (value: unknown) => String(value ?? '').slice(0, 16)

/**
 * Map the backend's snake_case rows onto the app's camelCase shapes.
 * Substitution rows need the timetable/course/faculty context, so they are
 * mapped by `mapping.substitution` once the other lists are loaded.
 */
export const mapping = {
  faculty: (r: Record<string, any>) => ({
    id: r.emp_no,
    name: r.name,
    initials: initialsOf(r.name),
    empNo: r.emp_no,
    department: r.department,
    designation: r.designation ?? '',
    email: r.email,
    phone: r.phone ?? '',
    office: r.office ?? '',
    maxHours: Number(r.max_hours ?? 18),
    status: r.status,
  }),

  course: (r: Record<string, any>) => ({
    id: r.course_id,
    code: r.code,
    title: r.course_name,
    department: r.department,
    semester: String(r.semester),
    credits: Number(r.credits),
    weeklyHours: Number(r.weekly_hours),
    facultyId: r.faculty_emp_no ?? '',
  }),

  room: (r: Record<string, any>) => ({
    id: r.room_id,
    name: r.name,
    building: r.building,
    floor: r.floor ?? '',
    kind: r.kind,
    capacity: Number(r.capacity),
    resources: Array.isArray(r.resources) ? r.resources : [],
  }),

  slot: (r: Record<string, any>) => ({
    id: r.timetable_id,
    day: r.day,
    period: Number(r.period),
    courseId: r.course_id,
    facultyId: r.faculty_emp_no,
    roomId: r.room_id,
    section: r.section,
    term: r.term,
  }),
}

/* -------------------------------------------------------------------------- */
/* Write payloads (app model → API body)                                      */
/* -------------------------------------------------------------------------- */

export const payload = {
  /** Fallback when a course has no faculty in its own department to pick from. */
  fallbackFacultyId: (facultyId: string, courses: Course[], faculty: Faculty[]) => {
    if (facultyId) return facultyId
    const department = courses[0]?.department
    return faculty.find((f) => f.department === department)?.id || faculty[0]?.id || ''
  },

  faculty: (f: {
    empNo: string
    name: string
    department: string
    designation: string
    email: string
    phone: string
    office: string
    maxHours: number
    status: string
  }) => ({
    empNo: f.empNo.trim().toUpperCase(),
    name: f.name.trim(),
    department: f.department,
    designation: f.designation,
    email: f.email.trim(),
    phone: f.phone.trim(),
    office: f.office.trim(),
    maxHours: Number(f.maxHours) || 18,
    status: f.status,
  }),

  course: (c: {
    code: string
    title: string
    department: string
    semester: string
    credits: number
    weeklyHours: number
    facultyId: string
  }) => ({
    code: c.code.trim().toUpperCase(),
    title: c.title.trim(),
    department: c.department,
    semester: c.semester,
    credits: Number(c.credits) || 3,
    weeklyHours: Number(c.weeklyHours) || 3,
    facultyId: c.facultyId || '',
  }),

  room: (r: {
    name: string
    building: string
    floor: string
    kind: string
    capacity: number
    resources: string[]
  }) => ({
    name: r.name.trim().toUpperCase(),
    building: r.building,
    floor: r.floor,
    kind: r.kind,
    capacity: Number(r.capacity) || 40,
    resources: r.resources,
  }),

  slot: (
    s: { day: string; period: number; courseId: string; facultyId: string; roomId: string; section: string },
    term: 'odd' | 'even',
  ) => ({
    day: s.day,
    period: Number(s.period),
    courseId: s.courseId,
    facultyId: s.facultyId,
    roomId: s.roomId,
    section: s.section,
    term,
  }),

  substitution: (s: {
    timetableId?: string
    substituteFacultyId: string
    date: string
    reason: string
    status: string
  }) => ({
    timetableId: s.timetableId,
    substituteFacultyId: s.substituteFacultyId,
    date: s.date,
    reason: s.reason.trim(),
    status: s.status,
  }),
}
