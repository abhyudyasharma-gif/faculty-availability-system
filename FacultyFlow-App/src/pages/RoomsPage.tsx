import { useState } from 'react'
import { DAYS, PERIODS } from '../data/seed'
import { periodLabel, shortName } from '../lib/timetable'
import type { AppStore } from '../state/useAppData'
import type { Day, Room } from '../types'
import { ConfirmDialog, Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'

interface RoomsPageProps {
  store: AppStore
  search: string
}

type RoomKind = Room['kind']

const emptyRoom: Omit<Room, 'id'> = {
  name: '',
  building: 'B Block',
  floor: '1st floor',
  capacity: 60,
  kind: 'Classroom',
  resources: ['Projector'],
}

const RESOURCE_OPTIONS = ['Projector', 'Smart board', 'Whiteboard', 'Audio system', '40 desktops', 'Linux image', 'PostgreSQL', 'Air conditioning']

export function RoomsPage({ store, search }: RoomsPageProps) {
  const { data, mutations } = store
  const toast = useToast()
  const [kind, setKind] = useState<'all' | RoomKind>('all')
  const [day, setDay] = useState<Day>('Mon')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [draft, setDraft] = useState<Omit<Room, 'id'>>(emptyRoom)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [deleting, setDeleting] = useState<Room | null>(null)

  const term = search.trim().toLowerCase()
  const rooms = data.rooms.filter((r) => {
    if (kind !== 'all' && r.kind !== kind) return false
    if (!term) return true
    return [r.name, r.building, r.kind, ...r.resources].join(' ').toLowerCase().includes(term)
  })

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyRoom)
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (room: Room) => {
    setEditing(room)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...rest } = room
    setDraft(rest)
    setErrors({})
    setFormOpen(true)
  }

  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!/^[A-Z]{1,2}-\d{2,3}$|^Lab-\d$/.test(draft.name.trim())) next.name = 'Use a room label such as B-204, C-305 or Lab-2.'
    if (draft.capacity < 10 || draft.capacity > 200) next.capacity = 'Capacity must be between 10 and 200 seats.'
    if (data.rooms.some((r) => r.name.toLowerCase() === draft.name.trim().toLowerCase() && r.id !== editing?.id)) {
      next.name = 'A room with this label already exists.'
    }
    setErrors(next)
    if (Object.keys(next).length > 0 || saving) return

    setSaving(true)
    const result = await mutations.saveRoom(draft, editing?.id ?? null)
    setSaving(false)
    if (!result.ok) {
      setErrors({ name: result.error ?? 'Could not save the room.' })
      toast.error(result.error ?? 'Could not save the room.')
      return
    }
    toast.success(editing ? `Room ${draft.name} updated.` : `Room ${draft.name} added to the room list.`)
    setFormOpen(false)
  }

  const confirmDelete = async () => {
    if (!deleting) return
    const result = await mutations.deleteRoom(deleting.id)
    if (!result.ok) {
      // Rooms still on the timetable are protected by the API (409).
      toast.error(result.error ?? 'Could not remove the room.')
      setDeleting(null)
      return
    }
    toast.success(`Room ${deleting.name} removed from the room list.`)
    setDeleting(null)
  }

  const toggleResource = (resource: string) => {
    setDraft((d) => ({
      ...d,
      resources: d.resources.includes(resource) ? d.resources.filter((r) => r !== resource) : [...d.resources, resource],
    }))
  }

  const dayBookings = data.slots.filter((s) => s.day === day)
  const utilisation = Math.round((dayBookings.length / (data.rooms.length * PERIODS.length)) * 100)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2 className="greeting">Rooms and laboratories</h2>
          <p className="page-sub">
            {data.rooms.length} rooms available · {dayBookings.length} of {data.rooms.length * PERIODS.length} periods occupied on{' '}
            {DAYS.includes(day) ? day : 'Mon'} ({utilisation}% utilisation).
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Icon name="plus" size={15} /> Add room
        </button>
      </div>

      <div className="rooms-layout">
        <section className="panel flush rooms-list">
          <header className="panel-head">
            <div>
              <h3>Room inventory</h3>
              <p>Allotment is checked when a lecture is scheduled</p>
            </div>
            <div className="seg">
              {(['all', 'Lecture hall', 'Classroom', 'Laboratory'] as const).map((k) => (
                <button key={k} type="button" className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
                  {k === 'all' ? 'All' : k === 'Laboratory' ? 'Labs' : k === 'Lecture hall' ? 'Halls' : 'Classrooms'}
                </button>
              ))}
            </div>
          </header>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Room</th>
                <th scope="col">Type</th>
                <th scope="col" className="num">
                  Seats
                </th>
                <th scope="col">Facilities</th>
                <th scope="col">Today</th>
                <th scope="col" className="ta-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty compact">
                      <p className="empty-title">No rooms match this search</p>
                      <p className="muted">Search by room label, block or facility, for example "projector".</p>
                    </div>
                  </td>
                </tr>
              )}
              {rooms.map((room) => {
                const used = dayBookings.filter((s) => s.roomId === room.id)
                return (
                  <tr key={room.id}>
                    <td>
                      <span className="strong">{room.name}</span>
                      <span className="cell-sub">
                        {room.building} · {room.floor}
                      </span>
                    </td>
                    <td>{room.kind}</td>
                    <td className="num">{room.capacity}</td>
                    <td>
                      <span className="facilities">{room.resources.slice(0, 2).join(', ')}</span>
                      {room.resources.length > 2 && <span className="cell-sub">+{room.resources.length - 2} more</span>}
                    </td>
                    <td>
                      {used.length === 0 ? (
                        <span className="status status-free">Free</span>
                      ) : (
                        <span className="count-pill">
                          {used.length}/{PERIODS.length}
                        </span>
                      )}
                    </td>
                    <td className="ta-right actions-cell">
                      <div className="row-actions" role="group" aria-label={`Actions for ${room.name}`}>
                        <button type="button" className="action-btn action-edit" onClick={() => openEdit(room)}>
                          <Icon name="edit" size={13} /> Edit
                        </button>
                        <button type="button" className="action-btn action-remove" onClick={() => setDeleting(room)}>
                          <Icon name="trash" size={13} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>

        <aside className="panel flush room-board">
          <header className="panel-head">
            <div>
              <h3>Room booking</h3>
              <p>Which rooms are occupied</p>
            </div>
            <select value={day} onChange={(e) => setDay(e.target.value as Day)} aria-label="Day">
              {DAYS.filter((d) => d !== 'Sat' || store.settings.showSaturday).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </header>
          <table className="booking-grid">
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Room</th>
                <th scope="col">Class</th>
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((p) => {
                const bookings = dayBookings.filter((s) => s.period === p.period)
                if (bookings.length === 0) {
                  return (
                    <tr key={p.period} className="booking-empty">
                      <td>
                        <span className="mono">{p.label}</span>
                      </td>
                      <td colSpan={2} className="muted">
                        No lectures scheduled
                      </td>
                    </tr>
                  )
                }
                return bookings.map((slot, index) => {
                  const room = data.rooms.find((r) => r.id === slot.roomId)
                  const course = data.courses.find((c) => c.id === slot.courseId)
                  const faculty = data.faculty.find((f) => f.id === slot.facultyId)
                  return (
                    <tr key={slot.id}>
                      <td>{index === 0 ? <span className="mono">{p.label}</span> : <span className="muted small">…</span>}</td>
                      <td className="strong">{room?.name}</td>
                      <td>
                        <span className="mono">{course?.code}</span>
                        <span className="cell-sub">{[slot.section, faculty ? shortName(faculty.name) : ''].filter(Boolean).join(' · ')}</span>
                      </td>
                    </tr>
                  )
                })
              })}
            </tbody>
          </table>
          <footer className="panel-foot">
            <span>{dayBookings.length} bookings on this day</span>
            <span className="muted">First period {periodLabel(1)}</span>
          </footer>
        </aside>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit room ${editing.name}` : 'Add room'}
        description="Room labels appear on the timetable and in conflict messages."
        width={560}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="room-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add room'}
            </button>
          </>
        }
      >
        <form id="room-form" className="form" onSubmit={save} noValidate>
          <div className="form-row form-row-2">
            <label className={`field${errors.name ? ' has-error' : ''}`}>
              <span>Room label</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.toUpperCase() })} placeholder="B-208" />
              {errors.name && <em className="field-error">{errors.name}</em>}
            </label>
            <label className="field">
              <span>Type</span>
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as RoomKind })}>
                <option>Lecture hall</option>
                <option>Classroom</option>
                <option>Laboratory</option>
              </select>
            </label>
          </div>
          <div className="form-row form-row-3">
            <label className="field">
              <span>Building</span>
              <select value={draft.building} onChange={(e) => setDraft({ ...draft, building: e.target.value })}>
                {['B Block', 'C Block', 'D Block', 'E Block'].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Floor</span>
              <select value={draft.floor} onChange={(e) => setDraft({ ...draft, floor: e.target.value })}>
                {['Ground floor', '1st floor', '2nd floor', '3rd floor'].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className={`field${errors.capacity ? ' has-error' : ''}`}>
              <span>Capacity</span>
              <input type="number" min={10} max={200} value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })} />
              {errors.capacity && <em className="field-error">{errors.capacity}</em>}
            </label>
          </div>
          <div className="field">
            <span>Facilities</span>
            <div className="checkbox-grid">
              {RESOURCE_OPTIONS.map((resource) => (
                <label key={resource} className="check">
                  <input type="checkbox" checked={draft.resources.includes(resource)} onChange={() => toggleResource(resource)} />
                  <span>{resource}</span>
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Remove room?"
        message={
          deleting
            ? `${deleting.name} (${deleting.kind}, ${deleting.capacity} seats) will be removed from the room list. ${
              data.slots.filter((s) => s.roomId === deleting.id).length
            } scheduled period(s) use this room and must be moved to another room first.`
            : ''
        }
        confirmLabel="Remove room"
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
