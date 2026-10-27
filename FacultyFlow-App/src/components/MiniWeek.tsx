import { DAY_NAMES } from '../data/seed'
import { colorFor } from '../lib/timetable'
import type { AppData, Day } from '../types'

const SHORT: Record<Day, string> = { Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'T', Fri: 'F', Sat: 'S' }

interface Props {
  data: AppData
  section: string
  days: Day[]
  periods: number
  today: Day
  /** Slightly stronger fills — used when this grid replaces the 3D scene. */
  strong?: boolean
  compact?: boolean
}

/**
 * The weekly timetable at a glance: one column per day, one row per period.
 * Every cell is real timetable state, generated from `data.slots`.
 */
export function MiniWeek({ data, section, days, periods, today, strong, compact }: Props) {
  const slots = data.slots.filter((s) => s.section === section)

  return (
    <div className={`mini-week${strong ? ' is-strong' : ''}${compact ? ' is-compact' : ''}`}>
      <div className="mini-week-days" aria-hidden="true">
        {days.map((day) => (
          <span key={day} className={day === today ? 'is-today' : undefined}>
            {SHORT[day]}
          </span>
        ))}
      </div>
      <div className="mini-week-rows" aria-hidden="true">
        {Array.from({ length: periods }, (_, row) => (
          <div className="mini-week-row" key={row}>
            {days.map((day) => {
              const slot = slots.find((s) => s.day === day && s.period === row + 1)
              const course = slot ? data.courses.find((c) => c.id === slot.courseId) : undefined
              return (
                <span
                  key={day}
                  className={`mini-cell${slot ? ` tone-${colorFor(course?.code ?? '')}` : ''}${day === today ? ' is-today' : ''}`}
                  title={slot ? `${DAY_NAMES[day]} P${row + 1} · ${course?.code ?? 'Lecture'}` : undefined}
                >
                  {slot ? <i /> : null}
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
