import { useMemo, useState } from 'react'
import { SAMPLE_TERMS } from '../data/terms'
import { PERIODS } from '../data/seed'
import { formatStamp, shortName } from '../lib/timetable'
import type { AppStore } from '../state/useAppData'
import type { SubstitutionRequest } from '../types'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'

interface Props {
  store: AppStore
  onOpenTimetable?: () => void
}

type StatusFilter = 'all' | SubstitutionRequest['status']

const emptyDraft = (store: AppStore): Omit<SubstitutionRequest, 'id'> => {
  const first = store.data.faculty.find((f) => f.status === 'On leave') ?? store.data.faculty[0]
  const slot = store.termSlots.find((s) => s.facultyId === first?.id) ?? store.termSlots[0]
  const substitute = store.data.faculty.find((f) => f.id !== first?.id && f.status === 'Active')
  const course = store.data.courses.find((c) => c.id === slot?.courseId)
  const room = store.data.rooms.find((r) => r.id === slot?.roomId)
  return {
    timetableId: slot?.id,
    facultyId: slot?.facultyId ?? '',
    facultyName: store.data.faculty.find((f) => f.id === slot?.facultyId)?.name ?? '',
    substituteFacultyId: substitute?.id ?? '',
    substituteFacultyName: substitute?.name ?? '',
    day: slot?.day ?? 'Mon',
    period: slot?.period ?? 1,
    date: store.termConfig.startDate,
    courseCode: course?.code ?? '',
    section: slot?.section ?? 'CSE-2B',
    roomName: room?.name ?? '',
    reason: '',
    status: 'Pending',
    appliedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    term: store.activeTerm,
  }
}

