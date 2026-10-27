import { useCallback } from 'react'
import { api, mapping, payload } from '../lib/api'
import type { Course, Faculty, Room, Slot, SlotDraftLike, SubstitutionDraft, TermKey } from '../types'

export interface MutateResult<T = unknown> {
  ok: boolean
  data: T | null
  error?: string
  /** Timetable conflicts returned by the API (409). */
  conflicts?: string[]
}

/** What `useAppData.commit` accepts: a local updater plus an audit-log entry. */
export type CommitFn = (
  updater: (current: import('../types').AppData) => import('../types').AppData,
  entry?: { action: 'added' | 'updated' | 'removed'; summary: string; detail: string },
) => void

const fail = <T,>(error: string | undefined, conflicts?: string[]): MutateResult<T> => ({
  ok: false,
  data: null,
  error: error ?? 'Request failed',
  conflicts,
})

/**
 * Every database write in the app goes through here: the API call first (MySQL
 * is the source of truth), and the local working copy is updated only when the
 * server accepted the change. A rejected request returns `ok: false` with the
 * server's message, so screens can show the real reason instead of pretending
 * the change was saved.
 */
export function useMutations(commit: CommitFn, isOnline: boolean) {
  const offline = <T,>(): MutateResult<T> =>
    fail<T>('Backend offline — start the API (npm start in backend) to save changes.')
  const guard = <T,>(): MutateResult<T> | null => (isOnline ? null : offline<T>())

  /* ------------------------------------------------------------- faculty */
  const saveFaculty = useCallback(
    async (draft: Omit<Faculty, 'id'>, editingId?: string | null): Promise<MutateResult<Faculty>> => {
      const blocked = guard<Faculty>()
      if (blocked) return blocked
      const body = payload.faculty(draft)
      const res = editingId
        ? await api.update<Record<string, any>>('faculty', body.empNo, body)
        : await api.create<Record<string, any>>('faculty', body)
      if (!res.ok || !res.data) return fail<Faculty>(res.error)
      const saved = mapping.faculty(res.data) as Faculty
      commit(
        (current) => ({
          ...current,
          faculty: editingId
            ? current.faculty.map((f) => (f.id === editingId ? saved : f))
            : [...current.faculty, saved],
          // Renaming a lecturer shows up in the timetable without a reload.
          courses: current.courses.map((c) => (c.facultyId === saved.id ? { ...c } : c)),
        }),
        {
          action: editingId ? 'updated' : 'added',
          summary: `${saved.name} ${editingId ? 'record updated' : 'added to faculty registry'}`,
          detail: `${saved.empNo} · ${saved.designation || '—'} · ${saved.department}`,
        },
      )
      return { ok: true, data: saved }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, isOnline],
  )

  const deleteFaculty = useCallback(
    async (empNo: string): Promise<MutateResult<null>> => {
      const blocked = guard<null>()
      if (blocked) return blocked
      const res = await api.remove('faculty', empNo)
      if (!res.ok) return fail<null>(res.error)
      commit(
        (current) => ({
          ...current,
          faculty: current.faculty.filter((f) => f.id !== empNo),
          courses: current.courses.map((c) => (c.facultyId === empNo ? { ...c, facultyId: '' } : c)),
        }),
        { action: 'removed', summary: `Faculty ${empNo} removed from registry`, detail: 'No lectures were assigned' },
      )
      return { ok: true, data: null }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, isOnline],
  )

  /* -------------------------------------------------------------- courses */
  const saveCourse = useCallback(
    async (
      draft: Omit<Course, 'id'>,
      editingId?: string | null,
    ): Promise<MutateResult<Course>> => {
      const blocked = guard<Course>()
      if (blocked) return blocked
      const body = payload.course(draft)
      const res = editingId
        ? await api.update<Record<string, any>>('courses', editingId, body)
        : await api.create<Record<string, any>>('courses', body)
      if (!res.ok || !res.data) return fail<Course>(res.error)
      const saved = mapping.course(res.data) as Course
      commit(
        (current) => ({
          ...current,
          courses: editingId
            ? current.courses.map((c) => (c.id === editingId ? saved : c))
            : [...current.courses, saved],
        }),
        {
          action: editingId ? 'updated' : 'added',
          summary: `${saved.code} ${editingId ? 'details updated' : 'added to course registry'}`,
          detail: `${saved.title} · Semester ${saved.semester}`,
        },
      )
      return { ok: true, data: saved }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, isOnline],
  )

  const deleteCourse = useCallback(
    async (courseId: string): Promise<MutateResult<{ released: number }>> => {
      const blocked = guard<{ released: number }>()
      if (blocked) return blocked
      const res = await api.remove('courses', courseId)
      if (!res.ok) return fail(res.error)
      const released = (res.data as any)?.timetable_entries_removed ?? 0
      commit(
        (current) => ({
          ...current,
          courses: current.courses.filter((c) => c.id !== courseId),
          // The database cascades the course's timetable rows.
          slots: current.slots.filter((s) => s.courseId !== courseId),
        }),
        {
          action: 'removed',
          summary: 'Course removed from registry',
          detail: `${released} scheduled period${released === 1 ? '' : 's'} released`,
        },
      )
      return { ok: true, data: { released } }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, isOnline],
  )

  /* ---------------------------------------------------------------- rooms */
  const saveRoom = useCallback(
    async (draft: Omit<Room, 'id'>, editingId?: string | null): Promise<MutateResult<Room>> => {
      const blocked = guard<Room>()
      if (blocked) return blocked
      const body = payload.room(draft)
      const res = editingId
        ? await api.update<Record<string, any>>('rooms', editingId, body)
        : await api.create<Record<string, any>>('rooms', body)
      if (!res.ok || !res.data) return fail<Room>(res.error)
      const saved = mapping.room(res.data) as Room
      commit(
        (current) => ({
          ...current,
          rooms: editingId ? current.rooms.map((r) => (r.id === editingId ? saved : r)) : [...current.rooms, saved],
        }),
        {
          action: editingId ? 'updated' : 'added',
          summary: `Room ${saved.name} ${editingId ? 'updated' : 'added'}`,
          detail: `${saved.kind} · ${saved.capacity} seats · ${saved.building}`,
        },
      )
      return { ok: true, data: saved }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, isOnline],
  )

  const deleteRoom = useCallback(
    async (roomId: string): Promise<MutateResult<null>> => {
      const blocked = guard<null>()
      if (blocked) return blocked
      const res = await api.remove('rooms', roomId)
      if (!res.ok) return fail<null>(res.error)
      commit(
        (current) => ({ ...current, rooms: current.rooms.filter((r) => r.id !== roomId) }),
        { action: 'removed', summary: 'Room removed from inventory', detail: 'No lectures were booked there' },
      )
      return { ok: true, data: null }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, isOnline],
  )

  /* ------------------------------------------------------------ timetable */
  const createSlot = useCallback(
    async (draft: SlotDraftLike, term: TermKey): Promise<MutateResult<Slot>> => {
      const blocked = guard<Slot>()
      if (blocked) return blocked
      const res = await api.create<Record<string, any>>('timetable', payload.slot(draft, term))
      if (!res.ok || !res.data) return fail<Slot>(res.error, res.conflicts)
      const saved = mapping.slot(res.data) as Slot
      commit((current) => ({ ...current, slots: [...current.slots, saved] }))
      return { ok: true, data: saved }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, isOnline],
  )

  const updateSlot = useCallback(
    async (slotId: string, draft: SlotDraftLike, term: TermKey): Promise<MutateResult<Slot>> => {
      const blocked = guard<Slot>()
      if (blocked) return blocked
      const res = await api.update<Record<string, any>>('timetable', slotId, payload.slot(draft, term))
      if (!res.ok || !res.data) return fail<Slot>(res.error, res.conflicts)
      const saved = mapping.slot(res.data) as Slot
      commit((current) => ({ ...current, slots: current.slots.map((s) => (s.id === slotId ? saved : s)) }))
      return { ok: true, data: saved }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, isOnline],
  )

  const deleteSlot = useCallback(
    async (slotId: string): Promise<MutateResult<null>> => {
      const blocked = guard<null>()
      if (blocked) return blocked
      const res = await api.remove('timetable', slotId)
      if (!res.ok) return fail<null>(res.error)
      commit((current) => ({ ...current, slots: current.slots.filter((s) => s.id !== slotId) }))
      return { ok: true, data: null }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, isOnline],
  )

  /** Undo a delete by re-creating the lecture (the database issues a new id). */
  const restoreSlot = useCallback(
    async (slot: Slot): Promise<MutateResult<Slot>> => createSlot(slot, slot.term ?? 'odd'),
    [createSlot],
  )

  /* ------------------------------------------------------- substitutions */
  const saveSubstitution = useCallback(
    async (
      draft: SubstitutionDraft,
      editingId?: string | null,
    ): Promise<MutateResult<SubstitutionDraft>> => {
      const blocked = guard<SubstitutionDraft>()
      if (blocked) return blocked
      const body = payload.substitution(draft)
      const res = editingId
        ? await api.update<Record<string, any>>('substitutions', editingId, body)
        : await api.create<Record<string, any>>('substitutions', body)
      if (!res.ok || !res.data) return fail<SubstitutionDraft>(res.error)
      return { ok: true, data: draft }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOnline],
  )

  const setSubstitutionStatus = useCallback(
    async (substitutionId: string, status: 'Approved' | 'Declined' | 'Cancelled'): Promise<MutateResult<null>> => {
      const blocked = guard<null>()
      if (blocked) return blocked
      const res = await api.setSubstitutionStatus(substitutionId, status)
      if (!res.ok) return fail<null>(res.error)
      return { ok: true, data: null }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOnline],
  )

  return {
    saveFaculty,
    deleteFaculty,
    saveCourse,
    deleteCourse,
    saveRoom,
    deleteRoom,
    createSlot,
    updateSlot,
    deleteSlot,
    restoreSlot,
    saveSubstitution,
    setSubstitutionStatus,
  }
}

export type Mutations = ReturnType<typeof useMutations>
