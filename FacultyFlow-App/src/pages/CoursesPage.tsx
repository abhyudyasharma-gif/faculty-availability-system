import { useMemo, useState } from 'react'
import { DEPARTMENTS } from '../data/seed'
import { payload as apiPayload } from '../lib/api'
import { shortName } from '../lib/timetable'
import type { AppStore } from '../state/useAppData'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/Modal'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'

interface CoursesPageProps {
  store: AppStore
  search: string
  onSchedule: (courseId: string) => void
}

const emptyCourse = {
  code: '',
  title: '',
  department: DEPARTMENTS[0],
  semester: '5',
  credits: 3,
  weeklyHours: 3,
  facultyId: '',
}

export function CoursesPage({ store, search, onSchedule }: CoursesPageProps) {
  const { data, mutations } = store
  const toast = useToast()
  const [dept, setDept] = useState('all')
  const [semester, setSemester] = useState('all')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyCourse)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const term = (search || query).trim().toLowerCase()
  const semesters = Array.from(new Set(data.courses.map((c) => c.semester))).sort()

  const rows = useMemo(
    () =>
      data.courses.filter((c) => {
        if (dept !== 'all' && c.department !== dept) return false
        if (semester !== 'all' && c.semester !== semester) return false
        if (!term) return true
        const faculty = data.faculty.find((f) => f.id === c.facultyId)
        return [c.code, c.title, c.department, faculty?.name ?? ''].join(' ').toLowerCase().includes(term)
      }),
    [data.courses, data.faculty, dept, semester, term],
  )

  const openCreate = () => {
    setEditingId(null)
    setDraft(emptyCourse)
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    const course = data.courses.find((c) => c.id === id)
    if (!course) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = course
    setEditingId(id)
    setDraft(rest)
    setErrors({})
    setFormOpen(true)
  }

  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!/^[A-Z]{2}\d{3}P?$/.test(draft.code.trim().toUpperCase())) next.code = 'Use the format CS301 or CS301P for a lab course.'
    if (draft.title.trim().length < 4) next.title = 'Enter the course title as printed in the syllabus.'
    if (data.courses.some((c) => c.code.toUpperCase() === draft.code.trim().toUpperCase() && c.id !== editingId)) {
      next.code = 'This course code is already used in the registry.'
    }
    // The picker only lists the course department's staff, so a course in a
    // department without lecturers still gets the faculty in charge.
    const facultyId = apiPayload.fallbackFacultyId(draft.facultyId, data.courses, data.faculty)
    if (!facultyId) next.facultyId = 'Add a faculty member before registering courses.'
    setErrors(next)
    if (Object.keys(next).length > 0 || saving) return

    const record = { ...draft, facultyId, code: draft.code.trim().toUpperCase(), title: draft.title.trim() }
    setSaving(true)
    const result = await mutations.saveCourse(record, editingId)
    setSaving(false)
    if (!result.ok) {
      // e.g. the unique course code or an unknown faculty member
      setErrors({ code: result.error ?? 'Could not save the course.' })
      toast.error(result.error ?? 'Could not save the course.')
      return
    }
    toast.success(editingId ? 'Course details saved.' : `${record.code} added. You can now place it on the timetable.`)
    setFormOpen(false)
  }

  const removeCourse = async () => {
    if (!deletingId) return
    const course = data.courses.find((c) => c.id === deletingId)
    const result = await mutations.deleteCourse(deletingId)
    if (!result.ok) {
      toast.error(result.error ?? 'Could not remove the course.')
      setDeletingId(null)
      return
    }
    const count = result.data?.released ?? 0
    toast.success(`${course?.code} removed. ${count} scheduled period${count === 1 ? '' : 's'} released.`)
    setDeletingId(null)
  }

  const totalCredits = rows.reduce((sum, c) => sum + c.credits, 0)
  const facultyOptions = data.faculty.filter((f) => f.department === draft.department || draft.department === 'Humanities')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2 className="greeting">Course registry</h2>
          <p className="page-sub">
            {data.courses.length} courses offered this term · {totalCredits} credits in the current view. Weekly hours are compared with the timetable when reports are generated.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={15} /> Add course
        </button>
      </div>

      <div className="filterbar">
        <label className="inline-field">
          <span>Department</span>
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>Semester</span>
          <select value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option value="all">All semesters</option>
            {semesters.map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field grow">
          <span>Search</span>
          <span className="input-with-icon">
            <Icon name="search" size={14} />
            <input type="search" placeholder="Course code, title or faculty" value={query} onChange={(e) => setQuery(e.target.value)} />
          </span>
        </label>
      </div>

      <section className="panel flush">
        <div className="table-scroll">
        <table className="data-table courses-table">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Course</th>
              <th scope="col">Department</th>
              <th scope="col">Sem</th>
              <th scope="col" className="num">
                Credits
              </th>
              <th scope="col">Faculty in charge</th>
              <th scope="col">Scheduled</th>
              <th scope="col" className="ta-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty compact">
                    <p className="empty-title">No courses match the current filters</p>
                    <p className="muted">Change the department or semester, or search by course code.</p>
                  </div>
                </td>
              </tr>
            )}
            {rows.map((course) => {
              const faculty = data.faculty.find((f) => f.id === course.facultyId)
              const scheduled = data.slots.filter((s) => s.courseId === course.id).length
              const short = scheduled < course.weeklyHours
              return (
                <tr key={course.id}>
                  <td className="mono strong">{course.code}</td>
                  <td>
                    {course.title}
                    <span className="cell-sub">{course.weeklyHours} periods required per week</span>
                  </td>
                  <td>{course.department}</td>
                  <td className="mono">{course.semester}</td>
                  <td className="num">{course.credits}</td>
                  <td>
                    {faculty ? shortName(faculty.name) : <span className="cell-warn">Unassigned</span>}
                    {faculty && <span className="cell-sub">{faculty.empNo}</span>}
                  </td>
                  <td>
                    <span className={`count-pill${short ? ' count-short' : ''}`}>
                      {scheduled}/{course.weeklyHours}
                    </span>
                    {short && <span className="cell-sub">{course.weeklyHours - scheduled} period(s) pending</span>}
                  </td>
                  <td className="ta-right actions-cell">
                    <div className="row-actions" role="group" aria-label={`Actions for ${course.code}`}>
                      <button type="button" className="action-btn action-schedule" onClick={() => onSchedule(course.id)}>
                        <Icon name="plus" size={13} /> Schedule
                      </button>
                      <button type="button" className="action-btn action-edit" onClick={() => openEdit(course.id)}>
                        <Icon name="edit" size={13} /> Edit
                      </button>
                      <button type="button" className="action-btn action-remove" onClick={() => setDeletingId(course.id)}>
                        <Icon name="trash" size={13} /> Remove
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
        <footer className="table-foot">
          <span>Scheduled counts include every section offering the course.</span>
          <span className="muted">Course codes follow the university scheme (CS/IT/EC/ME + semester number).</span>
        </footer>
      </section>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit course' : 'Add course'}
        description="Course details appear on the timetable grid and in the workload report."
        width={600}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="course-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add course'}
            </button>
          </>
        }
      >
        <form id="course-form" className="form" onSubmit={save} noValidate>
          <div className="form-row form-row-2">
            <label className={`field${errors.code ? ' has-error' : ''}`}>
              <span>Course code</span>
              <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="CS306" />
              {errors.code && <em className="field-error">{errors.code}</em>}
            </label>
            <label className="field">
              <span>Credits</span>
              <select value={draft.credits} onChange={(e) => setDraft({ ...draft, credits: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={`field${errors.title ? ' has-error' : ''}`}>
            <span>Course title</span>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Compiler Design" />
            {errors.title && <em className="field-error">{errors.title}</em>}
          </label>
          <div className="form-row form-row-2">
            <label className="field">
              <span>Department</span>
              <select value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })}>
                {[...DEPARTMENTS, 'Humanities'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Semester</span>
              <select value={draft.semester} onChange={(e) => setDraft({ ...draft, semester: e.target.value })}>
                {['1', '2', '3', '4', '5', '6', '7', '8'].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row form-row-2">
            <label className={`field${errors.facultyId ? ' has-error' : ''}`}>
              <span>Faculty in charge</span>
              <select value={draft.facultyId} onChange={(e) => setDraft({ ...draft, facultyId: e.target.value })}>
                <option value="">Select faculty</option>
                {facultyOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              {errors.facultyId && <em className="field-error">{errors.facultyId}</em>}
            </label>
            <label className="field">
              <span>Periods per week</span>
              <select value={draft.weeklyHours} onChange={(e) => setDraft({ ...draft, weeklyHours: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deletingId !== null}
        title="Remove course from registry?"
        message={`${
          data.courses.find((c) => c.id === deletingId)?.code ?? 'This course'
        } will be deleted along with ${
          data.slots.filter((s) => s.courseId === deletingId).length
        } scheduled period(s). Remove them only after the sections have been informed.`}
        confirmLabel="Remove course"
        onCancel={() => setDeletingId(null)}
        onConfirm={removeCourse}
      />
    </div>
  )
}
