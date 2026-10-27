import { useMemo, useState } from 'react'
import { PERIODS, SEED_BOOKINGS } from '../data/seed'
import { termSlotsFor } from '../lib/availability'
import type { AppStore } from '../state/useAppData'
import type { Room, RoomBooking } from '../types'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'

/** Day of the sample timetable that matches an ISO date (Mon–Sat). */
function dayKeyOf(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] ?? 'Mon'
}

/** "Tue · P3 · CS301 · CSE-2B · Dr. Anita Sharma" for a booked period. */
function classOf(
  booking: RoomBooking,
  slots: ReturnType<typeof termSlotsFor>,
  lookup: AppStore['data'],
) {
  if (!booking.startTime) return null
  const day = dayKeyOf(booking.date)
  const slot = slots.find((s) => s.roomId === booking.roomId && s.day === day && s.period === booking.period)
  if (!slot) return null
  const course = lookup.courses.find((c) => c.id === slot.courseId)
  const faculty = lookup.faculty.find((f) => f.id === slot.facultyId)
  return { slot, course, faculty }
}

export function ClassroomBookingPage({ store }: { store: AppStore }) {
  const { data, activeTerm } = store
  const toast = useToast()
  const [bookings, setBookings] = useState<RoomBooking[]>(SEED_BOOKINGS)
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-22')
  const [selectedBuilding, setSelectedBuilding] = useState<string>('all')
  const [bookingModalOpen, setBookingModalOpen] = useState(false)
  const [targetRoom, setTargetRoom] = useState<Room | null>(null)

  // Booking Form State
  const [purpose, setPurpose] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1)
  const [bookedByName, setBookedByName] = useState('Dr. Anita Sharma')
  const [requestedEquipment, setRequestedEquipment] = useState<string[]>(['Projector'])

  const availableRooms = data.rooms.filter((r) => {
    if (selectedBuilding === 'all') return true
    return r.building.toLowerCase().includes(selectedBuilding.toLowerCase())
  })

  // Timetabled lectures for the day being viewed, so every room can show
  // which class occupies which period.
  const slotsToday = useMemo(() => termSlotsFor(data, activeTerm), [data, activeTerm])
  const bookingRows = useMemo(
    () =>
      [...bookings]
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => a.roomName.localeCompare(b.roomName) || a.period - b.period)
        .map((booking) => ({ booking, lecture: classOf(booking, slotsToday, data) })),
    [bookings, selectedDate, slotsToday, data],
  )

  const openBookingForRoom = (room: Room | null, busy = false) => {
    setTargetRoom(room)
    // Pre-select a free period so an occupied room can still be booked elsewhere in the day.
    if (busy && room) {
      const taken = new Set(
        bookings.filter((b) => b.roomId === room.id && b.date === selectedDate).map((b) => b.period),
      )
      const free = PERIODS.find((p) => !taken.has(p.period))
      setSelectedPeriod(free ? free.period : PERIODS[0].period)
    }
    setBookingModalOpen(true)
  }

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetRoom) return

    const periodObj = PERIODS.find((p) => p.period === selectedPeriod)
    const newBooking: RoomBooking = {
      id: `bk-${Date.now().toString(36)}`,
      roomId: targetRoom.id,
      roomName: targetRoom.name,
      date: selectedDate,
      period: selectedPeriod,
      startTime: periodObj?.start || '09:00',
      endTime: periodObj?.end || '10:00',
      purpose: purpose.trim() || 'Academic Session / Seminar',
      bookedBy: bookedByName,
      department: 'Computer Science & Eng.',
      status: 'Confirmed',
      equipmentRequested: requestedEquipment,
    }

    setBookings([newBooking, ...bookings])
    toast.success(`Booking confirmed for ${targetRoom.name} on ${selectedDate} (${newBooking.startTime} - ${newBooking.endTime}).`)
    setBookingModalOpen(false)
    setPurpose('')
  }

  const cancelBooking = (id: string) => {
    setBookings(bookings.filter((b) => b.id !== id))
    toast.info('Classroom reservation cancelled.')
  }

  return (
    <div className="classroom-booking-page">
      {/* Page Header */}
      <div className="booking-head-card">
        <div>
          <span className="badge-luxury">Smart Infrastructure</span>
          <h2>Classroom & Facility Reservation Portal</h2>
          <p>
            Check live room availability, seating capacities, and equipment bookings for special
            lectures, labs, and research symposiums.
          </p>
        </div>

        {/* Date & Filter Bar */}
        <div className="booking-filters-bar">
          <label className="filter-item">
            <span>Booking Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="booking-input-date"
            />
          </label>

          <label className="filter-item">
            <span>Campus Block</span>
            <select
              value={selectedBuilding}
              onChange={(e) => setSelectedBuilding(e.target.value)}
              className="booking-select"
            >
              <option value="all">All academic blocks</option>
              <option value="B Block">B Block (Tech Wing)</option>
              <option value="C Block">C Block (CSE Complex)</option>
              <option value="D Block">D Block (Electronics)</option>
            </select>
          </label>

          <button type="button" className="btn btn-primary booking-new-btn" onClick={() => openBookingForRoom(null)}>
            <Icon name="plus" size={15} /> New reservation
          </button>
        </div>
      </div>

      {/* Main Grid: Room Cards */}
      <div className="booking-rooms-grid">
        {availableRooms.map((room) => {
          // Check bookings for this date
          const roomBookings = bookings.filter((b) => b.roomId === room.id && b.date === selectedDate)
          const isBusy = roomBookings.length > 0
          const occupied = roomBookings.map((booking) => ({
            booking,
            lecture: classOf(booking, slotsToday, data),
          }))

          return (
            <div
              key={room.id}
              className={`room-reservation-card${isBusy ? ' room-card-occupied' : ' room-card-free'}`}
            >
              <div className="room-card-head">
                <div className="room-name-group">
                  <h3>{room.name}</h3>
                  <span className="room-type-badge">{room.kind}</span>
                </div>
                <span className={`availability-pill ${isBusy ? 'status-reserved' : 'status-available'}`}>
                  {isBusy ? `Occupied · ${roomBookings.length} period${roomBookings.length === 1 ? '' : 's'}` : 'Available'}
                </span>
              </div>

              <div className="room-card-details">
                <div className="room-detail-row">
                  <Icon name="building" size={14} />
                  <span>
                    {room.building} · {room.floor}
                  </span>
                </div>
                <div className="room-detail-row">
                  <Icon name="users" size={14} />
                  <span>
                    Capacity: <strong>{room.capacity} seats</strong>
                  </span>
                </div>
              </div>

              <div className="room-resources-list">
                {room.resources.map((res) => (
                  <span key={res} className="resource-chip">
                    {res}
                  </span>
                ))}
              </div>

              {/* Active bookings for the selected date, one aligned row per period */}
              {occupied.length > 0 && (
                <div className="reservations-block">
                  <p className="reservations-header">Occupied on {selectedDate}</p>
                  <div className="reservation-table" role="table" aria-label={`${room.name} reservations`}>
                    <div className="reservation-head" role="row">
                      <span role="columnheader">Period</span>
                      <span role="columnheader">Room</span>
                      <span role="columnheader">Class</span>
                      <span aria-hidden="true" />
                    </div>
                    {occupied.map(({ booking, lecture }) => (
                      <div className="reservation-row" role="row" key={booking.id}>
                        <span className="res-cell period-cell" role="cell">
                          <span className="period-chip">P{booking.period}</span>
                          <span className="res-time">
                            {booking.startTime} – {booking.endTime}
                          </span>
                        </span>
                        <span className="res-cell room-cell" role="cell">
                          {room.name}
                          <span className="res-sub">{room.building}</span>
                        </span>
                        <span className="res-cell class-cell" role="cell">
                          {lecture?.course ? (
                            <>
                              <span className="res-class-main">
                                <strong className="mono">{lecture.course.code}</strong>
                                <span className="res-section">{lecture.slot.section}</span>
                              </span>
                              <span className="res-sub">{lecture.faculty ? lecture.faculty.name : 'Faculty unassigned'}</span>
                            </>
                          ) : (
                            <>
                              <span className="res-class-main">Reserved</span>
                              <span className="res-sub">{booking.purpose} · {booking.bookedBy}</span>
                            </>
                          )}
                        </span>
                        <span className="res-cell res-actions" role="cell">
                          <button
                            type="button"
                            className="btn-cancel-mini"
                            onClick={() => cancelBooking(booking.id)}
                            title="Cancel reservation"
                            aria-label={`Cancel ${room.name} booking at ${booking.startTime}`}
                          >
                            <Icon name="close" size={12} />
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" className="btn-book-room" onClick={() => openBookingForRoom(room, isBusy)}>
                <Icon name="calendar" size={14} />
                <span>Book This Room</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* Reservations table: every booking for the selected date */}
      <section className="panel flush booking-table-panel">
        <header className="booking-table-head">
          <div>
            <h3>Reservations on {selectedDate}</h3>
            <p className="muted small">Period, room and class are listed side by side for every reservation.</p>
          </div>
          <span className="count-pill">{bookingRows.length} reservation{bookingRows.length === 1 ? '' : 's'}</span>
        </header>
        <div className="table-scroll">
          <table className="data-table booking-table">
            <thead>
              <tr>
                <th scope="col" className="col-period">Period</th>
                <th scope="col" className="col-room">Room</th>
                <th scope="col" className="col-class">Class</th>
                <th scope="col" className="col-status">Status</th>
                <th scope="col" className="ta-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookingRows.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty compact">
                      <p className="empty-title">No reservations on {selectedDate}</p>
                      <p className="muted">Every room is free. Use “Book This Room” above to reserve a period.</p>
                    </div>
                  </td>
                </tr>
              )}
              {bookingRows.map(({ booking, lecture }) => (
                <tr key={booking.id}>
                  <td className="col-period">
                    <div className="cell-stack">
                      <span className="period-chip">P{booking.period}</span>
                      <span className="cell-sub mono">
                        {booking.startTime} – {booking.endTime}
                      </span>
                    </div>
                  </td>
                  <td className="col-room">
                    <div className="cell-stack">
                      <strong>{booking.roomName}</strong>
                      <span className="cell-sub">{data.rooms.find((r) => r.id === booking.roomId)?.building ?? '—'}</span>
                    </div>
                  </td>
                  <td className="col-class">
                    {lecture?.course ? (
                      <div className="cell-stack">
                        <span className="class-line">
                          <strong className="mono">{lecture.course.code}</strong>
                          <span className="section-tag">{lecture.slot.section}</span>
                        </span>
                        <span className="cell-sub">{lecture.course.title}</span>
                        <span className="cell-sub">{lecture.faculty?.name ?? 'Faculty unassigned'}</span>
                      </div>
                    ) : (
                      <div className="cell-stack">
                        <span className="class-line">
                          <strong>Reserved</strong>
                        </span>
                        <span className="cell-sub">{booking.purpose}</span>
                        <span className="cell-sub">{booking.bookedBy}</span>
                      </div>
                    )}
                  </td>
                  <td className="col-status">
                    <span className="availability-pill status-reserved">Occupied</span>
                  </td>
                  <td className="ta-right actions-cell">
                    <div className="row-actions">
                      <button type="button" className="action-btn action-remove" onClick={() => cancelBooking(booking.id)}>
                        <Icon name="trash" size={13} /> Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Booking Form Modal */}
      {bookingModalOpen && (
        <Modal
          open={bookingModalOpen}
          width={560}
          onClose={() => setBookingModalOpen(false)}
          title={targetRoom ? `Reserve ${targetRoom.name}` : 'New reservation'}
          description="Select the room, period, host coordinator and equipment."
        >
          <form onSubmit={handleCreateBooking} className="form">
            <div className="form-row form-row-2">
              <label className="field">
                <span>Room</span>
                <select
                  value={targetRoom?.id ?? ''}
                  onChange={(e) => setTargetRoom(data.rooms.find((r) => r.id === e.target.value) ?? null)}
                  required
                >
                  <option value="" disabled>
                    Select a room
                  </option>
                  {availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} · {room.building}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Date</span>
                <input type="date" value={selectedDate} readOnly className="input-readonly" />
              </label>
            </div>

            <div className="form-row form-row-2">
              <label className="field">
                <span>Time Period</span>
                <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(Number(e.target.value))}>
                  {PERIODS.map((p) => (
                    <option key={p.period} value={p.period}>
                      Period {p.period} ({p.label})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Faculty Coordinator</span>
                <input type="text" value={bookedByName} onChange={(e) => setBookedByName(e.target.value)} required />
              </label>
            </div>

            <label className="field">
              <span>Event / Academic Purpose</span>
              <input
                type="text"
                placeholder="e.g. ACM Guest Lecture on Cloud Native Systems"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
              />
            </label>


            <div className="equipment-checkboxes">
              <span>Requested Resources:</span>
              <div className="checkbox-row">
                {['Projector', 'Smart board', 'Audio system', 'Desktops'].map((eq) => (
                  <label key={eq} className="eq-label">
                    <input
                      type="checkbox"
                      checked={requestedEquipment.includes(eq)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRequestedEquipment([...requestedEquipment, eq])
                        } else {
                          setRequestedEquipment(requestedEquipment.filter((x) => x !== eq))
                        }
                      }}
                    />
                    <span>{eq}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="modal-actions-end">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setBookingModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Confirm Room Reservation
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
