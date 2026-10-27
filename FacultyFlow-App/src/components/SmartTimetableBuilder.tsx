import { useState } from 'react'
import {
  DEPARTMENTS,
  DAY_NAMES,
  PERIODS,
  SECTIONS,
} from '../data/seed'
import { colorFor, detectConflicts, periodLabel, shortName, visibleDays } from '../lib/timetable'
import type { AppStore } from '../state/useAppData'
import type { Day, Slot } from '../types'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'

interface SmartTimetableBuilderProps {
  store: AppStore
  currentSection: string
  onSectionChange: (sec: string) => void
  onEditSlot: (slot: Slot) => void
  onAddSlot: (preset: { day: Day; period: number; section: string }) => void
}

export function SmartTimetableBuilder({
  store,
  currentSection,
  onSectionChange,
  onEditSlot,
  onAddSlot,
}: SmartTimetableBuilderProps) {
  const { data, settings, commit, mutations, activeTerm } = store
  const toast = useToast()
  const days = visibleDays(settings)

  const [filterDept, setFilterDept] = useState<string>('all')
  const [draggedSlot, setDraggedSlot] = useState<Slot | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{ day: Day; period: number } | null>(null)

  // Clash Inspector state
  const [showClashPanel, setShowClashPanel] = useState(false)

  const sectionSlots = data.slots.filter((s) => s.section === currentSection)

  // Clashes computation for this section
  const sectionClashes = sectionSlots.flatMap((slot) => {
    const issues = detectConflicts(data, slot, settings, slot.id).filter((c) => c.type !== 'limit')
    return issues.map((iss) => ({ slot, issue: iss }))
  })

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, slot: Slot) => {
    e.dataTransfer.setData('text/plain', slot.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedSlot(slot)
  }

  const handleDragOver = (e: React.DragEvent, day: Day, period: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCell?.day !== day || dragOverCell?.period !== period) {
      setDragOverCell({ day, period })
    }
  }

  const handleDragLeave = () => {
    setDragOverCell(null)
  }

  /**
   * Moving a lecture (or swapping two) is saved slot by slot. A move the
   * database rejects — e.g. the faculty member already teaches at the target —
   * is reported, and the grid keeps the stored position.
   */
  const handleDrop = async (e: React.DragEvent, targetDay: Day, targetPeriod: number) => {
    e.preventDefault()
    setDragOverCell(null)
    const moving = draggedSlot
    if (!moving) return

    // If dropped on the same slot, no-op
    if (moving.day === targetDay && moving.period === targetPeriod) {
      setDraggedSlot(null)
      return
    }

    // Check if target is already occupied in this section
    const targetOccupied = sectionSlots.find((s) => s.day === targetDay && s.period === targetPeriod)

    const course = data.courses.find((c) => c.id === moving.courseId)
    const faculty = data.faculty.find((f) => f.id === moving.facultyId)
    const term = moving.term ?? activeTerm

    if (targetOccupied) {
      // SWAP LECTURES: move one, then the other; roll the first back on failure.
      const first = await mutations.updateSlot(moving.id, { ...moving, day: targetDay, period: targetPeriod }, term)
      if (!first.ok) {
        toast.error(first.conflicts?.[0] ?? first.error ?? 'This swap conflicts with another booking.')
        setDraggedSlot(null)
        return
      }
      const second = await mutations.updateSlot(
        targetOccupied.id,
        { ...targetOccupied, day: moving.day, period: moving.period },
        term,
      )
      if (!second.ok) {
        await mutations.updateSlot(moving.id, moving, term)
        toast.error(second.conflicts?.[0] ?? second.error ?? 'This swap conflicts with another booking.')
        setDraggedSlot(null)
        return
      }
      commit((cur) => cur, {
        action: 'updated',
        summary: `Swapped lectures between P${moving.period} and P${targetPeriod}`,
        detail: `${course?.code} ⇄ ${data.courses.find((c) => c.id === targetOccupied.courseId)?.code}`,
      })
      toast.info(`Swapped: ${course?.code} moved to ${DAY_NAMES[targetDay]} ${periodLabel(targetPeriod)}`)
    } else {
      // MOVE LECTURE
      const result = await mutations.updateSlot(moving.id, { ...moving, day: targetDay, period: targetPeriod }, term)
      if (!result.ok) {
        toast.error(result.conflicts?.[0] ?? result.error ?? 'This move conflicts with another booking.')
        setDraggedSlot(null)
        return
      }
      commit((cur) => cur, {
        action: 'updated',
        summary: `Relocated ${course?.code} to ${DAY_NAMES[targetDay]} P${targetPeriod}`,
        detail: `${faculty?.name} · Section ${currentSection}`,
      })
      toast.success(`Moved ${course?.code} to ${DAY_NAMES[targetDay]} (${periodLabel(targetPeriod)})`)
    }

    setDraggedSlot(null)
  }

  return (
    <div className="smart-builder-container">
      {/* Builder Top Bar & Controls */}
      <div className="builder-header-card">
        <div className="builder-title-group">
          <div className="builder-badge">
            <span className="dot-pulse" />
            <span>Smart Timetable Matrix</span>
          </div>
          <h2>Interactive Schedule Architect</h2>
          <p>
            Fluid drag-and-drop lecture repositioning with real-time room & faculty conflict
            detection.
          </p>
        </div>

        <div className="builder-controls-group">
          <label className="builder-select-label">
            <span>Section</span>
            <select
              value={currentSection}
              onChange={(e) => onSectionChange(e.target.value)}
              className="builder-select"
            >
              {SECTIONS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </label>

          <label className="builder-select-label">
            <span>Filter Dept</span>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="builder-select"
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={`btn-builder-clash ${sectionClashes.length > 0 ? 'has-clashes' : ''}`}
            onClick={() => setShowClashPanel(!showClashPanel)}
          >
            <Icon name="warning" size={15} />
            <span>
              {sectionClashes.length === 0
                ? '0 Conflicts'
                : `${sectionClashes.length} Detected Clash${sectionClashes.length > 1 ? 'es' : ''}`}
            </span>
          </button>
        </div>
      </div>

      {/* Clash Diagnostics Banner (Collapsible) */}
      {showClashPanel && (
        <div className="clash-inspector-panel">
          <div className="clash-inspector-head">
            <div className="clash-title-wrap">
              <Icon name="warning" size={18} />
              <h4>Real-Time Schedule Clash Detection ({sectionClashes.length})</h4>
            </div>
            <button
              type="button"
              className="clash-close-btn"
              onClick={() => setShowClashPanel(false)}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          {sectionClashes.length === 0 ? (
            <div className="clash-zero-state">
              <Icon name="check" size={20} />
              <span>Perfect! No room double-bookings or faculty overlap detected in {currentSection}.</span>
            </div>
          ) : (
            <div className="clash-items-list">
              {sectionClashes.map(({ slot, issue }, idx) => {
                const c = data.courses.find((cr) => cr.id === slot.courseId)
                const f = data.faculty.find((fa) => fa.id === slot.facultyId)
                return (
                  <div key={idx} className="clash-item-card">
                    <div className="clash-item-meta">
                      <strong>{c?.code}</strong>
                      <span>
                        {DAY_NAMES[slot.day]} · {periodLabel(slot.period)}
                      </span>
                      <span>Faculty: {f?.name}</span>
                    </div>
                    <div className="clash-item-desc">{issue.message}</div>
                    <button
                      type="button"
                      className="btn-clash-resolve"
                      onClick={() => onEditSlot(slot)}
                    >
                      Resolve Slot
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 3D Glass Weekly Matrix */}
      <div className="builder-table-wrap">
        <table className="builder-grid-table">
          <thead>
            <tr>
              <th className="th-time-column">Period & Time</th>
              {days.map((day) => (
                <th key={day} className="th-day-column">
                  <span className="th-day-name">{DAY_NAMES[day]}</span>
                  <span className="th-day-badge">
                    {sectionSlots.filter((s) => s.day === day).length} slots
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p.period} className="builder-grid-row">
                <td className="td-time-cell">
                  <div className="time-cell-content">
                    <span className="period-index">P{p.period}</span>
                    <span className="period-timing">{p.label}</span>
                  </div>
                </td>

                {days.map((day) => {
                  const slot = sectionSlots.find((s) => s.day === day && s.period === p.period)
                  const isDragTarget = dragOverCell?.day === day && dragOverCell?.period === p.period

                  if (!slot) {
                    return (
                      <td
                        key={day}
                        className={`td-slot-cell td-empty-drop ${isDragTarget ? 'drag-over-active' : ''}`}
                        onDragOver={(e) => handleDragOver(e, day, p.period)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, day, p.period)}
                      >
                        <button
                          type="button"
                          className="btn-slot-empty"
                          onClick={() => onAddSlot({ day, period: p.period, section: currentSection })}
                        >
                          <Icon name="plus" size={14} />
                          <span>Assign Lecture</span>
                        </button>
                      </td>
                    )
                  }

                  const course = data.courses.find((c) => c.id === slot.courseId)
                  const faculty = data.faculty.find((f) => f.id === slot.facultyId)
                  const room = data.rooms.find((r) => r.id === slot.roomId)
                  const tone = colorFor(course?.code ?? '')
                  const isDraggingThis = draggedSlot?.id === slot.id

                  return (
                    <td
                      key={day}
                      className={`td-slot-cell ${isDragTarget ? 'drag-over-swap' : ''}`}
                      onDragOver={(e) => handleDragOver(e, day, p.period)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, p.period)}
                    >
                      <div
                        className={`lecture-card-3d tone-${tone} ${isDraggingThis ? 'is-dragging' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, slot)}
                        onClick={() => onEditSlot(slot)}
                      >
                        <div className="card-top-strip">
                          <span className="course-code-tag">{course?.code}</span>
                          <span className="room-pill">
                            <Icon name="building" size={11} />
                            {room?.name}
                          </span>
                        </div>

                        <div className="course-title-text" title={course?.title}>
                          {course?.title}
                        </div>

                        <div className="card-bottom-meta">
                          <span className="faculty-name-sub">
                            <Icon name="user" size={11} />
                            {faculty ? shortName(faculty.name) : 'Unassigned'}
                          </span>
                          <span className="drag-handle-hint" title="Drag to reorder/swap">
                            ⋮⋮
                          </span>
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="builder-footer-tip">
        <Icon name="info" size={14} />
        <span>
          Tip: Drag any scheduled block directly over an occupied period to automatically swap
          positions, or drop it into an empty cell to reschedule.
        </span>
      </div>
    </div>
  )
}
