import { useMemo, useState } from 'react'
import type { AppStore } from '../state/useAppData'
import type { AcademicCalendarEvent, TermKey } from '../types'
import { Icon } from '../components/Icon'
import { ConfirmDialog, Modal } from '../components/Modal'
import { TermSwitch } from '../components/TermSwitch'
import { useToast } from '../components/Toast'
import {
  addDays,
  dateKey as iso,
  dayCount,
  formatRange,
  parseDateKey as parse,
  startOfWeek,
} from '../lib/datetime'

const CATEGORIES: AcademicCalendarEvent['category'][] = [
  'Exam',
  'Holiday',
  'Seminar',
  'Workshop',
  'Academic Milestone',
]

const CATEGORY_LABELS: Record<AcademicCalendarEvent['category'], string> = {
  Exam: 'Examination',
  Holiday: 'Holiday',
  Seminar: 'Seminar',
  Workshop: 'Workshop',
  'Academic Milestone': 'Milestone',
}

const catClass = (c: AcademicCalendarEvent['category']) => `cat-${c.toLowerCase().replace(/\s+/g, '-')}`

// Dates use the shared local-time helpers in lib/datetime.ts so a `YYYY-MM-DD`
// value is never shifted by a UTC parse (which moved events a day in IST).
const fmt = (s: string, opts?: Intl.DateTimeFormatOptions) =>
  parse(s).toLocaleDateString('en-GB', opts ?? { day: 'numeric', month: 'short', year: 'numeric' })

/** Does the event touch the given day? */
function occursOn(ev: AcademicCalendarEvent, day: string) {
  if (!ev.endDate) return ev.date === day
  return ev.date <= day && day <= ev.endDate
}

/** `day 2/6` inside a multi-day event, or null for a single-day event. */
function dayPosition(ev: AcademicCalendarEvent, day: string) {
  const total = dayCount(ev.date, ev.endDate)
  if (total <= 1) return null
  const offset = Math.round((parse(day).getTime() - parse(ev.date).getTime()) / 86_400_000)
  return `day ${Math.min(total, Math.max(1, offset + 1))}/${total}`
}

/** Events must stay inside the semester window configured in Settings. */
function outsideTerm(ev: AcademicCalendarEvent, start: string, end: string) {
  return ev.date < start || (ev.endDate ?? ev.date) > end
}

/** Events belonging to the selected semester (legacy events without a term stay visible). */
function inTerm(ev: AcademicCalendarEvent, term: TermKey) {
  return !ev.term || ev.term === term
}

