import { useMemo } from 'react'
import { DAY_NAMES, PERIODS, SECTIONS } from '../data/seed'
import { TERM_OPTIONS } from '../data/terms'
import { facultyLoad, formatDate, formatStamp, periodLabel, shortName, todayKey, weeklyStats } from '../lib/timetable'
import type { AppStore } from '../state/useAppData'
import type { Day, Slot } from '../types'
import type { Page } from '../types-ui'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { MiniWeek } from '../components/MiniWeek'
import { TermSwitch } from '../components/TermSwitch'

interface DashboardProps {
  store: AppStore
  section: string
  onSection: (section: string) => void
  onNavigate: (page: Page) => void
  onAdd: () => void
  onEdit: (slot: Slot) => void
  onViewSchedule: (day: string) => void
  lastSaved?: { id: string; lastSavedAt: number } | null
}

function formatRange(start: string, end: string) {
  const f = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${f(start)} – ${f(end)}`
}

export function Dashboard({ store, section, onSection, onNavigate, onAdd, onEdit, onViewSchedule }: DashboardProps) {
  const { user, role } = useAuth()
  const { data, activeTerm, termConfig, setTerm, substitutions } = store
  const today = todayKey()

  const week = useMemo(() => weeklyStats(data, section, store.settings), [data, section, store.settings])
  const todaySlots = week.rows.find((r) => r.day === today)?.slots ?? []
  const activeCourses = week.courses

  const facultyTeaching = new Set(todaySlots.map((s) => s.facultyId)).size
  const onLeave = data.faculty.filter((f) => f.status === 'On leave')
  const byAllotment = data.faculty
    .map((f) => ({ faculty: f, ...facultyLoad(data, f, activeTerm) }))
    .sort((a, b) => b.hours - a.hours || b.pct - a.pct)
  const nearLimit = byAllotment.filter((row) => row.pct >= 85).length

  const roomUse = data.rooms
    .map((room) => ({ room, used: todaySlots.filter((s) => s.roomId === room.id).length }))
    .filter((r) => r.used > 0)
    .sort((a, b) => b.used - a.used)
  const freeRooms = data.rooms.length - roomUse.length

  const todayCourses = todaySlots.map((slot) => ({
    slot,
    course: data.courses.find((c) => c.id === slot.courseId),
    faculty: data.faculty.find((f) => f.id === slot.facultyId),
    room: data.rooms.find((r) => r.id === slot.roomId),
  }))

  // Upcoming: the next lectures after now, rolling into the following days.
  const upcoming = useMemo(() => {
    const now = new Date()
    const minutes = now.getHours() * 60 + now.getMinutes()
    const startIndex = Math.max(0, week.days.indexOf(today))
    const ordered: Day[] = [...week.days.slice(startIndex), ...week.days.slice(0, startIndex)]
    const list: { day: Day; slot: Slot }[] = []
    for (const day of ordered) {
      for (const slot of data.slots
        .filter((s) => s.section === section && s.day === day && (s.term ?? 'odd') === activeTerm)
        .sort((a, b) => a.period - b.period)) {
        if (day === today) {
          const end = PERIODS.find((p) => p.period === slot.period)?.end ?? '00:00'
          const [h, m] = end.split(':').map(Number)
          if (h * 60 + m <= minutes) continue
        }
        list.push({ day, slot })
        if (list.length === 3) return list
      }
    }
    return list
  }, [data.slots, section, today, week.days, activeTerm])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const pendingSubs = substitutions.filter((s) => s.status === 'Pending').length

  return (
    <div className="page dashboard stagger">
      <section className="dashboard-hero" aria-labelledby="dash-title">
        <div className="hero-copy">
          <div className="hero-kicker">
            <span className="badge-velvet">{role} view</span>
            <span>{formatDate()}</span>
          </div>

          <h2 id="dash-title" className="hero-title">
            {greeting}, {user?.name.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*/, '').split(' ')[0] || 'User'}
          </h2>
          <p className="hero-sub">
            Section <strong>{section}</strong>{' '}
            {todaySlots.length > 0 ? (
              <>
                has <strong>{todaySlots.length} lecture{todaySlots.length === 1 ? '' : 's'}</strong> scheduled today, the
                first at {periodLabel(todaySlots[0].period).slice(0, 5)}.
              </>
            ) : (
              <>has no lectures scheduled today.</>
            )}{' '}
            {freeRooms} of {data.rooms.length} rooms are free all day
            {onLeave.length > 0 ? `, and ${shortName(onLeave[0].name)} is on leave.` : '.'}
          </p>

          <div className="hero-stats" aria-live="polite">
            <div className="hero-stat">
              <strong className="mono">{String(week.todayCount).padStart(2, '0')}</strong>
              <span>periods today</span>
            </div>
            <div className="hero-stat">
              <strong className="mono">{freeRooms}</strong>
              <span>rooms free</span>
            </div>
            <div className="hero-stat">
              <strong className="mono">{week.total}</strong>
              <span>weekly periods</span>
            </div>
          </div>

          <div className="hero-actions">
            <label className="inline-field">
              <span>Section</span>
              <select value={section} onChange={(e) => onSection(e.target.value)} aria-label="Timetable section">
                {SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-primary" onClick={onAdd}>
              <Icon name="plus" size={16} /> Schedule lecture
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => onNavigate('timetable')}>
              <Icon name="grid" size={15} /> Open timetable
            </button>
          </div>
        </div>

        <div className="hero-term" aria-label="Semester selection">
          <div>
            <h3>Semester timetable</h3>
            <p className="muted small">Each semester keeps its own schedule, courses and calendar.</p>
          </div>
          <TermSwitch value={activeTerm} onChange={setTerm} />
          <div className="term-meta">
            <span>
              <Icon name="calendar" size={15} />
              <strong>{termConfig.label}</strong>
            </span>
            <span>
              <Icon name="clock" size={15} /> {formatRange(termConfig.startDate, termConfig.endDate)}
            </span>
          </div>
          <p className="muted small" style={{ lineHeight: 1.5 }}>
            {TERM_OPTIONS.find((t) => t.key === activeTerm)?.description} · academic year {termConfig.academicYear}.
            Dates are editable sample values in Settings.
          </p>
        </div>
      </section>

      <section className="stats" aria-label="Timetable summary">
        <div className="stat">
          <p className="stat-label">Lectures today</p>
          <p className="stat-value">
            {todaySlots.length}
            <span className="stat-unit">of {PERIODS.length} periods</span>
          </p>
          <p className="stat-note">
            {todaySlots.length > 0
              ? `First at ${periodLabel(todaySlots[0].period).slice(0, 5)}`
              : 'No lectures scheduled today'}
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">{activeTerm === 'odd' ? 'Odd' : 'Even'} semester periods</p>
          <p className="stat-value">
            {week.total}
            <span className="stat-unit">allocated</span>
          </p>
          <p className="stat-note">
            {activeCourses.length} course{activeCourses.length === 1 ? '' : 's'} in section {section}
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">Faculty teaching today</p>
          <p className="stat-value">
            {facultyTeaching}
            <span className="stat-unit">of {data.faculty.filter((f) => f.status === 'Active').length} active</span>
          </p>
          <p className="stat-note">
            {onLeave.length} on leave · {pendingSubs} substitution{pendingSubs === 1 ? '' : 's'} pending
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">Rooms in use</p>
          <p className="stat-value">
            {roomUse.length}
            <span className="stat-unit">today</span>
          </p>
          <p className="stat-note">{freeRooms} rooms free all day</p>
        </div>
      </section>

      <div className="dash-grid">
        <div className="dash-main">
          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Today&apos;s schedule</h3>
                <p>
                  {DAY_NAMES[today]}, section {section}
                </p>
              </div>
              <button type="button" className="link-btn" onClick={() => onNavigate('timetable')}>
                Open timetable <Icon name="arrow-right" size={15} />
              </button>
            </header>

            {todayCourses.length === 0 ? (
              <div className="empty compact">
                <span className="empty-icon">
                  <Icon name="calendar" size={22} />
                </span>
                <p className="empty-title">No lectures scheduled for this slot</p>
                <p className="muted">
                  Nothing is allotted to {section} today. You can add a lecture from the weekly timetable.
                </p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onAdd}>
                  Schedule a lecture
                </button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Period</th>
                      <th scope="col">Course</th>
                      <th scope="col">Faculty</th>
                      <th scope="col">Room</th>
                      <th scope="col" className="ta-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayCourses.map(({ slot, course, faculty, room }) => (
                      <tr key={slot.id}>
                        <td className="nowrap">
                          <span className="period-chip">P{slot.period}</span>
                          <span className="cell-sub mono">{periodLabel(slot.period)}</span>
                        </td>
                        <td>
                          <span className="strong">{course?.code}</span>
                          <span className="cell-sub">{course?.title}</span>
                        </td>
                        <td>{faculty ? shortName(faculty.name) : '—'}</td>
                        <td>
                          <span className="room-tag">{room?.name ?? '—'}</span>
                        </td>
                        <td className="ta-right">
                          <button type="button" className="link-btn subtle" onClick={() => onEdit(slot)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <footer className="panel-foot">
              <span>{todayCourses.length} scheduled periods · lunch break 13:15 – 14:00</span>
            </footer>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Week at a glance</h3>
                <p>Periods allotted per day for {section}</p>
              </div>
              <button type="button" className="link-btn" onClick={() => onNavigate('timetable')}>
                Weekly timetable <Icon name="arrow-right" size={15} />
              </button>
            </header>
            <div className="week-strip">
              {week.rows.map(({ day, count }) => (
                <button
                  key={day}
                  type="button"
                  className={`week-day${day === today ? ' is-today' : ''}`}
                  onClick={() => onViewSchedule(day)}
                  title={`Open ${DAY_NAMES[day]} schedule`}
                >
                  <span className="week-day-name">{DAY_NAMES[day]}</span>
                  <span className="week-day-track">
                    <span className="week-day-fill" style={{ width: `${Math.max(4, (count / week.busiest) * 100)}%` }} />
                  </span>
                  <span className="week-day-count">
                    {count} / {PERIODS.length}
                    {day === today && <span className="week-day-tag">today</span>}
                  </span>
                </button>
              ))}
            </div>
            <div className="week-strip-note">
              <MiniWeek data={data} section={section} days={week.days} periods={PERIODS.length} today={today} />
              <p>
                <strong>{week.total}</strong> of {PERIODS.length * week.days.length} weekly periods allotted to{' '}
                {section}. Click a day to open its schedule.
              </p>
            </div>
          </section>
        </div>

        <div className="dash-side">
          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Upcoming periods</h3>
                <p>Next lectures for {section}</p>
              </div>
            </header>
            {upcoming.length === 0 ? (
              <p className="panel-empty">Nothing further is scheduled this week.</p>
            ) : (
              <ul className="upcoming-list">
                {upcoming.map(({ day, slot }) => {
                  const course = data.courses.find((c) => c.id === slot.courseId)
                  const faculty = data.faculty.find((f) => f.id === slot.facultyId)
                  const room = data.rooms.find((r) => r.id === slot.roomId)
                  const period = PERIODS.find((p) => p.period === slot.period)
                  const sub = substitutions.find(
                    (s) =>
                      s.status === 'Approved' &&
                      (s.timetableId === slot.id ||
                        (s.facultyId === slot.facultyId && s.day === day && s.period === slot.period)),
                  )
                  return (
                    <li key={slot.id} className="upcoming-item">
                      <span className="upcoming-when">
                        <strong>{day === today ? 'Today' : DAY_NAMES[day]}</strong>
                        <small className="mono">
                          {period?.start}–{period?.end}
                        </small>
                      </span>
                      <span className="upcoming-what">
                        <strong>
                          {course?.code} · {course?.title}
                        </strong>
                        <span className="upcoming-meta">
                          <span>
                            <Icon name="users" size={14} />
                            {sub
                              ? shortName(sub.substituteFacultyName)
                              : faculty
                                ? shortName(faculty.name)
                                : 'Unassigned'}
                          </span>
                          <span>
                            <Icon name="building" size={14} />
                            Room {room?.name ?? '—'}
                          </span>
                        </span>
                      </span>
                      <span className="upcoming-side">
                        <span className="pill pill-ice">P{slot.period}</span>
                        {sub ? (
                          <span className="pill pill-velvet">Substituted</span>
                        ) : faculty?.status === 'On leave' ? (
                          <span className="pill pill-amber">On leave</span>
                        ) : null}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            <footer className="panel-foot">
              <button type="button" className="link-btn subtle" onClick={() => onNavigate('leaves')}>
                Substitution desk
              </button>
              <span className="muted">Room C-112</span>
            </footer>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Faculty workload</h3>
                <p>
                  Periods this week against the weekly maximum
                  {nearLimit > 0 ? ` · ${nearLimit} nearing the limit` : ''}
                </p>
              </div>
            </header>
            {byAllotment.length === 0 ? (
              <p className="panel-empty">No faculty have been allotted periods yet.</p>
            ) : (
              <ul className="load-list">
                {byAllotment.slice(0, 5).map(({ faculty, hours: used, pct }) => (
                  <li key={faculty.id}>
                    <div className="load-top">
                      <span className="avatar avatar-xs">{faculty.initials}</span>
                      <span className="load-name">{shortName(faculty.name)}</span>
                      <span className="mono load-count">
                        {used}/{faculty.maxHours}
                      </span>
                    </div>
                    <div className={`meter${pct >= 100 ? ' meter-red' : pct >= 90 ? ' meter-amber' : ''}`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <footer className="panel-foot">
              <button type="button" className="link-btn subtle" onClick={() => onNavigate('workload')}>
                Full workload report
              </button>
            </footer>
          </section>

          <section className="panel">
            <header className="panel-head">
              <div>
                <h3>Recent timetable updates</h3>
                <p>Audit trail of the last changes</p>
              </div>
            </header>
            <ul className="activity">
              {data.log.slice(0, 4).map((entry) => (
                <li key={entry.id}>
                  <span className={`dot dot-${entry.action}`} aria-hidden="true" />
                  <div>
                    <p className="activity-title">{entry.summary}</p>
                    <p className="activity-detail">{entry.detail}</p>
                    <p className="activity-meta">
                      {entry.actor} · {formatStamp(entry.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
