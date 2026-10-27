import { useMemo, useState } from 'react'
import { DAY_NAMES, PERIODS, SECTIONS } from '../data/seed'
import { detectConflicts, visibleDays } from '../lib/timetable'
import { schedulingGuidance } from '../lib/guidance'
import type { AppData, Day, Settings, Slot } from '../types'
import { FieldHelp } from './FieldHelp'
import { Icon } from './Icon'
import { Modal } from './Modal'

export interface SlotDraft {
  day: Day
  period: number
  courseId: string
  facultyId: string
  roomId: string
  section: string
}

interface SlotFormProps {
  open: boolean
  data: AppData
  settings: Settings
  editing?: Slot | null
  preset?: Partial<SlotDraft> | null
  /** True while the API request is in flight. */
  saving?: boolean
  onClose: () => void
  onSave: (draft: SlotDraft) => void
}

function emptyDraft(data: AppData, section: string): SlotDraft {
  const course = data.courses[0]
  return {
    day: 'Mon',
    period: 1,
    courseId: course?.id ?? '',
    facultyId: course?.facultyId ?? '',
    roomId: data.rooms[0]?.id ?? '',
    section,
  }
}

export function SlotForm({ open, data, settings, editing, preset, saving, onClose, onSave }: SlotFormProps) {
  const [draft, setDraft] = useState<SlotDraft>(() => ({ ...emptyDraft(data, SECTIONS[0]), ...preset, ...editing }))
  const [touched, setTouched] = useState(false)

  // Re-sync the draft whenever the dialog is opened for a different slot.
  const [syncKey, setSyncKey] = useState('')
  const key = `${open ? 'open' : 'closed'}-${editing?.id ?? 'new'}-${preset?.day ?? ''}-${preset?.period ?? ''}-${preset?.section ?? ''}`
  if (syncKey !== key) {
    setSyncKey(key)
    if (open) {
      const course = data.courses.find((c) => c.id === editing?.courseId)
      setDraft({ ...emptyDraft(data, preset?.section ?? SECTIONS[0]), ...preset, ...editing, facultyId: editing?.facultyId ?? course?.facultyId ?? data.courses[0]?.facultyId ?? '' })
      setTouched(false)
    }
  }

  const course = data.courses.find((c) => c.id === draft.courseId)
  const faculty = data.faculty.find((f) => f.id === draft.facultyId)
  const room = data.rooms.find((r) => r.id === draft.roomId)
  const days = visibleDays(settings)

  const conflicts = useMemo(
    () => detectConflicts(data, { ...draft, courseId: draft.courseId, facultyId: draft.facultyId }, settings, editing?.id),
    [data, draft, settings, editing?.id],
  )

  const courseFaculty = data.faculty.filter((f) => f.department === course?.department || course?.department === 'Humanities')
  const roomBusy = data.slots.filter((s) => s.id !== editing?.id && s.day === draft.day && s.period === draft.period).map((s) => s.roomId)

  const update = <K extends keyof SlotDraft>(field: K, value: SlotDraft[K]) => setDraft((d) => ({ ...d, [field]: value }))

  const handleCourse = (courseId: string) => {
    const next = data.courses.find((c) => c.id === courseId)
    setDraft((d) => ({ ...d, courseId, facultyId: next?.facultyId ?? d.facultyId }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!draft.courseId || !draft.facultyId || !draft.roomId || !draft.section) return
    onSave(draft)
  }

  return (
    <Modal
      open={open}
      width={600}
      onClose={onClose}
      title={editing ? 'Edit scheduled lecture' : 'Schedule a lecture'}
      description={editing ? 'Update the period, faculty or room for this lecture.' : 'Pick a free period, then assign a course, faculty member and room.'}
      footer={
        <>
          <span className={`modal-foot-note${conflicts.length > 0 ? ' is-warn' : ''}`}>
            {conflicts.length === 0 ? (
              <>
                <Icon name="check" size={14} /> No conflicts detected
              </>
            ) : (
              <>
                <Icon name="warning" size={14} /> {conflicts.length} issue{conflicts.length === 1 ? '' : 's'} to review
              </>
            )}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="slot-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to timetable'}
          </button>
        </>
      }
    >
      <form id="slot-form" className="form" onSubmit={submit} noValidate>
        <div className="form-note">
          <FieldHelp
            title="What this form checks before saving"
            items={schedulingGuidance(data, settings)}
            label="Scheduling rules"
          />
          <span>Faculty on leave, occupied rooms and duplicate section periods are reported below.</span>
        </div>

        <fieldset className="form-section">
          <legend>Time slot</legend>
          <div className="form-row form-row-2">
            <label className="field">
              <span>Day</span>
              <select value={draft.day} onChange={(e) => update('day', e.target.value as Day)}>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {DAY_NAMES[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Period</span>
              <select value={draft.period} onChange={(e) => update('period', Number(e.target.value))}>
                {PERIODS.map((p) => (
                  <option key={p.period} value={p.period}>
                    Period {p.period} · {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Section</span>
            <select value={draft.section} onChange={(e) => update('section', e.target.value)}>
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {touched && !draft.section && <em className="field-error">Select the section this lecture belongs to.</em>}
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Lecture details</legend>
          <label className="field">
            <span>Course</span>
            <select value={draft.courseId} onChange={(e) => handleCourse(e.target.value)}>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Faculty in charge</span>
            <select value={draft.facultyId} onChange={(e) => update('facultyId', e.target.value)}>
              {courseFaculty.length === 0 && <option value="">No faculty from this department</option>}
              {courseFaculty.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} · {f.department}
                  {f.status !== 'Active' ? ` (${f.status.toLowerCase()})` : ''}
                </option>
              ))}
              {data.faculty
                .filter((f) => !courseFaculty.includes(f))
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} · {f.department}
                  </option>
                ))}
            </select>
            {faculty && (
              <em className="field-hint">
                Office {faculty.office} · {faculty.designation}
                {course && faculty.department !== course.department ? ' · outside course department' : ''}
              </em>
            )}
          </label>

          <label className={`field${room && roomBusy.includes(room.id) ? ' has-error' : ''}`}>
            <span>Room</span>
            <select value={draft.roomId} onChange={(e) => update('roomId', e.target.value)}>
              {data.rooms.map((r) => (
                <option key={r.id} value={r.id} disabled={roomBusy.includes(r.id)}>
                  {r.name} · {r.kind} · {r.capacity} seats{roomBusy.includes(r.id) ? ' — occupied this period' : ''}
                </option>
              ))}
            </select>
            {room && (
              <em className={roomBusy.includes(room.id) ? 'field-error' : 'field-hint'}>
                {roomBusy.includes(room.id)
                  ? `${room.name} is already booked for this period — choose another room.`
                  : `${room.building}, ${room.floor} · ${room.resources.join(', ')}`}
              </em>
            )}
          </label>
        </fieldset>

        {conflicts.length > 0 && (
          <div className="conflict-box" role="alert">
            <p className="conflict-title">
              <Icon name="warning" size={15} /> This slot has scheduling conflicts
            </p>
            <ul>
              {conflicts.map((c, i) => (
                <li key={i}>{c.message}</li>
              ))}
            </ul>
            <p className="conflict-note">
              The database refuses overlapping bookings, so this lecture cannot be saved until the clash is cleared.
            </p>
          </div>
        )}
      </form>
    </Modal>
  )
}
