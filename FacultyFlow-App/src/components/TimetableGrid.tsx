import { Fragment } from 'react'
import { BREAK_AFTER_PERIOD, DAY_NAMES, PERIODS } from '../data/seed'
import { colorFor, shortName } from '../lib/timetable'
import type { AppData, Day, Slot, SubstitutionRequest, TermKey } from '../types'
import { Icon } from './Icon'

interface TimetableGridProps {
  data: AppData
  days: Day[]
  section: string
  today: Day
  onAdd: (day: Day, period: number) => void
  onEdit: (slot: Slot) => void
  /** Filters applied by the parent — hidden lectures keep their slot but read as "not in view". */
  isVisible?: (slot: Slot) => boolean
  /** Lecture currently open in the detail panel. */
  selectedId?: string | null
  term: TermKey
  substitutions: SubstitutionRequest[]
}

export function TimetableGrid({
  data,
  days,
  section,
  today,
  onAdd,
  onEdit,
  isVisible,
  selectedId,
  term,
  substitutions,
}: TimetableGridProps) {
  const slots = data.slots.filter((s) => s.section === section && (s.term ?? 'odd') === term)

  const find = (day: Day, period: number) => slots.find((s) => s.day === day && s.period === period)
  const dayVisible = (day: Day) => {
    if (!isVisible) return true
    return slots.some((s) => s.day === day && isVisible(s))
  }

  return (
    <div className="ttWrap">
      <table className="tt">
        <thead>
          <tr>
            <th className="tt-time-col" scope="col">
              Time
            </th>
            {days.map((day) => (
              <th
                key={day}
                scope="col"
                className={[day === today ? 'tt-today' : '', isVisible && !dayVisible(day) ? 'tt-header-dim' : '']
                  .join(' ')
                  .trim() || undefined}
              >
                <span className="tt-day-full">{DAY_NAMES[day]}</span>
                <span className="tt-day">{DAY_NAMES[day].slice(0, 3)}</span>
                {day === today && <span className="tt-today-tag">Today</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p) => (
            <Fragment key={p.period}>
              <tr>
                <th scope="row" className="tt-time">
                  <span className="tt-period">Period {p.period}</span>
                  <span className="tt-range">{p.label}</span>
                </th>
                {days.map((day) => {
                  const slot = find(day, p.period)
                  if (!slot) {
                    return (
                      <td key={day} className={`tt-cell${day === today ? ' tt-cell-today' : ''}`}>
                        <button
                          type="button"
                          className="tt-empty"
                          onClick={() => onAdd(day, p.period)}
                          title="Add a lecture in this slot"
                        >
                          <Icon name="plus" size={14} />
                          <span>Free</span>
                        </button>
                      </td>
                    )
                  }
                  const course = data.courses.find((c) => c.id === slot.courseId)
                  const faculty = data.faculty.find((f) => f.id === slot.facultyId)
                  const room = data.rooms.find((r) => r.id === slot.roomId)
                  const tone = colorFor(course?.code ?? '')
                  const dimmed = isVisible ? !isVisible(slot) : false
                  const sub = substitutions.find(
                    (s) =>
                      s.status === 'Approved' &&
                      (s.timetableId === slot.id ||
                        (s.facultyId === slot.facultyId && s.day === slot.day && s.period === slot.period)),
                  )
                  const onLeave = faculty?.status === 'On leave'
                  return (
                    <td key={day} className={`tt-cell${day === today ? ' tt-cell-today' : ''}`} data-slot-anchor={slot.id}>
                      <button
                        type="button"
                        className={`lecture lecture-${tone}${dimmed ? ' lecture-dim' : ''}${onLeave ? ' lecture-leave' : ''}${selectedId === slot.id ? ' is-selected' : ''}`}
                        onClick={() => onEdit(slot)}
                        aria-pressed={selectedId === slot.id}
                        title={`${course?.title} · ${faculty?.name} · Room ${room?.name}${onLeave ? ' · faculty on leave — substitute needed' : ''}${sub ? ` · covered by ${sub.substituteFacultyName}` : ''}${dimmed ? ' · filtered out' : ''}`}
                      >
                        <span className="lecture-code">
                          {course?.code}
                          {sub ? <span className="sub-flag">Sub</span> : onLeave ? <span className="leave-flag">Leave</span> : null}
                        </span>
                        <span className="lecture-title">{course?.title}</span>
                        <span className="lecture-meta">
                          {sub ? shortName(sub.substituteFacultyName) : faculty ? shortName(faculty.name) : 'Unassigned'}
                        </span>
                        <span className="lecture-room">
                          <Icon name="building" size={12} /> {room?.name ?? '—'}
                        </span>
                      </button>
                    </td>
                  )
                })}
              </tr>
              {p.period === BREAK_AFTER_PERIOD && (
                <tr className="tt-break-row">
                  <th scope="row">
                    <span className="tt-range">13:15 – 14:00</span>
                  </th>
                  <td colSpan={days.length}>
                    <span className="tt-break">
                      Lunch break · 45 minutes
                      <span className="tt-break-note">No lectures scheduled</span>
                    </span>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
