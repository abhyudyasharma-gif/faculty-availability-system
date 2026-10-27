import { useEffect, useMemo, useState } from 'react'
import { DAY_NAMES, PERIODS } from '../data/seed'
import { detectConflicts, formatStamp, periodLabel, shortName, SUBJECT_TONES, todayKey, toneIndex, visibleDays } from '../lib/timetable'
import { facultyAvailability, substitutionFor, termSlotsFor } from '../lib/availability'
import type { AppStore } from '../state/useAppData'
import type { Day, Slot, SubstitutionRequest, TermKey } from '../types'
import { ConfirmDialog } from '../components/Modal'
import { FieldHelp } from '../components/FieldHelp'
import { Icon } from '../components/Icon'
import { SlotDetail } from '../components/SlotDetail'
import { TimetableGrid } from '../components/TimetableGrid'
import { SmartTimetableBuilder } from '../components/SmartTimetableBuilder'
import { TermSwitch } from '../components/TermSwitch'
import { useToast } from '../components/Toast'
import { schedulingGuidance } from '../lib/guidance'

interface TimetablePageProps {
  store: AppStore
  section: string
  onSection: (section: string) => void
  onAdd: (preset?: { day: Day; period: number; section: string }) => void
  onEdit: (slot: Slot) => void
  /** A day chosen on the dashboard to open focused. */
  highlightDay?: Day | null
  onClearHighlight?: () => void
  lastSaved?: { id: string; lastSavedAt: number } | null
  onShowInCore?: (day: string) => void
  /** The label shown for the non-grid "core" view call-to-action. */
  coreLabel?: string
}

type TypeFilter = 'all' | 'lectures' | 'labs'
type ViewMode = 'grid' | 'builder' | 'list'

