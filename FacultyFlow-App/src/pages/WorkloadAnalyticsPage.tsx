import { useMemo, useState } from 'react'
import { DEPARTMENTS } from '../data/seed'
import { facultyLoad } from '../lib/timetable'
import type { AppStore } from '../state/useAppData'
import { Icon } from '../components/Icon'

export function WorkloadAnalyticsView({ store }: { store: AppStore }) {
  const { data, settings } = store
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [selectedFacultyId, setSelectedFacultyId] = useState<string | null>(null)

  const facultyList = useMemo(() => {
    return data.faculty.filter((f) => (selectedDept === 'all' ? true : f.department === selectedDept))
  }, [data.faculty, selectedDept])

  const loadData = useMemo(() => {
    return facultyList.map((f) => {
      const load = facultyLoad(data, f)
      const assignedSlots = data.slots.filter((s) => s.facultyId === f.id)
      const daysCount = new Set(assignedSlots.map((s) => s.day)).size
      return {
        faculty: f,
        hours: load.hours,
        maxHours: f.maxHours,
        pct: load.pct,
        daysCount,
        slots: assignedSlots,
      }
    })
  }, [data, facultyList])

  // Aggregate metrics
  const totalPeriods = loadData.reduce((acc, curr) => acc + curr.hours, 0)
  const averageLoad = loadData.length ? Math.round(totalPeriods / loadData.length) : 0
  const overUtilized = loadData.filter((l) => l.pct >= 90).length
  const optimalUtilized = loadData.filter((l) => l.pct >= 60 && l.pct < 90).length
  const underUtilized = loadData.filter((l) => l.pct < 60).length

  const selectedFacultyItem = selectedFacultyId
    ? loadData.find((l) => l.faculty.id === selectedFacultyId)
    : loadData[0]

  return (
    <div className="workload-analytics-view">
      {/* Top Banner */}
      <div className="workload-hero-header">
        <div className="workload-title-box">
          <span className="badge-luxury">Departmental Intelligence</span>
          <h2>Faculty Workload & Period Distribution Analytics</h2>
          <p>
            Real-time tracking of lecture hours, free periods, faculty caps, and teaching load
            distributions for {settings.term}.
          </p>
        </div>

        {/* Filter */}
        <div className="dept-filter-wrap">
          <label>Filter Department</label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="analytics-select"
          >
            <option value="all">All Departments ({data.faculty.length} Staff)</option>
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="analytics-metrics-grid">
        <div className="analytics-metric-card border-ice-blue">
          <div className="metric-icon-wrap bg-ice">
            <Icon name="chart" size={20} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Total Assigned Hours</span>
            <span className="metric-number text-ice">{totalPeriods}</span>
            <span className="metric-sub">Periods across all visible faculty</span>
          </div>
        </div>

        <div className="analytics-metric-card border-lavender">
          <div className="metric-icon-wrap bg-lavender">
            <Icon name="clock" size={20} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Average Department Load</span>
            <span className="metric-number text-lavender">{averageLoad} hrs/wk</span>
            <span className="metric-sub">Target institutional baseline: 16 hrs</span>
          </div>
        </div>

        <div className="analytics-metric-card border-red-velvet">
          <div className="metric-icon-wrap bg-velvet">
            <Icon name="warning" size={20} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Near Capacity (≥90%)</span>
            <span className="metric-number text-velvet">{overUtilized} Faculty</span>
            <span className="metric-sub">Requires workload re-balancing</span>
          </div>
        </div>

        <div className="analytics-metric-card border-pearl">
          <div className="metric-icon-wrap bg-pearl">
            <Icon name="check" size={20} />
          </div>
          <div className="metric-content">
            <span className="metric-label">Optimal Band (60-89%)</span>
            <span className="metric-number text-pearl">{optimalUtilized} Faculty</span>
            <span className="metric-sub">{underUtilized} below 60% capacity</span>
          </div>
        </div>
      </div>

      {/* Main Analytics Layout */}
      <div className="workload-content-grid">
        {/* Left Column: Interactive Visual Bars */}
        <div className="workload-bars-card">
          <div className="card-header-row">
            <h3>Faculty Capacity Distribution</h3>
            <span className="header-tag">Live Period Allotment</span>
          </div>

          <div className="workload-bars-list">
            {loadData.map(({ faculty, hours, maxHours, pct, daysCount }) => {
              const isSelected = selectedFacultyItem?.faculty.id === faculty.id
              const isNearCap = pct >= 90
              const barColor = isNearCap
                ? 'var(--velvet-mid)'
                : pct >= 65
                  ? 'var(--ice-mid)'
                  : 'var(--lavender-mid)'

              return (
                <div
                  key={faculty.id}
                  className={`workload-bar-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedFacultyId(faculty.id)}
                >
                  <div className="bar-meta-top">
                    <div className="faculty-info-left">
                      <strong>{faculty.name}</strong>
                      <span className="text-muted-xs">
                        {faculty.designation} · {faculty.department}
                      </span>
                    </div>
                    <div className="faculty-numbers-right">
                      <span className="load-ratio">
                        <strong>{hours}</strong> / {maxHours} hrs
                      </span>
                      <span className={`load-badge ${isNearCap ? 'cap-alert' : ''}`}>
                        {pct}% load
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        backgroundColor: barColor,
                      }}
                    />
                  </div>

                  <div className="bar-sub-info">
                    <span>{daysCount} teaching days this week</span>
                    <span>{Math.max(0, maxHours - hours)} free hours remaining</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Deep Inspector for Selected Faculty */}
        {selectedFacultyItem && (
          <div className="workload-detail-card">
            <div className="detail-head">
              <span className="avatar avatar-md">{selectedFacultyItem.faculty.initials}</span>
              <div className="detail-name-wrap">
                <h3>{selectedFacultyItem.faculty.name}</h3>
                <p>
                  {selectedFacultyItem.faculty.empNo} · {selectedFacultyItem.faculty.designation}
                </p>
              </div>
            </div>

            <div className="detail-stats-pills">
              <div className="stat-pill">
                <span>Office</span>
                <strong>{selectedFacultyItem.faculty.office}</strong>
              </div>
              <div className="stat-pill">
                <span>Status</span>
                <strong className={`status-text-${selectedFacultyItem.faculty.status.toLowerCase().replace(' ', '-')}`}>
                  {selectedFacultyItem.faculty.status}
                </strong>
              </div>
              <div className="stat-pill">
                <span>Utilization</span>
                <strong>{selectedFacultyItem.pct}%</strong>
              </div>
            </div>

            <div className="assigned-lectures-section">
              <h4>Scheduled Lectures ({selectedFacultyItem.slots.length})</h4>
              {selectedFacultyItem.slots.length === 0 ? (
                <div className="empty-lecture-box">No lectures currently scheduled.</div>
              ) : (
                <div className="detail-slot-list">
                  {selectedFacultyItem.slots.map((s) => {
                    const cr = data.courses.find((c) => c.id === s.courseId)
                    const rm = data.rooms.find((r) => r.id === s.roomId)
                    return (
                      <div key={s.id} className="detail-slot-pill">
                        <div className="pill-left">
                          <strong>{cr?.code}</strong>
                          <span>
                            {s.day} · Period {s.period}
                          </span>
                        </div>
                        <div className="pill-right">
                          <span className="room-name-badge">{rm?.name}</span>
                          <span className="sec-tag">{s.section}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="detail-guidance-box">
              <Icon name="info" size={15} />
              <span>
                Standard university guideline suggests between 14 to 18 lecture periods for senior
                professors to preserve bandwidth for research.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
