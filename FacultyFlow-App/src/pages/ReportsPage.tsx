import { useMemo, useState } from 'react'
import { DAY_NAMES, PERIODS } from '../data/seed'
import { detectConflicts, facultyLoad, periodLabel, shortName } from '../lib/timetable'
import type { AppStore } from '../state/useAppData'
import { Icon } from '../components/Icon'

interface ReportsPageProps {
  store: AppStore
  onFix: (slotId: string) => void
  onNavigateTimetable: () => void
}

type Tab = 'conflicts' | 'workload'

export function ReportsPage({ store, onFix, onNavigateTimetable }: ReportsPageProps) {
  const { data, settings } = store
  const [tab, setTab] = useState<Tab>('conflicts')

  const audit = useMemo(() => {
    const seen = new Set<string>()
    const list: { slotId: string; course: string; when: string; message: string }[] = []
    for (const slot of data.slots) {
      const issues = detectConflicts(data, slot, settings, slot.id)
      for (const issue of issues) {
        const key = `${slot.id}-${issue.message}`
        if (seen.has(key)) continue
        seen.add(key)
        const course = data.courses.find((c) => c.id === slot.courseId)
        list.push({
          slotId: slot.id,
          course: `${course?.code ?? '—'} · ${slot.section}`,
          when: `${DAY_NAMES[slot.day]} ${periodLabel(slot.period)}`,
          message: issue.message,
        })
      }
    }
    return list
  }, [data, settings])

  const shortfalls = data.courses
    .map((course) => {
      const courseSlots = data.slots.filter((s) => s.courseId === course.id)
      const scheduled = courseSlots.length
      const sections = new Set(courseSlots.map((s) => s.section))
      return { course, scheduled, gap: course.weeklyHours - scheduled, sections: sections.size, touched: scheduled > 0 }
    })
    // Only report courses that are actually part of this term's timetable.
    .filter((row) => row.touched && row.gap > 0)

  const workload = data.faculty
    .map((faculty) => {
      const load = facultyLoad(data, faculty)
      const days = new Set(data.slots.filter((s) => s.facultyId === faculty.id).map((s) => s.day)).size
      return { faculty, ...load, days }
    })
    .sort((a, b) => b.hours - a.hours)

  const maxHours = Math.max(1, ...workload.map((w) => w.hours))

  const roomUsage = data.rooms
    .map((room) => ({ room, used: data.slots.filter((s) => s.roomId === room.id).length }))
    .sort((a, b) => b.used - a.used)

  const occupancy = Math.round((data.slots.length * 100) / Math.max(1, data.rooms.length * PERIODS.length * 5))

  const exportCsv = () => {
    const header = 'Day,Period,Course,Faculty,Room,Section\n'
    const rows = data.slots
      .map((slot) => {
        const course = data.courses.find((c) => c.id === slot.courseId)
        const faculty = data.faculty.find((f) => f.id === slot.facultyId)
        const room = data.rooms.find((r) => r.id === slot.roomId)
        return [DAY_NAMES[slot.day], periodLabel(slot.period), course?.code, faculty?.name, room?.name, slot.section]
          .map((v) => `"${(v ?? '').toString().replace(/"/g, '""')}"`)
          .join(',')
      })
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'facultyflow-timetable-2026-27.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2 className="greeting">Reports</h2>
          <p className="page-sub">
            Generated from the live timetable for {settings.term.toLowerCase()} · {data.slots.length} scheduled periods across{' '}
            {new Set(data.slots.map((s) => s.section)).size} sections.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={exportCsv}>
          <Icon name="download" size={15} /> Export timetable (CSV)
        </button>
      </div>

      <div className="tabs" role="tablist" aria-label="Report type">
        <button type="button" role="tab" aria-selected={tab === 'conflicts'} className={tab === 'conflicts' ? 'active' : ''} onClick={() => setTab('conflicts')}>
          <span className="tab-label">Conflict audit</span>
          <span className={`tab-badge${audit.length > 0 ? ' tab-badge-warn' : ' tab-badge-ok'}`}>{audit.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={tab === 'workload'} className={tab === 'workload' ? 'active' : ''} onClick={() => setTab('workload')}>
          <span className="tab-label">Faculty workload</span>
          <span className="tab-badge">{data.faculty.length}</span>
        </button>
      </div>

      {tab === 'conflicts' ? (
        <div className="report-grid">
          <section className="panel flush">
            <header className="panel-head">
              <div>
                <h3>Scheduling conflicts</h3>
                <p>Faculty, room and section overlaps detected across all timetables</p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onNavigateTimetable}>
                Open timetable
              </button>
            </header>
            {audit.length === 0 ? (
              <div className="empty">
                <Icon name="check" size={20} />
                <p className="empty-title">No conflicts detected</p>
                <p className="muted">Every lecture has a free faculty member, an empty room and a section without a parallel class.</p>
              </div>
            ) : (
              <ul className="conflict-list">
                {audit.map((row, i) => (
                  <li key={i} className="conflict-row">
                    <div className="conflict-head">
                      <span className="mono strong conflict-course">{row.course}</span>
                      <span className="conflict-when">{row.when}</span>
                      <button type="button" className="action-btn action-edit conflict-review" onClick={() => onFix(row.slotId)}>
                        Review
                      </button>
                    </div>
                    <p className="conflict-text">
                      <Icon name="warning" size={13} />
                      <span>{row.message}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <footer className="table-foot">
              <span>Conflicts are recalculated every time the timetable changes.</span>
            </footer>
          </section>

          <section className="panel flush">
            <header className="panel-head">
              <div>
                <h3>Under-allotted courses</h3>
                <p>Courses in this timetable with fewer periods than their weekly requirement</p>
              </div>
            </header>
            {shortfalls.length === 0 ? (
              <div className="empty compact">
                <p className="empty-title">All scheduled courses meet their weekly hours</p>
                <p className="muted">Every course that appears on a timetable has its required number of periods.</p>
              </div>
            ) : (
              <ul className="shortfall-list">
                {shortfalls.map(({ course, scheduled, gap, sections }) => (
                  <li key={course.id} className="shortfall-row">
                    <div className="shortfall-main">
                      <div className="shortfall-title">
                        <span className="mono shortfall-code">{course.code}</span>
                        <span className="shortfall-name">{course.title}</span>
                      </div>
                      <span className="shortfall-sections">
                        {sections} section{sections === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="shortfall-nums">
                      <div className="shortfall-figure">
                        <span className="shortfall-value mono">
                          {scheduled}<span className="shortfall-of">/{course.weeklyHours}</span>
                        </span>
                        <span className="shortfall-caption">periods scheduled</span>
                      </div>
                      <div className="shortfall-figure">
                        <span className="shortfall-value shortfall-gap">{gap}</span>
                        <span className="shortfall-caption">pending</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <footer className="panel-foot">
              <button type="button" className="link-btn subtle" onClick={onNavigateTimetable}>
                Schedule the pending periods
              </button>
            </footer>
          </section>
        </div>
      ) : (
        <div className="report-grid">
          <section className="panel flush">
            <header className="panel-head">
              <div>
                <h3>Weekly teaching load</h3>
                <p>Periods allotted against the maximum for each faculty member</p>
              </div>
              <span className="muted small">Max {Math.max(...data.faculty.map((f) => f.maxHours))} periods</span>
            </header>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Faculty</th>
                  <th scope="col">Department</th>
                  <th scope="col">Periods</th>
                  <th scope="col">Allocation</th>
                  <th scope="col" className="num">
                    Days
                  </th>
                </tr>
              </thead>
              <tbody>
                {workload.map(({ faculty, hours, pct, days }) => (
                  <tr key={faculty.id}>
                    <td>
                      <span className="strong">{shortName(faculty.name)}</span>
                      <span className="cell-sub">{faculty.empNo}</span>
                    </td>
                    <td>{faculty.department}</td>
                    <td className="mono">
                      {hours}/{faculty.maxHours}
                    </td>
                    <td>
                      <div className={`meter wide${pct >= 100 ? ' meter-red' : pct >= 90 ? ' meter-amber' : ''}`}>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="num">{days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="report-side">
            <section className="panel">
              <header className="panel-head">
                <div>
                  <h3>Department load</h3>
                  <p>Periods allotted by department</p>
                </div>
              </header>
              <ul className="hbar-list">
                {Array.from(new Set(data.faculty.map((f) => f.department))).map((dept) => {
                  const staff = data.faculty.filter((f) => f.department === dept)
                  const count = staff.reduce((sum, f) => sum + data.slots.filter((s) => s.facultyId === f.id).length, 0)
                  return (
                    <li key={dept}>
                      <span className="hbar-label" title={dept}>{dept}</span>
                      <span className="hbar-track">
                        <span className="hbar-fill" style={{ width: `${Math.min(100, (count / maxHours) * 100)}%` }} />
                      </span>
                      <span className="mono hbar-value">{count}</span>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="panel">
              <header className="panel-head">
                <div>
                  <h3>Room utilisation</h3>
                  <p>{occupancy}% of all weekly periods</p>
                </div>
              </header>
              <ul className="mini-list room-usage-list">
                {roomUsage.map(({ room, used }) => (
                  <li key={room.id} className="room-usage-row">
                    <span className="room-usage-name">
                      <strong>{room.name}</strong>
                      <span className="cell-sub">{room.kind}</span>
                    </span>
                    <span className="mono room-usage-value">
                      {used}
                      <span className="room-usage-unit">periods</span>
                    </span>
                  </li>
                ))}
              </ul>
              <footer className="panel-foot">
                <span className="muted">Periods booked this week, all sections.</span>
              </footer>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