export function TimetablePage({
  store,
  section,
  onSection,
  onAdd,
  onEdit,
  highlightDay,
  onClearHighlight,
  lastSaved,
  onShowInCore,
}: TimetablePageProps) {
  const { data, settings, commit, mutations, activeTerm, termConfig, setTerm, substitutions } = store
  const toast = useToast()
  const today = todayKey()
  const [facultyFilter, setFacultyFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [dayFilter, setDayFilter] = useState<'all' | Day>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [view, setView] = useState<ViewMode>('grid')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Slot | null>(null)
  const [undoSlot, setUndoSlot] = useState<Slot | null>(null)
  const [focusDay, setFocusDay] = useState<Day | null>(null)

  const days = visibleDays(settings)
  const slots = useMemo(
    () => termSlotsFor(data, activeTerm).filter((s) => s.section === section),
    [data, section, activeTerm],
  )

  const [prevHighlightDay, setPrevHighlightDay] = useState(highlightDay)
  if (highlightDay !== prevHighlightDay) {
    setPrevHighlightDay(highlightDay)
    if (highlightDay) {
      const day = days.includes(highlightDay) ? highlightDay : null
      setFocusDay(day)
      setDayFilter(day ?? 'all')
      onClearHighlight?.()
    }
  }

  // Clear the focusDay ring after a short duration
  useEffect(() => {
    if (!focusDay) return
    const timer = window.setTimeout(() => setFocusDay(null), 2400)
    return () => window.clearTimeout(timer)
  }, [focusDay])

  // Open a lecture from the dashboard's "recently saved" flash.
  useEffect(() => {
    if (!lastSaved) return
    const saved = data.slots.find((s) => s.id === lastSaved.id && s.section === section)
    if (saved) setSelectedId(saved.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSaved?.id])

  const clashes = useMemo(() => {
    const list: { slot: Slot; message: string; type: string }[] = []
    for (const slot of slots) {
      // Only a clash with a *different* period in this section is a real problem;
      // another section sharing a room at the same time is normal campus use.
      const issues = detectConflicts(data, slot, settings, slot.id).filter((c) => c.type === 'section')
      if (issues.length > 0) list.push({ slot, message: issues[0].message, type: issues[0].type })
    }
    return list
  }, [data, slots, settings])

  // Faculty currently marked on leave in this section's periods.
  const leaveSlots = slots
    .filter((s) => data.faculty.find((f) => f.id === s.facultyId)?.status === 'On leave')
    .map((slot) => ({
      slot,
      type: 'leave',
      message: `${data.faculty.find((f) => f.id === slot.facultyId)?.name ?? 'Faculty'} is on leave for this period.`,
    }))

  const overlapSlots = clashes

  const matches = (slot: Slot) => {
    const course = data.courses.find((c) => c.id === slot.courseId)
    const room = data.rooms.find((r) => r.id === slot.roomId)
    if (dayFilter !== 'all' && slot.day !== dayFilter) return false
    if (facultyFilter !== 'all' && slot.facultyId !== facultyFilter) return false
    if (courseFilter !== 'all' && slot.courseId !== courseFilter) return false
    if (roomFilter !== 'all' && slot.roomId !== roomFilter) return false
    if (typeFilter === 'labs' && room?.kind !== 'Laboratory') return false
    if (typeFilter === 'lectures' && room?.kind === 'Laboratory') return false
    return Boolean(course)
  }

  const filtered = slots
    .filter(matches)
    .sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day) || a.period - b.period)

  const activeFilterCount = [facultyFilter, courseFilter, roomFilter, dayFilter, typeFilter].filter(
    (v) => v !== 'all',
  ).length
  const selected = data.slots.find((s) => s.id === selectedId) ?? null
  const sectionCourses = Array.from(new Set(slots.map((s) => s.courseId)))
    .map((id) => data.courses.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))

  const availability = facultyAvailability({ data, settings, substitutions, term: activeTerm })

  const clearFilters = () => {
    setFacultyFilter('all')
    setCourseFilter('all')
    setRoomFilter('all')
    setDayFilter('all')
    setTypeFilter('all')
  }

  const selectSlot = (slot: Slot) => {
    setSelectedId((current) => (current === slot.id ? null : slot.id))
  }

  const removeSlot = async (slot: Slot) => {
    const course = data.courses.find((c) => c.id === slot.courseId)
    const room = data.rooms.find((r) => r.id === slot.roomId)
    const faculty = data.faculty.find((f) => f.id === slot.facultyId)
    setPendingDelete(null)
    const result = await mutations.deleteSlot(slot.id)
    if (!result.ok) {
      toast.error(result.error ?? 'Could not remove the lecture.')
      return
    }
    commit((current) => current, {
      action: 'removed',
      summary: `${course?.code ?? 'Lecture'} removed from timetable`,
      detail: `${DAY_NAMES[slot.day]} P${slot.period} · ${room?.name} · ${faculty ? shortName(faculty.name) : 'Unassigned'} · ${slot.section}`,
    })
    if (selectedId === slot.id) setSelectedId(null)
    setUndoSlot(slot)
    toast.success(`${course?.code ?? 'Lecture'} removed from ${DAY_NAMES[slot.day]} P${slot.period}.`)
    window.setTimeout(() => setUndoSlot((s) => (s?.id === slot.id ? null : s)), 6000)
  }

  const undoRemove = async () => {
    if (!undoSlot) return
    const restored = undoSlot
    // Deleting removed the row from MySQL, so undo inserts it again (new id).
    const result = await mutations.restoreSlot(restored)
    if (!result.ok) {
      toast.error(result.error ?? 'Could not restore the lecture.')
      return
    }
    setUndoSlot(null)
    toast.info('Lecture restored to the timetable.')
  }

  const weeklyHours = slots.length
  const gridKey = `${section}-${dayFilter}-${activeTerm}`

  return (
    <div className={`page timetable-page today-${today}${focusDay ? ' is-focusing' : ''}`}>
      <div className="print-head" aria-hidden="true">
        <strong>FacultyFlow</strong>
        <span>
          Weekly timetable · Section {section} · {store.settings.term}
        </span>
        <span>Printed {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <label className="inline-field">
            <span>Section</span>
            <select
              value={section}
              onChange={(e) => {
                onSection(e.target.value)
                setSelectedId(null)
              }}
            >
              {Array.from(new Set([...store.termSlots.map((s) => s.section), 'CSE-2B']))
                .sort()
                .map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Day</span>
            <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value as 'all' | Day)}>
              <option value="all">All days</option>
              {days.map((d) => (
                <option key={d} value={d}>
                  {DAY_NAMES[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Faculty</span>
            <select value={facultyFilter} onChange={(e) => setFacultyFilter(e.target.value)}>
              <option value="all">All faculty</option>
              {data.faculty.map((f) => (
                <option key={f.id} value={f.id}>
                  {shortName(f.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Course</span>
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="all">All courses</option>
              {sectionCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            <span>Room</span>
            <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
              <option value="all">All rooms</option>
              {data.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <div className="seg" role="group" aria-label="Filter by session type">
            {(['all', 'lectures', 'labs'] as TypeFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={typeFilter === f ? 'active' : ''}
                aria-pressed={typeFilter === f}
                onClick={() => setTypeFilter(f)}
              >
                {f === 'all' ? 'All' : f === 'lectures' ? 'Lectures' : 'Labs'}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-right">
          <div className="seg" role="group" aria-label="Timetable view">
            {(
              [
                ['grid', 'Grid', 'grid'],
                ['builder', 'Drag & drop', 'edit'],
                ['list', 'List', 'list'],
              ] as [ViewMode, string, 'grid' | 'edit' | 'list'][]
            ).map(([key, label, icon]) => (
              <button
                key={key}
                type="button"
                className={view === key ? 'active' : ''}
                aria-pressed={view === key}
                onClick={() => setView(key)}
              >
                <Icon name={icon} size={14} /> {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Icon name="download" size={15} /> Print
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onAdd()}>
            <Icon name="plus" size={15} /> Schedule lecture
          </button>
        </div>
      </div>

      <section className="panel tt-section-head">
        <div className="tt-section-copy">
          <h2 className="section-title">Section {section}</h2>
          <p className="muted small">
            {termConfig.label} · {termConfig.academicYear} · {weeklyHours} periods allotted ·{' '}
            {sectionCourses.length} courses · {new Set(slots.map((s) => s.roomId)).size} rooms in use
          </p>
          <p className="muted small mono">
            {termConfig.startDate} → {termConfig.endDate}
          </p>
        </div>
        <div className="tt-section-aside">
          <TermSwitch value={activeTerm} onChange={setTerm} compact />
          <FieldHelp title="Scheduling rules applied to this section" items={schedulingGuidance(data, settings)} />
        </div>
        <div className="legend" aria-label="Subject legend">
          {sectionCourses.map((course) => (
            <span key={course.id} className={`legend-item tone-${SUBJECT_TONES[toneIndex(course.code)]}`}>
              <span className="legend-swatch" /> {course.code}
            </span>
          ))}
        </div>
      </section>

      {overlapSlots.length > 0 && (
        <div className="notice notice-warn">
          <Icon name="warning" size={17} />
          <div>
            <strong>
              {overlapSlots.length} period{overlapSlots.length === 1 ? '' : 's'} in this section overlap with another class
            </strong>
            <p>{overlapSlots[0].message}</p>
          </div>
        </div>
      )}

      {overlapSlots.length === 0 && leaveSlots.length > 0 && (
        <div className="notice notice-warn">
          <Icon name="info" size={17} />
          <div>
            <strong>
              {new Set(leaveSlots.map((c) => c.slot.facultyId)).size === 1
                ? `${data.faculty.find((f) => f.id === leaveSlots[0].slot.facultyId)?.name} is on leave`
                : 'Faculty on leave are still assigned'}
            </strong>
            <p>
              {leaveSlots.length} of {slots.length} periods in {section} need a substitute. Arrange cover from the
              substitution desk.
            </p>
          </div>
        </div>
      )}

      <div className={`tt-layout${selected ? ' has-detail' : ''}`}>
        <section className="panel flush tt-panel">
          {slots.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">
                <Icon name="grid" size={22} />
              </span>
              <p className="empty-title">No lectures scheduled for {section}</p>
              <p className="muted">This section has an empty {termConfig.label.toLowerCase()} timetable. Add the first lecture to get started.</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onAdd()}>
                Schedule lecture
              </button>
            </div>
          ) : view === 'builder' ? (
            <div key="smart-builder-view" className="view-enter">
              <SmartTimetableBuilder
                store={store}
                currentSection={section}
                onSectionChange={onSection}
                onEditSlot={selectSlot}
                onAddSlot={(presetSlot) => onAdd(presetSlot)}
              />
            </div>
          ) : view === 'grid' ? (
            <>
              <div key={gridKey} className="view-enter">
                <TimetableGrid
                  data={data}
                  days={days}
                  section={section}
                  today={today}
                  isVisible={matches}
                  selectedId={selectedId}
                  onAdd={(day, period) => onAdd({ day, period, section })}
                  onEdit={selectSlot}
                  term={activeTerm}
                  substitutions={substitutions}
                />
              </div>
              <footer className="tt-foot">
                <span>
                  <span className="hint-dot" /> Click a free slot to add a lecture · click a lecture to inspect it
                </span>
                {activeFilterCount > 0 ? (
                  <span className="muted">
                    Filters highlight {filtered.length} of {slots.length} lectures ·{' '}
                    <button type="button" className="link-btn subtle" onClick={clearFilters}>
                      clear filters
                    </button>
                  </span>
                ) : (
                  <span className="muted">Lunch break 13:15 – 14:00 · last period ends at 17:15</span>
                )}
              </footer>
            </>
          ) : (
            <div key={gridKey} className="view-enter">
              <ListTimetable
                slots={filtered}
                data={data}
                selectedId={selectedId}
                lastSavedId={lastSaved?.id ?? null}
                onSelect={selectSlot}
                onDelete={setPendingDelete}
                term={activeTerm}
                substitutions={substitutions}
              />
            </div>
          )}
        </section>

        <div className="tt-detail-slot">
          {selected ? (
            <SlotDetail
              key={selected.id}
              slot={selected}
              data={data}
              onEdit={() => onEdit(selected)}
              onDelete={() => setPendingDelete(selected)}
              onClose={() => setSelectedId(null)}
              onFocus={onShowInCore ? () => onShowInCore(selected.day) : undefined}
              availability={availability.get(selected.facultyId)}
              substitute={substitutionFor(substitutions, selected, activeTerm)}
            />
          ) : (
            slots.length > 0 && (
              <aside className="slot-detail is-empty" aria-label="Lecture details">
                <header className="slot-detail-head">
                  <h3>Lecture details</h3>
                </header>
                <div className="slot-detail-body">
                  <p className="muted">
                    Select a lecture in the {view} view to see its course, faculty, room and teaching load. Editing stays
                    one click away.
                  </p>
                  <ul className="slot-detail-keys">
                    <li>
                      <kbd>Click</kbd> free period to schedule
                    </li>
                    <li>
                      <kbd>Click</kbd> lecture to inspect
                    </li>
                    <li>
                      <kbd>Edit</kbd> in the panel to change it
                    </li>
                  </ul>
                </div>
              </aside>
            )
          )}
        </div>
      </div>

      <p className="stamp-line">
        Timetable last reviewed {data.log[0] ? formatStamp(data.log[0].timestamp) : 'today'} · {PERIODS.length} periods
        per day · {termConfig.label} {termConfig.academicYear}
      </p>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this lecture?"
        message={
          pendingDelete
            ? `${data.courses.find((c) => c.id === pendingDelete.courseId)?.code} · ${DAY_NAMES[pendingDelete.day]} ${periodLabel(pendingDelete.period)} · Room ${data.rooms.find((r) => r.id === pendingDelete.roomId)?.name}. The period will become free in section ${pendingDelete.section}.`
            : ''
        }
        confirmLabel="Remove lecture"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void removeSlot(pendingDelete)
        }}
      />

      {undoSlot && (
        <div className="undo-bar">
          <span>Lecture removed from the timetable.</span>
          <button type="button" onClick={() => void undoRemove()}>
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

interface ListProps {
  slots: Slot[]
  data: AppStore['data']
  selectedId: string | null
  lastSavedId: string | null
  onSelect: (slot: Slot) => void
  onDelete: (slot: Slot) => void
  term: TermKey
  substitutions: SubstitutionRequest[]
}

/** List view: the same weekly data as an agenda grouped by day. */
function ListTimetable({ slots, data, selectedId, lastSavedId, onSelect, onDelete, term, substitutions }: ListProps) {
  if (slots.length === 0) {
    return (
      <div className="empty compact">
        <p className="empty-title">No lectures match the current filters</p>
        <p className="muted">Change the day, faculty, course or room filter to see more of the week.</p>
      </div>
    )
  }

  const grouped = new Map<Day, Slot[]>()
  for (const slot of slots) {
    const list = grouped.get(slot.day) ?? []
    list.push(slot)
    grouped.set(slot.day, list)
  }

  return (
    <div className="tt-agenda">
      {[...grouped.entries()].map(([day, daySlots]) => (
        <section key={day} className="tt-agenda-day">
          <header>
            <h3>{DAY_NAMES[day]}</h3>
            <span className="muted small">
              {daySlots.length} period{daySlots.length === 1 ? '' : 's'}
            </span>
          </header>
          <ul>
            {daySlots.map((slot) => {
              const course = data.courses.find((c) => c.id === slot.courseId)
              const faculty = data.faculty.find((f) => f.id === slot.facultyId)
              const room = data.rooms.find((r) => r.id === slot.roomId)
              const sub = substitutionFor(substitutions, slot, term)
              const period = PERIODS.find((p) => p.period === slot.period)
              return (
                <li
                  key={slot.id}
                  className={`tt-agenda-row${selectedId === slot.id ? ' is-selected' : ''}${lastSavedId === slot.id ? ' row-flash' : ''}`}
                >
                  <button type="button" className="tt-agenda-main" onClick={() => onSelect(slot)} aria-pressed={selectedId === slot.id}>
                    <span className="tt-agenda-time">
                      <span className="period-chip">P{slot.period}</span>
                      <span className="mono">
                        {period?.start}–{period?.end}
                      </span>
                    </span>
                    <span className="tt-agenda-course">
                      <strong className="mono">{course?.code}</strong>
                      <span>{course?.title}</span>
                    </span>
                    <span className="tt-agenda-faculty">
                      {sub ? (
                        <>
                          {shortName(sub.substituteFacultyName)} <em className="cell-warn">(substitute)</em>
                        </>
                      ) : (
                        <>
                          {faculty ? shortName(faculty.name) : 'Unassigned'}
                          {faculty?.status === 'On leave' && <em className="cell-warn"> · on leave</em>}
                        </>
                      )}
                    </span>
                    <span className="room-tag">{room?.name}</span>
                  </button>
                  <button type="button" className="link-btn danger" onClick={() => onDelete(slot)}>
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
