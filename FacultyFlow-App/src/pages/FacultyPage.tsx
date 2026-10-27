import { useState } from 'react'
import { DAY_NAMES, PERIODS } from '../data/seed'
import { facultyAvailability, nextScheduled, termSlotsFor } from '../lib/availability'
import { shortName } from '../lib/timetable'
import type { AppStore } from '../state/useAppData'
import type { Faculty, FacultyStatus } from '../types'
import { Icon } from '../components/Icon'
import { Modal, ConfirmDialog } from '../components/Modal'
import { useToast } from '../components/Toast'
import { initialsOf } from '../lib/timetable'

interface FacultyPageProps {
  store: AppStore
  search: string
  onOpenTimetable?: () => void
}

const emptyFaculty: Omit<Faculty, 'id'> = {
  name: '',
  initials: '',
  empNo: '',
  department: 'Computer Science',
  designation: 'Assistant Professor',
  email: '',
  phone: '',
  office: '',
  maxHours: 18,
  status: 'Active',
}

const AVAILABILITY_ORDER = ['Teaching', 'Substituted', 'Free', 'On leave'] as const

export function FacultyPage({ store, search }: FacultyPageProps) {
  const { data, mutations, activeTerm, substitutions } = store
  const toast = useToast()
  const [dept, setDept] = useState('all')
  const [status, setStatus] = useState<'all' | FacultyStatus>('all')
  const [avail, setAvail] = useState<'all' | 'Teaching' | 'Free' | 'On leave' | 'Substituted'>('all')
  const [period, setPeriod] = useState<'all' | number>('all')
  const [query, setQuery] = useState('')
  // The profile dialog keeps the *id* so it always renders the saved record
  // after an edit, instead of a stale copy taken when it was opened.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = data.faculty.find((f) => f.id === selectedId) ?? null
  const [editing, setEditing] = useState<Faculty | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<Omit<Faculty, 'id'>>(emptyFaculty)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<Faculty | null>(null)

  const term = (search || query).trim().toLowerCase()
  const availability = facultyAvailability({ data, settings: store.settings, substitutions, term: activeTerm })
  const activeSlots = termSlotsFor(data, activeTerm)
  const departments = Array.from(new Set(data.faculty.map((f) => f.department))).sort()

  const rows = data.faculty.filter((f) => {
    if (dept !== 'all' && f.department !== dept) return false
    if (status !== 'all' && f.status !== status) return false
    const row = availability.get(f.id)
    if (avail !== 'all' && row?.status !== avail) return false
    if (period !== 'all') {
      const teaching = activeSlots.some((s) => s.facultyId === f.id && s.period === period)
      if (avail === 'Free' ? teaching : !teaching) return false
    }
    if (!term) return true
    return [f.name, f.empNo, f.department, f.designation, f.email, f.office].join(' ').toLowerCase().includes(term)
  })

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyFaculty)
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (faculty: Faculty) => {
    setEditing(faculty)
    const { id: _id, ...rest } = faculty
    void _id
    setDraft(rest)
    setErrors({})
    setFormOpen(true)
  }

  const validate = () => {
    const next: Record<string, string> = {}
    if (draft.name.trim().length < 3) next.name = 'Enter the full name as printed on the staff record.'
    if (!/^[A-Z]{2,5}-\d{3,5}$/i.test(draft.empNo.trim())) next.empNo = 'Use the college format, for example CSE-1042.'
    if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) next.email = 'Enter a valid college email address.'
    if (!draft.office.trim()) next.office = 'Office or cabin number is required.'
    if (!draft.maxHours || draft.maxHours < 4 || draft.maxHours > 30) next.maxHours = 'Weekly maximum must be between 4 and 30 periods.'
    if (data.faculty.some((f) => f.empNo.toLowerCase() === draft.empNo.trim().toLowerCase() && f.id !== editing?.id)) {
      next.empNo = 'This employee number is already registered.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate() || saving) return
    const record: Omit<Faculty, 'id'> = { ...draft, name: draft.name.trim(), initials: initialsOf(draft.name) }
    setSaving(true)
    const result = await mutations.saveFaculty(record, editing?.id ?? null)
    setSaving(false)
    if (!result.ok) {
      // The database rejected the write: keep the dialog open and explain why.
      toast.error(result.error ?? 'Could not save the faculty record.')
      return
    }
    toast.success(
      editing ? 'Faculty record updated.' : `${record.name} added. They can now be assigned to lectures.`,
    )
    setFormOpen(false)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const result = await mutations.deleteFaculty(deleting.id)
    if (!result.ok) {
      toast.error(result.error ?? 'Could not remove the faculty member.')
      setDeleting(null)
      return
    }
    toast.success(`${deleting.name} removed from the registry.`)
    setDeleting(null)
    setSelectedId(null)
  }

  const selectedAvailability = selected ? availability.get(selected.id) : undefined
  const selectedSlots = selected
    ? activeSlots.filter((s) => s.facultyId === selected.id).sort((a, b) => a.period - b.period)
    : []
  const selectedCourses = selected ? data.courses.filter((c) => c.facultyId === selected.id) : []

  return (
    <div className="page stagger">
      <div className="page-head">
        <div>
          <h2 className="page-title">Faculty directory &amp; availability</h2>
          <p className="page-sub">
            {data.faculty.length} teaching staff across {departments.length} departments. Availability in the{' '}
            {activeTerm === 'odd' ? 'odd' : 'even'} semester is derived from the timetable and the substitution desk.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={16} /> Add faculty
        </button>
      </div>

      <div className="filterbar">
        <label className="inline-field">
          <span>Department</span>
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">Any status</option>
            <option value="Active">Active</option>
            <option value="On leave">On leave</option>
            <option value="Inactive">Inactive</option>
          </select>
        </label>
        <label className="inline-field">
          <span>Availability</span>
          <select value={avail} onChange={(e) => setAvail(e.target.value as typeof avail)}>
            <option value="all">Any availability</option>
            {AVAILABILITY_ORDER.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>Period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
            <option value="all">Any period</option>
            {PERIODS.map((p) => (
              <option key={p.period} value={p.period}>
                P{p.period} · {p.start}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field grow">
          <span>Search</span>
          <span className="input-with-icon">
            <Icon name="search" size={15} />
            <input
              type="search"
              placeholder="Name, employee no., cabin"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </span>
        </label>
        <span className="filter-count">
          Showing {rows.length} of {data.faculty.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="panel empty">
          <span className="empty-icon">
            <Icon name="users" size={22} />
          </span>
          <p className="empty-title">No faculty match these filters</p>
          <p className="muted">Clear the department, availability or status filter, or search by employee number.</p>
        </div>
      ) : (
        <div className="faculty-grid">
          {rows.map((faculty) => {
            const row = availability.get(faculty.id)
            const next = nextScheduled(data, activeTerm, faculty.id)
            const nextCourse = next ? data.courses.find((c) => c.id === next.slot.courseId) : undefined
            const nextPeriod = next ? PERIODS.find((p) => p.period === next.slot.period) : undefined
            return (
              <article key={faculty.id} className="faculty-card">
                <div className="faculty-card-top">
                  <span className="avatar avatar-md">{faculty.initials}</span>
                  <div className="faculty-identity">
                    <h3>{shortName(faculty.name)}</h3>
                    <p>
                      {faculty.designation} · {faculty.department}
                    </p>
                  </div>
                  <span className={`pill avail-${(row?.status ?? 'Free').toLowerCase().replace(' ', '-')} pill-${row?.status === 'Free' ? 'green' : row?.status === 'Teaching' ? 'ice' : row?.status === 'Substituted' ? 'velvet' : 'amber'}`}>
                    <span className="avail-dot" /> {row?.status ?? 'Free'}
                  </span>
                </div>

                <div className="faculty-facts">
                  <div className="faculty-fact">
                    <span>Office</span>
                    <strong>{faculty.office}</strong>
                  </div>
                  <div className="faculty-fact">
                    <span>Email</span>
                    <strong>{faculty.email}</strong>
                  </div>
                  <div className="faculty-fact">
                    <span>Employee no.</span>
                    <strong className="mono">{faculty.empNo}</strong>
                  </div>
                  <div className="faculty-fact">
                    <span>Weekly load</span>
                    <strong>
                      {activeSlots.filter((s) => s.facultyId === faculty.id).length}/{faculty.maxHours} periods
                    </strong>
                  </div>
                </div>

                <div className="faculty-card-foot">
                  <p>
                    {next ? (
                      <>
                        Next: <strong>{nextCourse?.code}</strong> · {DAY_NAMES[next.day]} {nextPeriod?.start} ·{' '}
                        {data.rooms.find((r) => r.id === next.slot.roomId)?.name}
                      </>
                    ) : (
                      'No further periods this week'
                    )}
                  </p>
                  <button type="button" className="link-btn" onClick={() => setSelectedId(faculty.id)}>
                    View profile <Icon name="arrow-right" size={15} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? shortName(selected.name) : 'Faculty profile'}
        description={selected ? `${selected.designation} · ${selected.department}` : undefined}
        width={620}
        footer={
          selected ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setSelectedId(null)}>
                Close
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => openEdit(selected)}>
                <Icon name="edit" size={15} /> Edit
              </button>
            </>
          ) : undefined
        }
      >
        {selected && (
          <div className="faculty-detail">
            <div className="faculty-detail-head">
              <span className="avatar avatar-md">{selected.initials}</span>
              <div style={{ minWidth: 0 }}>
                <h3>{selected.name}</h3>
                <p>
                  {selected.designation ? `${selected.designation} · ` : ''}
                  {selected.empNo} · {selected.email}
                </p>
              </div>
            </div>
            <div className="detail-facts">
              <div className="detail-fact">
                <span>Office</span>
                <strong>{selected.office}</strong>
              </div>
              <div className="detail-fact">
                <span>Phone</span>
                <strong>{selected.phone || 'Not recorded'}</strong>
              </div>
              <div className="detail-fact">
                <span>Availability</span>
                <strong>{selectedAvailability?.status ?? 'Free'}</strong>
              </div>
              <div className="detail-fact">
                <span>Courses</span>
                <strong>{selectedCourses.map((c) => c.code).join(', ') || 'None assigned'}</strong>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: 15, marginBottom: 8 }}>
                Scheduled periods · {activeTerm === 'odd' ? 'Odd' : 'Even'} semester
              </h4>
              {selectedSlots.length === 0 ? (
                <p className="muted small">No periods allotted in this semester.</p>
              ) : (
                <div className="slot-list">
                  {selectedSlots.map((slot) => {
                    const course = data.courses.find((c) => c.id === slot.courseId)
                    const room = data.rooms.find((r) => r.id === slot.roomId)
                    const p = PERIODS.find((x) => x.period === slot.period)
                    const sub = substitutions.find(
                      (s) =>
                        s.status === 'Approved' &&
                        (s.timetableId === slot.id || (s.facultyId === slot.facultyId && s.day === slot.day && s.period === slot.period)),
                    )
                    return (
                      <div className="slot-row" key={slot.id}>
                        <span className="day-badge">{slot.day}</span>
                        <span className="slot-main">
                          <strong>
                            {course?.code} · {course?.title}
                          </strong>
                          <span>
                            {p?.start}–{p?.end} · Room {room?.name} · {slot.section}
                          </span>
                        </span>
                        {sub ? <span className="pill pill-velvet">Substituted</span> : <span className="pill pill-ice">Scheduled</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-danger-outline btn-sm"
                onClick={() => {
                  setDeleting(selected)
                }}
              >
                <Icon name="trash" size={15} /> Remove from registry
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit faculty record' : 'Add faculty member'}
        description={
          editing
            ? `Changes to ${editing.name} will apply to every lecture already assigned to them.`
            : 'Employee details are used in the timetable, substitution checks and workload reports.'
        }
        width={640}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="faculty-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to registry'}
            </button>
          </>
        }
      >
        <form id="faculty-form" className="form" onSubmit={save} noValidate>
          <fieldset className="form-section">
            <legend>Personal details</legend>
            <div className="form-row form-row-2">
              <label className={`field${errors.name ? ' has-error' : ''}`}>
                <span>Full name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Dr. Kavita Joshi"
                />
                {errors.name && <em className="field-error">{errors.name}</em>}
              </label>
              <label className={`field${errors.empNo ? ' has-error' : ''}`}>
                <span>Employee number</span>
                <input
                  value={draft.empNo}
                  onChange={(e) => setDraft({ ...draft, empNo: e.target.value.toUpperCase() })}
                  placeholder="CSE-1091"
                />
                {errors.empNo && <em className="field-error">{errors.empNo}</em>}
              </label>
            </div>
            <div className="form-row form-row-2">
              <label className={`field${errors.email ? ' has-error' : ''}`}>
                <span>College email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="name@kce.ac.in"
                />
                {errors.email && <em className="field-error">{errors.email}</em>}
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="+91 98765 41200"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Academic posting</legend>
            <div className="form-row form-row-2">
              <label className="field">
                <span>Department</span>
                <select value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })}>
                  {['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Humanities'].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Designation</span>
                <select value={draft.designation} onChange={(e) => setDraft({ ...draft, designation: e.target.value })}>
                  {['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer'].map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row form-row-3">
              <label className={`field${errors.office ? ' has-error' : ''}`}>
                <span>Office / cabin</span>
                <input
                  value={draft.office}
                  onChange={(e) => setDraft({ ...draft, office: e.target.value.toUpperCase() })}
                  placeholder="C-214"
                />
                {errors.office && <em className="field-error">{errors.office}</em>}
              </label>
              <label className={`field${errors.maxHours ? ' has-error' : ''}`}>
                <span>Max periods / week</span>
                <input
                  type="number"
                  min={4}
                  max={30}
                  value={draft.maxHours}
                  onChange={(e) => setDraft({ ...draft, maxHours: Number(e.target.value) })}
                />
                {errors.maxHours && <em className="field-error">{errors.maxHours}</em>}
              </label>
              <label className="field">
                <span>Availability</span>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as FacultyStatus })}
                >
                  <option>Active</option>
                  <option>On leave</option>
                  <option>Inactive</option>
                </select>
              </label>
            </div>
          </fieldset>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Remove faculty member?"
        message={
          deleting
            ? `${deleting.name} (${deleting.empNo}) will be removed from the registry. Scheduled periods assigned to them will be released. This cannot be undone.`
            : ''
        }
        confirmLabel="Remove faculty"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