export function LeaveSubstitutionPage({ store, onOpenTimetable }: Props) {
  const {
    data,
    mutations,
    substitutions,
    setSubstitutions,
    refresh,
    notifications,
    setNotifications,
    activeTerm,
    termSlots,
    termConfig,
  } = store
  const toast = useToast()

  const [tab, setTab] = useState<'desk' | 'alerts'>('desk')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [facultyFilter, setFacultyFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<SubstitutionRequest | null>(null)
  const [draft, setDraft] = useState<Omit<SubstitutionRequest, 'id'>>(() => emptyDraft(store))
  const [error, setError] = useState('')
  const [cancelling, setCancelling] = useState<SubstitutionRequest | null>(null)

  const termSubs = useMemo(() => substitutions.filter((s) => (s.term ?? 'odd') === activeTerm), [substitutions, activeTerm])

  const rows = termSubs.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (facultyFilter !== 'all' && s.facultyId !== facultyFilter && s.substituteFacultyId !== facultyFilter) return false
    return true
  })

  const pendingCount = termSubs.filter((s) => s.status === 'Pending').length
  const unread = notifications.filter((n) => !n.read).length

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft(store))
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (sub: SubstitutionRequest) => {
    setEditing(sub)
    const { id: _id, ...rest } = sub
    void _id
    setDraft({ ...rest })
    setError('')
    setDialogOpen(true)
  }

  /** Changing the affected lecture keeps course, section, room and time in sync. */
  const chooseLecture = (slotId: string) => {
    const slot = data.slots.find((s) => s.id === slotId)
    if (!slot) return
    const course = data.courses.find((c) => c.id === slot.courseId)
    const faculty = data.faculty.find((f) => f.id === slot.facultyId)
    const room = data.rooms.find((r) => r.id === slot.roomId)
    setDraft((d) => ({
      ...d,
      timetableId: slot.id,
      facultyId: slot.facultyId,
      facultyName: faculty?.name ?? d.facultyName,
      courseCode: course?.code ?? d.courseCode,
      section: slot.section,
      roomName: room?.name ?? d.roomName,
      day: slot.day,
      period: slot.period,
    }))
    setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.substituteFacultyId) {
      setError('Select the faculty member who will cover this lecture.')
      return
    }
    if (draft.substituteFacultyId === draft.facultyId) {
      setError('The substitute must be a different faculty member.')
      return
    }
    // Demo conflict rule: a substitute cannot be covering two lectures at once.
    const clash = termSubs.find(
      (s) =>
        s.id !== editing?.id &&
        s.status === 'Approved' &&
        s.substituteFacultyId === draft.substituteFacultyId &&
        s.date === draft.date &&
        s.period === draft.period,
    )
    if (clash) {
      setError(`${clash.substituteFacultyName} is already covering ${clash.courseCode} in period ${clash.period} on that date.`)
      return
    }
    if (!draft.reason.trim()) {
      setError('Add a short reason for the substitution.')
      return
    }

    // Substitutions live in MySQL; reload them afterwards so ids, dates and
    // statuses are exactly what the database now holds.
    const result = await mutations.saveSubstitution(draft, editing?.id ?? null)
    if (!result.ok) {
      setError(result.error ?? 'Could not save the substitution.')
      return
    }
    if (editing) {
      toast.success('Substitution updated.')
    } else {
      setNotifications([
        {
          id: `notif-${Date.now().toString(36)}`,
          title: 'New substitution request',
          message: `${draft.facultyName} nominated ${draft.substituteFacultyName} for ${draft.courseCode} on ${draft.date}.`,
          timestamp: 'Just now',
          read: false,
          type: 'substitution',
          priority: 'high',
        },
        ...notifications,
      ])
      toast.success('Substitution request created for review.')
    }
    setDialogOpen(false)
    refresh()
  }

  const decide = async (id: string, status: 'Approved' | 'Declined') => {
    const sub = substitutions.find((s) => s.id === id)
    const result = await mutations.setSubstitutionStatus(id, status)
    if (!result.ok) {
      toast.error(result.error ?? 'Could not update the substitution.')
      return
    }
    // Reflect the stored status immediately; refresh() then reconciles with MySQL.
    setSubstitutions((current) => current.map((s) => (s.id === id ? { ...s, status } : s)))
    if (status === 'Approved' && sub) {
      store.commit((current) => current, {
        action: 'updated',
        summary: `Substitution approved for ${sub.courseCode}`,
        detail: `${sub.substituteFacultyName} covers ${sub.facultyName} · ${sub.day} P${sub.period} · ${sub.section}`,
      })
      refresh()
      toast.success(`${sub.substituteFacultyName} will cover ${sub.courseCode}. The timetable now shows the change.`)
    } else {
      refresh()
      toast.info('Substitution request declined.')
    }
  }

  const cancelSub = async () => {
    if (!cancelling) return
    const result = await mutations.setSubstitutionStatus(cancelling.id, 'Cancelled')
    if (!result.ok) {
      toast.error(result.error ?? 'Could not cancel the substitution.')
      setCancelling(null)
      return
    }
    setSubstitutions((current) =>
      current.map((s) => (s.id === cancelling.id ? { ...s, status: 'Cancelled' as const } : s)),
    )
    toast.info('Substitution cancelled. The original faculty is shown again in the timetable.')
    setCancelling(null)
    refresh()
  }

  return (
    <div className="page stagger">
      <div className="page-head">
        <div>
          <h2 className="page-title">Substitution desk</h2>
          <p className="page-sub">
            Assign, edit and cancel cover for the {termConfig.label.toLowerCase()}. Approved substitutions appear
            directly on the timetable and in faculty availability.
          </p>
        </div>
        <div className="page-tools">
          {tab === 'alerts' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setNotifications(notifications.map((n) => ({ ...n, read: true })))
                toast.info('All alerts marked as read.')
              }}
            >
              <Icon name="check" size={16} /> Mark all read
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={16} /> New substitution
          </button>
        </div>
      </div>

      <div className="tab-bar" role="tablist" aria-label="Substitution desk sections">
        <button type="button" role="tab" aria-selected={tab === 'desk'} className={tab === 'desk' ? 'active' : ''} onClick={() => setTab('desk')}>
          <Icon name="users" size={16} /> Substitutions <span className="tab-count">{pendingCount} pending</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'alerts'} className={tab === 'alerts' ? 'active' : ''} onClick={() => setTab('alerts')}>
          <Icon name="info" size={16} /> Alerts <span className="tab-count">{unread} new</span>
        </button>
      </div>

      {tab === 'desk' && (
        <>
          <div className="toolbar">
            <div className="toolbar-left">
              <label className="inline-field">
                <span>Status</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                  <option value="all">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Declined">Declined</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </label>
              <label className="inline-field">
                <span>Faculty</span>
                <select value={facultyFilter} onChange={(e) => setFacultyFilter(e.target.value)}>
                  <option value="all">Any faculty</option>
                  {data.faculty.map((f) => (
                    <option key={f.id} value={f.id}>
                      {shortName(f.name)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="toolbar-right">
              <span className="section-hint">
                {rows.length} of {termSubs.length} records · {termConfig.academicYear}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenTimetable}>
                <Icon name="grid" size={15} /> Open timetable
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="panel empty">
              <span className="empty-icon">
                <Icon name="users" size={22} />
              </span>
              <p className="empty-title">No substitutions for this filter</p>
              <p className="muted">Create a new substitution for the current semester, or clear the filters.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={openCreate}>
                New substitution
              </button>
            </div>
          ) : (
            <div className="sub-grid">
              {rows.map((sub) => {
                const period = PERIODS.find((p) => p.period === sub.period)
                return (
                  <article key={sub.id} className={`sub-card status-${sub.status.toLowerCase()}`}>
                    <div className="sub-head">
                      <div className="sub-flow">
                        <div className="sub-person">
                          <span className="sub-role-label">Original faculty</span>
                          <strong>{sub.facultyName}</strong>
                        </div>
                        <span className="sub-arrow">
                          <Icon name="arrow-right" size={18} />
                        </span>
                        <div className="sub-person">
                          <span className="sub-role-label">Substitute</span>
                          <strong>{sub.substituteFacultyName}</strong>
                        </div>
                      </div>
                      <span className={`sub-status-tag status-${sub.status.toLowerCase()}`}>{sub.status}</span>
                    </div>

                    <div className="sub-meta">
                      <div>
                        <span>Date</span>
                        <strong>{new Date(`${sub.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                      </div>
                      <div>
                        <span>Time period</span>
                        <strong>
                          P{sub.period} · {period?.start}–{period?.end}
                        </strong>
                      </div>
                      <div>
                        <span>Course</span>
                        <strong>{sub.courseCode}</strong>
                      </div>
                      <div>
                        <span>Section &amp; room</span>
                        <strong>
                          {sub.section} · {sub.roomName}
                        </strong>
                      </div>
                    </div>

                    <div className="sub-reason">
                      <strong>Reason:</strong> {sub.reason}
                    </div>

                    <div className="sub-foot">
                      <span className="sub-timestamp">Raised {formatStamp(sub.appliedAt.replace(' ', 'T'))}</span>
                      <div className="sub-decisions">
                        {sub.status === 'Pending' && (
                          <>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void decide(sub.id, 'Declined')}>
                              Decline
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => void decide(sub.id, 'Approved')}>
                              Approve
                            </button>
                          </>
                        )}
                        {sub.status !== 'Cancelled' && (
                          <button type="button" className="link-btn subtle" onClick={() => openEdit(sub)}>
                            Edit
                          </button>
                        )}
                        {sub.status !== 'Cancelled' && (
                          <button type="button" className="link-btn danger" onClick={() => setCancelling(sub)}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'alerts' && (
        <div className="notif-list">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              type="button"
              className={`notif-item${notif.read ? '' : ' unread'}`}
              onClick={() => setNotifications(notifications.map((n) => (n.id === notif.id ? { ...n, read: true } : n)))}
            >
              <span className={`notif-icon type-${notif.type}`}>
                <Icon
                  name={
                    notif.type === 'room'
                      ? 'building'
                      : notif.type === 'substitution'
                        ? 'users'
                        : notif.type === 'schedule'
                          ? 'calendar'
                          : 'info'
                  }
                  size={17}
                />
              </span>
              <span className="notif-body" style={{ minWidth: 0 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <h4>{notif.title}</h4>
                  <span className="muted small">{notif.timestamp}</span>
                </span>
                <p>{notif.message}</p>
                <span className="notif-meta">
                  <span className={`pill pill-${notif.priority === 'high' ? 'red' : notif.priority === 'normal' ? 'ice' : 'green'}`}>
                    {notif.priority} priority
                  </span>
                  <span className="pill">{notif.type}</span>
                  {!notif.read && <span className="pill pill-velvet">New</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? 'Edit substitution' : 'New substitution'}
        description="Choose the affected lecture, then name the faculty member who will cover it."
        width={660}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="sub-form" className="btn btn-primary">
              {editing ? 'Save changes' : 'Create request'}
            </button>
          </>
        }
      >
        <form id="sub-form" className="form" onSubmit={submit} noValidate>
          <label className="field">
            <span>Affected lecture</span>
            <select value={draft.timetableId ?? ''} onChange={(e) => chooseLecture(e.target.value)}>
              {termSlots
                .filter((s) => s.facultyId !== draft.substituteFacultyId)
                .slice(0, 200)
                .map((slot) => {
                  const course = data.courses.find((c) => c.id === slot.courseId)
                  const faculty = data.faculty.find((f) => f.id === slot.facultyId)
                  return (
                    <option key={slot.id} value={slot.id}>
                      {slot.day} P{slot.period} · {course?.code} · {faculty ? shortName(faculty.name) : ''} · {slot.section}
                    </option>
                  )
                })}
            </select>
            <em className="field-hint">
              Timetable entry {draft.timetableId || '—'} · {draft.courseCode} · {draft.day} P{draft.period}
            </em>
          </label>

          <div className="form-row form-row-2">
            <label className="field">
              <span>Original faculty</span>
              <input value={data.faculty.find((f) => f.id === draft.facultyId)?.name ?? draft.facultyName} readOnly />
            </label>
            <label className="field">
              <span>Substitute faculty</span>
              <select
                value={draft.substituteFacultyId}
                onChange={(e) => {
                  const f = data.faculty.find((x) => x.id === e.target.value)
                  setDraft({ ...draft, substituteFacultyId: e.target.value, substituteFacultyName: f?.name ?? '' })
                  setError('')
                }}
              >
                <option value="">Select faculty</option>
                {data.faculty
                  .filter((f) => f.id !== draft.facultyId)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} · {f.department} · {f.status}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <div className="form-row form-row-3">
            <label className="field">
              <span>Date</span>
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </label>
            <label className="field">
              <span>Day</span>
              <input value={draft.day} readOnly />
            </label>
            <label className="field">
              <span>Period</span>
              <input value={`P${draft.period} · ${PERIODS.find((p) => p.period === draft.period)?.label}`} readOnly />
            </label>
          </div>

          <label className="field">
            <span>Reason</span>
            <textarea
              rows={3}
              placeholder="e.g. Attending an IEEE conference or approved medical leave."
              value={draft.reason}
              onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as SubstitutionRequest['status'] })}
            >
              <option value="Pending">Pending review</option>
              <option value="Approved">Approved</option>
              <option value="Declined">Declined</option>
            </select>
          </label>

          {error && (
            <div className="notice" role="alert" style={{ borderColor: 'var(--red-border)', background: 'var(--red-soft)', color: 'var(--red)' }}>
              <Icon name="warning" size={16} />
              <span>{error}</span>
            </div>
          )}

          <p className="field-hint">
            Demo rule: an approved substitute cannot be assigned to two lectures in the same date and period. Sample term
            runs {SAMPLE_TERMS[activeTerm].startDate} to {SAMPLE_TERMS[activeTerm].endDate}.
          </p>
        </form>
      </Modal>

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this substitution?"
        message={
          cancelling
            ? `${cancelling.substituteFacultyName} will no longer cover ${cancelling.courseCode} for ${cancelling.facultyName} on ${cancelling.date}. The timetable will show the original faculty again.`
            : ''
        }
        confirmLabel="Cancel substitution"
        onCancel={() => setCancelling(null)}
        onConfirm={() => void cancelSub()}
      />
    </div>
  )
}