export function AcademicCalendarPage({ store }: { store: AppStore }) {
  const toast = useToast()
  const { calendarEvents: events, setCalendarEvents, activeTerm, setTerm, termConfig } = store
  const [view, setView] = useState<'month' | 'week' | 'agenda'>('month')
  const [cursor, setCursor] = useState(() => parse(termConfig.startDate))
  const [category, setCategory] = useState<'all' | AcademicCalendarEvent['category']>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<AcademicCalendarEvent>({
    id: '',
    title: '',
    date: termConfig.startDate,
    category: 'Seminar',
    description: '',
    location: '',
    term: activeTerm,
  })
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<AcademicCalendarEvent | null>(null)
  const [deleting, setDeleting] = useState<AcademicCalendarEvent | null>(null)

  const visibleEvents = useMemo(
    () =>
      events
        .filter((e) => inTerm(e, activeTerm))
        .filter((e) => category === 'all' || e.category === category)
        // Start date first; multi-day events of the same start keep their order.
        .sort((a, b) => a.date.localeCompare(b.date) || (a.endDate ?? a.date).localeCompare(b.endDate ?? b.date)),
    [events, activeTerm, category],
  )

  const todayIso = iso(new Date())
  // "Today" only highlights a cell while the visible period actually contains today.
  const todayInMonth = todayIso.slice(0, 7) === iso(cursor).slice(0, 7)

  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const weekStart = startOfWeek(cursor)
  const weekLabel =
    weekStart.getFullYear() === addDays(weekStart, 6).getFullYear()
      ? `${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${addDays(weekStart, 6).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : `${fmt(iso(weekStart))} – ${fmt(iso(addDays(weekStart, 6)))}`

  const monthCells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const gridStart = addDays(first, -((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, i) => {
      const d = addDays(gridStart, i)
      return { date: d, key: iso(d), outside: d.getMonth() !== cursor.getMonth() }
    })
  }, [cursor])

  const openCreate = (date?: string) => {
    setEditingId(null)
    setDraft({
      id: '',
      title: '',
      date: date ?? iso(cursor),
      endDate: undefined,
      category: 'Seminar',
      description: '',
      location: '',
      startTime: '',
      endTime: '',
      term: activeTerm,
    })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (ev: AcademicCalendarEvent) => {
    setEditingId(ev.id)
    setDraft({ ...ev })
    setError('')
    setDetail(null)
    setDialogOpen(true)
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (draft.title.trim().length < 3) {
      setError('Give the event a clear title of at least 3 characters.')
      return
    }
    if (draft.endDate && draft.endDate < draft.date) {
      setError('The end date cannot be before the start date.')
      return
    }
    if (draft.endDate === draft.date) {
      setError('A multi-day event needs an end date later than the start date. Leave the end date empty for a single day.')
      return
    }
    if (outsideTerm(draft, termConfig.startDate, termConfig.endDate)) {
      setError(
        `${termConfig.label} runs ${fmt(termConfig.startDate)} to ${fmt(termConfig.endDate)}. Move the event inside that window or change the term dates in Settings.`,
      )
      return
    }
    if (draft.startTime && draft.endTime && draft.endTime <= draft.startTime) {
      setError('The end time must be later than the start time.')
      return
    }
    if (!draft.description.trim()) {
      setError('Add a short description so students know what to expect.')
      return
    }
    const payload: AcademicCalendarEvent = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      location: draft.location?.trim(),
      term: activeTerm,
    }
    if (editingId) {
      setCalendarEvents(events.map((ev) => (ev.id === editingId ? payload : ev)))
      toast.success('Calendar event updated.')
    } else {
      setCalendarEvents([{ ...payload, id: `cal-${Date.now().toString(36)}` }, ...events])
      toast.success('Event added to the academic calendar.')
    }
    // Jump to the month the event belongs to so it is visible straight away.
    if (payload.date.slice(0, 7) !== iso(cursor).slice(0, 7)) setCursor(parse(payload.date))
    setDialogOpen(false)
  }

  const remove = () => {
    if (!deleting) return
    setCalendarEvents(events.filter((ev) => ev.id !== deleting.id))
    toast.info('Event removed from the calendar.')
    setDeleting(null)
    setDetail(null)
  }

  const step = (direction: -1 | 1) => {
    if (view === 'month') setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1))
    else if (view === 'week') setCursor(addDays(cursor, 7 * direction))
    else setCursor(addDays(cursor, 30 * direction))
  }

  const upcoming = visibleEvents.filter((ev) => (ev.endDate ?? ev.date) >= todayIso).slice(0, 3)
  // A range is flagged when it starts before or ends after the configured term.
  const termWindow = `Term runs ${fmt(termConfig.startDate)} – ${fmt(termConfig.endDate)}`

  return (
    <div className="page stagger">
      <div className="page-head">
        <div>
          <h2 className="page-title">Academic calendar</h2>
          <p className="page-sub">
            {termConfig.label} {termConfig.academicYear} · {fmt(termConfig.startDate)} to {fmt(termConfig.endDate)}.
            Examinations, holidays, seminars, workshops and academic milestones in one place.
          </p>
        </div>
        <div className="page-tools">
          <TermSwitch
            value={activeTerm}
            onChange={(term) => {
              setTerm(term)
              setCursor(parse(store.terms[term].startDate))
            }}
            compact
          />
        </div>
      </div>

      <div className="cal-shell">
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button type="button" className="cal-nav-btn" onClick={() => step(-1)} aria-label="Previous month or week">
              <Icon name="chevron-left" size={17} />
            </button>
            <button
              type="button"
              className="cal-nav-btn"
              onClick={() => setCursor(new Date())}
              aria-label="Go to today"
              title="Today"
            >
              <Icon name="calendar" size={16} />
            </button>
            <button type="button" className="cal-nav-btn" onClick={() => step(1)} aria-label="Next month or week">
              <Icon name="chevron-right" size={17} />
            </button>
          </div>
          <h3>{view === 'week' ? weekLabel : monthLabel}</h3>

          <div className="cal-toolbar-right">
            <label className="inline-field">
              <span className="sr-only">Category</span>
              <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <div className="seg" role="group" aria-label="Calendar view">
              {(['month', 'week', 'agenda'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={view === v ? 'active' : ''}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v === 'month' ? 'Month' : v === 'week' ? 'Week' : 'Agenda'}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openCreate()}>
              <Icon name="plus" size={15} /> Add event
            </button>
          </div>
        </div>

        {view === 'month' && (
          <div role="grid" aria-label={`${monthLabel} calendar`}>
            <div className="cal-weekdays" role="row">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <span key={d} role="columnheader">
                  {d}
                </span>
              ))}
            </div>
            <div className="cal-month">
              {monthCells.map((cell) => {
                const dayEvents = visibleEvents.filter((ev) => occursOn(ev, cell.key))
                return (
                  <div
                    key={cell.key}
                    className={`cal-cell${cell.outside ? ' is-outside' : ''}${cell.key === todayIso && todayInMonth ? ' is-today' : ''}`}
                    role="gridcell"
                    aria-label={fmt(cell.key, { weekday: 'long', day: 'numeric', month: 'long' })}
                  >
                    <div className="cal-day">
                      <span className="cal-day-num">{cell.date.getDate()}</span>
                      <button
                        type="button"
                        className="cal-add"
                        onClick={() => openCreate(cell.key)}
                        aria-label={`Add event on ${fmt(cell.key)}`}
                        title="Add event"
                      >
                        <Icon name="plus" size={13} />
                      </button>
                    </div>
                    {dayEvents.slice(0, 3).map((ev) => {
                      const span = dayPosition(ev, cell.key)
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          className={`cal-event ${catClass(ev.category)}`}
                          onClick={() => setDetail(ev)}
                          title={`${ev.title} · ${CATEGORY_LABELS[ev.category]} · ${formatRange(ev.date, ev.endDate)}`}
                        >
                          {ev.title}
                          {span && <span className="cal-event-span"> · {span}</span>}
                        </button>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <button type="button" className="cal-more" onClick={() => setView('agenda')}>
                        +{dayEvents.length - 3} more
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {view === 'week' && (
          <div className="cal-week">
            <div className="cal-week-head">
              <div />
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(weekStart, i)
                return (
                  <div key={i} className={iso(d) === todayIso ? 'is-today' : undefined}>
                    {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                    <span>{d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                )
              })}
            </div>
            {visibleEvents.filter((ev) => {
              const from = iso(weekStart)
              const to = iso(addDays(weekStart, 6))
              return ev.date <= to && (ev.endDate ?? ev.date) >= from
            }).length === 0 ? (
              <div className="empty compact">
                <p className="empty-title">Nothing scheduled this week</p>
                <p className="muted">Use “Add event” to schedule a seminar, workshop or examination.</p>
              </div>
            ) : (
              <div className="cal-week-row" style={{ display: 'grid', gridTemplateColumns: '92px repeat(7, minmax(0, 1fr))' }}>
                <div className="cal-week-time">All day</div>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(weekStart, i)
                  const k = iso(d)
                  const dayEvents = visibleEvents.filter((ev) => occursOn(ev, k))
                  return (
                    <div key={k} className={`cal-week-day${k === todayIso ? ' is-today' : ''}`}>
                      {dayEvents.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          className={`cal-event ${catClass(ev.category)}`}
                          style={{ marginBottom: 4 }}
                          onClick={() => setDetail(ev)}
                          title={`${ev.title} · ${formatRange(ev.date, ev.endDate)}`}
                        >
                          {ev.startTime && <span className="mono">{ev.startTime} </span>}
                          {ev.title}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {view === 'agenda' && (
          <div className="cal-agenda">
            {visibleEvents.length === 0 ? (
              <div className="empty">
                <p className="empty-title">No events for this semester and category</p>
                <p className="muted">Adjust the category filter or add a new event.</p>
              </div>
            ) : (
              Object.entries(
                visibleEvents.reduce<Record<string, AcademicCalendarEvent[]>>((acc, ev) => {
                  // Group by the month an event starts in.
                  const key = fmt(ev.date, { month: 'long', year: 'numeric' })
                  acc[key] = acc[key] ? [...acc[key], ev] : [ev]
                  return acc
                }, {}),
              ).map(([month, monthEvents]) => (
                <section key={month} className="cal-agenda-group">
                  <h4>{month}</h4>
                  {monthEvents.map((ev) => (
                    <button key={ev.id} type="button" className="cal-agenda-item" onClick={() => setDetail(ev)}>
                      <span className={`cal-agenda-dot ${catClass(ev.category)}`} />
                      <span style={{ minWidth: 0 }}>
                        <h5>{ev.title}</h5>
                        <p>
                          <time dateTime={ev.date}>{formatRange(ev.date, ev.endDate)}</time>
                          {dayCount(ev.date, ev.endDate) > 1 ? ` · ${dayCount(ev.date, ev.endDate)} days` : ''}
                          {ev.startTime ? ` · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}` : ''}
                          {ev.location ? ` · ${ev.location}` : ''}
                        </p>
                      </span>
                      <span className={`cat-chip ${catClass(ev.category)}`}>{CATEGORY_LABELS[ev.category]}</span>
                    </button>
                  ))}
                </section>
              ))
            )}
          </div>
        )}

        <div className="cal-legend">
          {CATEGORIES.map((c) => (
            <span key={c}>
              <i className={catClass(c)} style={{ background: c === 'Exam' ? '#c2543f' : c === 'Holiday' ? '#2c8a5c' : c === 'Seminar' ? '#2c74a8' : c === 'Workshop' ? '#7556b8' : '#b0741d' }} />
              {CATEGORY_LABELS[c]}
            </span>
          ))}
          <span style={{ marginLeft: 'auto' }}>
            {visibleEvents.length} events · {termConfig.label} {termConfig.academicYear}
          </span>
        </div>
      </div>

      {upcoming.length > 0 && (
        <section className="panel">
          <header className="panel-head">
            <div>
              <h3>Coming up</h3>
              <p>Next events in the {termConfig.label.toLowerCase()}</p>
            </div>
          </header>
          <div className="free-grid">
            {upcoming.map((ev) => (
              <button key={ev.id} type="button" className="free-card" style={{ textAlign: 'left' }} onClick={() => setDetail(ev)}>
                <span className="free-card-top">
                  <span className={`pill pill-${ev.category === 'Exam' ? 'red' : ev.category === 'Holiday' ? 'green' : 'ice'}`}>
                    {CATEGORY_LABELS[ev.category]}
                  </span>
                  <strong style={{ marginLeft: 'auto', fontWeight: 600 }}>{formatRange(ev.date, ev.endDate)}</strong>
                </span>
                <strong style={{ fontSize: 15.5 }}>{ev.title}</strong>
                <span className="free-meta">
                  {ev.endDate && ev.endDate > ev.date ? `${dayCount(ev.date, ev.endDate)} days` : 'Single day'}
                  {ev.location ? ` · ${ev.location}` : ''}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Event details */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.title ?? 'Event'}
        width={540}
        footer={
          detail ? (
            <>
              <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setDeleting(detail)}>
                <Icon name="trash" size={15} /> Delete
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetail(null)}>
                Close
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => openEdit(detail)}>
                <Icon name="edit" size={15} /> Edit event
              </button>
            </>
          ) : undefined
        }
      >
        {detail && (
          <div className="event-detail-list">
            <span className={`cat-chip ${catClass(detail.category)}`} style={{ alignSelf: 'flex-start' }}>
              {CATEGORY_LABELS[detail.category]}
            </span>
            <div>
              <span>Dates</span>
              <strong>
                {formatRange(detail.date, detail.endDate)}
                {dayCount(detail.date, detail.endDate) > 1 ? ` (${dayCount(detail.date, detail.endDate)} days)` : ''}
              </strong>
            </div>
            {(detail.startTime || detail.endTime) && (
              <div>
                <span>Time</span>
                <strong>
                  {detail.startTime || '—'}
                  {detail.endTime ? ` – ${detail.endTime}` : ''}
                </strong>
              </div>
            )}
            {detail.location && (
              <div>
                <span>Venue</span>
                <strong>{detail.location}</strong>
              </div>
            )}
            <div>
              <span>Semester</span>
              <strong>{detail.term === 'even' ? 'Even' : detail.term === 'odd' ? 'Odd' : 'All year'}</strong>
            </div>
            <div>
              <span>Description</span>
              <strong style={{ fontWeight: 400, color: 'var(--text-muted)', lineHeight: 1.55 }}>{detail.description}</strong>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / edit form */}
      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingId ? 'Edit calendar event' : 'Add calendar event'}
        description={`Published in the ${termConfig.label.toLowerCase()} calendar for ${termConfig.academicYear}.`}
        width={560}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="event-form" className="btn btn-primary">
              {editingId ? 'Save changes' : 'Add event'}
            </button>
          </>
        }
      >
        <form id="event-form" className="form" onSubmit={save} noValidate>
          <label className="field">
            <span>Event title</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g. ACM student research symposium"
            />
          </label>

          <div className="form-row form-row-2">
            <label className="field">
              <span>Category</span>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as AcademicCalendarEvent['category'] })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Venue</span>
              <input
                value={draft.location ?? ''}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Auditorium, lab or hall"
              />
            </label>
          </div>

          <div className="form-row form-row-2">
            <label className="field">
              <span>Start date</span>
              <input
                type="date"
                value={draft.date}
                min={termConfig.startDate}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </label>
            <label className="field">
              <span>End date (optional)</span>
              <input
                type="date"
                value={draft.endDate ?? ''}
                min={draft.date}
                max={termConfig.endDate}
                onChange={(e) => setDraft({ ...draft, endDate: e.target.value || undefined })}
              />
            </label>
          </div>

          <div className="form-row form-row-2">
            <label className="field">
              <span>Start time (optional)</span>
              <input
                type="time"
                value={draft.startTime ?? ''}
                onChange={(e) => setDraft({ ...draft, startTime: e.target.value || undefined })}
              />
            </label>
            <label className="field">
              <span>End time (optional)</span>
              <input
                type="time"
                value={draft.endTime ?? ''}
                onChange={(e) => setDraft({ ...draft, endTime: e.target.value || undefined })}
              />
            </label>
          </div>

          <label className="field">
            <span>Description</span>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What happens, who should attend and any preparation required."
            />
          </label>

          <p className="field-hint" style={{ marginTop: -4 }}>
            {termWindow}. Leave the end date empty for a single-day event.
            {draft.endDate && draft.endDate > draft.date
              ? ` Selected range: ${formatRange(draft.date, draft.endDate)} (${dayCount(draft.date, draft.endDate)} days).`
              : ''}
          </p>

          {error && (
            <div
              className="notice"
              role="alert"
              style={{ borderColor: 'var(--red-border)', background: 'var(--red-soft)', color: 'var(--red)' }}
            >
              <Icon name="warning" size={16} />
              <span>{error}</span>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete this event?"
        message={deleting ? `“${deleting.title}” will be removed from the academic calendar.` : ''}
        confirmLabel="Delete event"
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </div>
  )
}
