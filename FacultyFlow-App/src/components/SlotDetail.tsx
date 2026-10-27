import { DAY_NAMES, PERIODS } from '../data/seed'
import { facultyHours, shortName } from '../lib/timetable'
import type { AvailabilityRow } from '../lib/availability'
import type { AppData, Slot, SubstitutionRequest } from '../types'
import { Icon } from './Icon'

interface SlotDetailProps {
  slot: Slot
  data: AppData
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  onFocus?: () => void
  availability?: AvailabilityRow
  substitute?: SubstitutionRequest | null
}

/** Selected-lecture inspector shown beside the weekly grid. */
export function SlotDetail({ slot, data, onEdit, onDelete, onClose, availability, substitute }: SlotDetailProps) {
  const course = data.courses.find((c) => c.id === slot.courseId)
  const faculty = data.faculty.find((f) => f.id === slot.facultyId)
  const room = data.rooms.find((r) => r.id === slot.roomId)
  // Weekly load is counted within the semester this lecture belongs to.
  const load = faculty ? facultyHours(data, faculty.id, slot.term ?? 'odd') : 0
  const period = PERIODS.find((p) => p.period === slot.period)

  return (
    <aside className="slot-detail" aria-label="Selected lecture">
      <header className="slot-detail-head">
        <h3>{course?.code ?? 'Lecture'}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close lecture details">
          <Icon name="close" size={16} />
        </button>
      </header>
      <div className="slot-detail-body">
        <div>
          <p className="strong" style={{ fontSize: 17 }}>
            {course?.title ?? 'Unassigned course'}
          </p>
          <p className="muted small" style={{ marginTop: 3 }}>
            <Icon name="calendar" size={14} /> {DAY_NAMES[slot.day]} · {period?.label}
          </p>
        </div>

        <div className="detail-grid">
          <div className="detail-pair">
            <span>Faculty</span>
            <strong>{faculty ? shortName(faculty.name) : 'Unassigned'}</strong>
          </div>
          <div className="detail-pair">
            <span>Room</span>
            <strong>{room?.name ?? '—'}</strong>
          </div>
          <div className="detail-pair">
            <span>Section</span>
            <strong className="mono">{slot.section}</strong>
          </div>
          <div className="detail-pair">
            <span>Weekly load</span>
            <strong>
              {load}/{faculty?.maxHours ?? '—'} periods
            </strong>
          </div>
          <div className="detail-pair">
            <span>Office</span>
            <strong>{faculty?.office ?? '—'}</strong>
          </div>
          <div className="detail-pair">
            <span>Availability</span>
            <strong>
              <span className={`status status-${availability?.status.toLowerCase().replace(' ', '-') ?? 'free'}`}>
                {availability?.status ?? 'Free'}
              </span>
            </strong>
          </div>
        </div>

        {substitute ? (
          <div className="sub-reason" style={{ borderColor: 'var(--velvet-border)', background: 'var(--velvet-soft)' }}>
            <strong>Substitution:</strong> {substitute.substituteFacultyName} is covering this period.{' '}
            {substitute.reason && <span>{substitute.reason}</span>}
          </div>
        ) : (
          faculty &&
          faculty.status !== 'Active' && (
            <p className="notice" style={{ padding: '10px 12px', fontSize: 14 }}>
              <Icon name="warning" size={15} />
              <span>
                {shortName(faculty.name)} is marked {faculty.status.toLowerCase()} — assign a substitute from the
                substitution desk.
              </span>
            </p>
          )
        )}

        <div className="slot-detail-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={onEdit}>
            <Icon name="edit" size={15} /> Edit lecture
          </button>
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={onDelete}>
            <Icon name="trash" size={15} /> Remove
          </button>
        </div>
      </div>
    </aside>
  )
}
