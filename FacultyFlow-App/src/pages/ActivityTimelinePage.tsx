import { useMemo, useState } from 'react'
import type { AppStore } from '../state/useAppData'
import { formatDateKey, formatDateTime, parseTimestamp, relativeTime } from '../lib/datetime'
import { Icon } from '../components/Icon'
import type { TermKey } from '../types'

type ActionFilter = 'all' | 'added' | 'updated' | 'removed'
type Scope = 'all' | 'timetable' | 'substitutions' | 'calendar'
type TermScope = 'active' | 'all'

/** One row in the timeline, from any of the three sources. */
interface TimelineEntry {
  key: string
  id: string
  /** Sortable timestamp in milliseconds — never compared as strings. */
  at: number
  raw: string
  /** Calendar rows hold a scheduled date, not the moment someone acted. */
  futureTimestamp: boolean
  action: 'added' | 'updated' | 'removed'
  summary: string
  detail: string
  actor: string
  source: 'Timetable' | 'Substitutions' | 'Calendar'
  term: TermKey
}

const SOURCE_OF: Record<Scope, TimelineEntry['source'] | null> = {
  all: null,
  timetable: 'Timetable',
  substitutions: 'Substitutions',
  calendar: 'Calendar',
}

/** The made-up activities describe the odd-semester timetable, so legacy rows default to it. */
const entryTerm = (value: TermKey | undefined): TermKey => value ?? 'odd'

export function ActivityTimelinePage({ store }: { store: AppStore }) {
  const { data, activeTerm, termConfig, substitutions, calendarEvents } = store
  const [filter, setFilter] = useState<ActionFilter>('all')
  const [scope, setScope] = useState<Scope>('all')
  const [termScope, setTermScope] = useState<TermScope>('active')

  const entries = useMemo<TimelineEntry[]>(() => {
    const timetable: TimelineEntry[] = data.log.map((entry) => ({
      key: `Timetable-${entry.id}`,
      id: entry.id,
      at: parseTimestamp(entry.timestamp)?.getTime() ?? 0,
      raw: entry.timestamp,
      futureTimestamp: false,
      action: entry.action,
      summary: entry.summary,
      detail: entry.detail,
      actor: entry.actor,
      source: 'Timetable',
      term: entryTerm(entry.term),
    }))

    const subs: TimelineEntry[] = substitutions.map((s) => {
      const raw = s.appliedAt.replace(' ', 'T')
      return {
        key: `Substitutions-${s.id}`,
        id: s.id,
        at: parseTimestamp(raw)?.getTime() ?? 0,
        raw,
        futureTimestamp: false,
        action: s.status === 'Approved' ? 'added' : s.status === 'Cancelled' ? 'removed' : 'updated',
        summary: `${s.status} substitution · ${s.courseCode}`,
        detail: `${s.facultyName} → ${s.substituteFacultyName} · ${s.day} P${s.period} · ${s.section} · Room ${s.roomName}`,
        actor: 'Substitution desk',
        source: 'Substitutions',
        term: entryTerm(s.term),
      }
    })

    const calendar: TimelineEntry[] = calendarEvents.map((ev) => {
      // The timeline sorts every entry strictly by its timestamp.
      const at = parseTimestamp(`${ev.date}T09:00:00`)?.getTime() ?? 0
      return {
        key: `Calendar-${ev.id}`,
        id: ev.id,
        at,
        raw: `${ev.date}T09:00:00`,
        futureTimestamp: true,
        action: 'added',
        summary: `Calendar · ${ev.title}`,
        detail: `${ev.category}${ev.endDate && ev.endDate > ev.date ? ` · ${formatDateKey(ev.date)} – ${formatDateKey(ev.endDate)}` : ` · ${formatDateKey(ev.date)}`}${ev.location ? ` · ${ev.location}` : ''}`,
        actor: 'Academic office',
        source: 'Calendar',
        term: entryTerm(ev.term),
      }
    })

    const wantedSource = SOURCE_OF[scope]
    return [...timetable, ...subs, ...calendar]
      .filter((e) => (wantedSource ? e.source === wantedSource : true))
      .filter((e) => (termScope === 'all' ? true : e.term === activeTerm))
      .filter((e) => filter === 'all' || e.action === filter)
      // Newest first. Timestamps become numbers, so "10 Oct" can never sort above "9 Oct".
      .sort((a, b) => b.at - a.at || a.key.localeCompare(b.key))
  }, [data.log, substitutions, calendarEvents, filter, scope, termScope, activeTerm])

  return (
    <div className="page stagger">
      <div className="page-head">
        <div>
          <h2 className="page-title">Activity timeline</h2>
          <p className="page-sub">
            Every timetable change, substitution decision and calendar update in the {termConfig.label.toLowerCase()} —
            newest first. Sample entries carry fixed demo timestamps, not real user activity.
          </p>
        </div>
        <div className="page-tools">
          <label className="inline-field">
            <span>Semester</span>
            <select value={termScope} onChange={(e) => setTermScope(e.target.value as TermScope)}>
              <option value="active">{termConfig.label}</option>
              <option value="all">Both semesters</option>
            </select>
          </label>
          <label className="inline-field">
            <span>Source</span>
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              <option value="all">All activity</option>
              <option value="timetable">Timetable</option>
              <option value="substitutions">Substitutions</option>
              <option value="calendar">Calendar</option>
            </select>
          </label>
          <div className="seg" role="group" aria-label="Filter by action type">
            {(['all', 'added', 'updated', 'removed'] as ActionFilter[]).map((a) => (
              <button key={a} type="button" className={filter === a ? 'active' : ''} onClick={() => setFilter(a)}>
                {a === 'all' ? 'All' : a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="result-bar" style={{ marginBottom: 16 }}>
          <span>
            Showing <strong>{entries.length}</strong> entr{entries.length === 1 ? 'y' : 'ies'} ·{' '}
            {termScope === 'all' ? 'both semesters' : termConfig.label.toLowerCase()}
          </span>
          <span className="muted">{termConfig.academicYear}</span>
        </div>
        {entries.length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <Icon name="clock" size={22} />
            </span>
            <p className="empty-title">No activity matches this filter</p>
            <p className="muted">Try a different semester, source or action type.</p>
          </div>
        ) : (
          <div className="timeline-events-list">
            {entries.map((entry) => {
              const parsed = parseTimestamp(entry.raw)
              const relative = relativeTime(entry.raw, undefined, { futureTimestamp: entry.futureTimestamp })
              const exact = formatDateTime(entry.raw)
              return (
                <div key={entry.key} className={`timeline-entry-row act-${entry.action}`}>
                  <span className="timeline-marker">
                    <span className="marker-node">
                      <Icon name={entry.action === 'added' ? 'plus' : entry.action === 'removed' ? 'trash' : 'edit'} size={13} />
                    </span>
                    <span className="marker-line" />
                  </span>
                  <div className="timeline-card-glass">
                    <div className="timeline-card-top">
                      <span className="timeline-action-badge">
                        {entry.source} · {entry.action}
                      </span>
                      {/* Relative time when recent; the full date and time otherwise. */}
                      <time className="timeline-time" dateTime={parsed ? parsed.toISOString() : undefined} title={exact}>
                        {relative}
                      </time>
                    </div>
                    <p className="timeline-summary">{entry.summary}</p>
                    <p className="timeline-detail">{entry.detail}</p>
                    <span className="timeline-actor-pill">
                      <Icon name="user" size={14} /> {entry.actor}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
