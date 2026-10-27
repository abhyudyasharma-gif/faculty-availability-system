import { useEffect, useState } from 'react'
import { Shell } from './components/Shell'
import { BrandMark } from './components/BrandMark'
import { SlotForm, type SlotDraft } from './components/SlotForm'
import { ToastProvider, useToast } from './components/Toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DAY_NAMES, PERIODS, SECTIONS } from './data/seed'
import { periodLabel } from './lib/timetable'
import { CoursesPage } from './pages/CoursesPage'
import { Dashboard } from './pages/Dashboard'
import { FacultyPage } from './pages/FacultyPage'
import { ReportsPage } from './pages/ReportsPage'
import { RoomsPage } from './pages/RoomsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TimetablePage } from './pages/TimetablePage'
import { WorkloadAnalyticsView } from './pages/WorkloadAnalyticsPage'
import { ClassroomBookingPage } from './pages/ClassroomBookingPage'
import { LeaveSubstitutionPage } from './pages/LeaveSubstitutionPage'
import { AcademicCalendarPage } from './pages/AcademicCalendarPage'
import { ActivityTimelinePage } from './pages/ActivityTimelinePage'
import { AuthPortal } from './pages/AuthPortal'
import { useAppData } from './state/useAppData'
import type { Day, Slot, UserRole } from './types'
import type { Page } from './types-ui'

/** Pages each demo role may open. Frontend demonstration only. */
const ROLE_PAGES: Record<UserRole, Page[]> = {
  Admin: [
    'dashboard', 'timeline', 'timetable', 'workload', 'bookings', 'leaves', 'calendar',
    'faculty', 'courses', 'rooms', 'reports', 'settings',
  ],
  HOD: [
    'dashboard', 'timeline', 'timetable', 'workload', 'bookings', 'leaves', 'calendar',
    'faculty', 'courses', 'rooms', 'reports',
  ],
  Faculty: [
    'dashboard', 'timeline', 'timetable', 'workload', 'bookings', 'leaves', 'calendar',
    'faculty', 'courses', 'rooms',
  ],
}

/**
 * Storage written by removed features (the startup intro and the student role).
 * Only these keys are cleared — settings, the timetable and everything else the
 * app still uses are left untouched.
 */
const OBSOLETE_STORAGE_KEYS = ['facultyflow.intro.completed', 'facultyflow.intro.v1', 'facultyflow.students.v1']

function purgeObsoleteStorage() {
  for (const key of OBSOLETE_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    } catch {
      // Storage blocked (private mode) — nothing to clean up.
    }
  }
  // A saved profile for the removed Student role would reopen a screen that no
  // longer exists, so fall back to the default admin profile instead.
  try {
    const raw = localStorage.getItem('facultyflow_auth_user_v2')
    if (raw && JSON.parse(raw)?.role === 'Student') localStorage.removeItem('facultyflow_auth_user_v2')
  } catch {
    localStorage.removeItem('facultyflow_auth_user_v2')
  }
}

purgeObsoleteStorage()

function Workspace() {
  const store = useAppData()
  const toast = useToast()
  const { isAuthenticated } = useAuth()
  const [page, setPage] = useState<Page>('dashboard')
  const [section, setSection] = useState('CSE-2B')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Slot | null>(null)
  const [preset, setPreset] = useState<Partial<SlotDraft> | null>(null)
  // Cross-page context: the timetable day to open, and the entry just saved.
  const [highlightDay, setHighlightDay] = useState<Day | null>(null)
  const [lastSaved, setLastSaved] = useState<{ id: string; lastSavedAt: number } | null>(null)
  const [savingSlot, setSavingSlot] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.global-search input')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!isAuthenticated) {
    return <AuthPortal onSuccess={() => setPage('dashboard')} />
  }

  const openCreate = (from?: Partial<SlotDraft>) => {
    setEditing(null)
    setPreset({ section, ...from })
    setFormOpen(true)
  }

  const openEdit = (slot: Slot) => {
    setEditing(slot)
    setPreset(null)
    setFormOpen(true)
  }

  /**
   * Saves a lecture to MySQL. When the API reports a clash (faculty, room or
   * section already busy) the form stays open and the conflict is shown.
   */
  const saveSlot = async (draft: SlotDraft) => {
    const course = store.data.courses.find((c) => c.id === draft.courseId)
    const faculty = store.data.faculty.find((f) => f.id === draft.facultyId)
    const room = store.data.rooms.find((r) => r.id === draft.roomId)
    const where = `${DAY_NAMES[draft.day]} ${periodLabel(draft.period)} · ${room?.name} · ${faculty?.name} · ${draft.section}`

    setSavingSlot(true)
    const result = editing
      ? await store.mutations.updateSlot(editing.id, draft, store.activeTerm)
      : await store.mutations.createSlot(draft, store.activeTerm)
    setSavingSlot(false)

    if (!result.ok) {
      const detail = result.conflicts?.length ? `${result.error}: ${result.conflicts.join('; ')}` : result.error
      toast.error(detail ?? 'Could not save the lecture.')
      return
    }

    if (editing) {
      store.commit((current) => current, { action: 'updated', summary: `${course?.code} updated`, detail: where })
      toast.success('Changes saved successfully.')
    } else {
      store.commit((current) => current, { action: 'added', summary: `${course?.code} added to timetable`, detail: where })
      toast.success(`${course?.code} scheduled for ${DAY_NAMES[draft.day]}, ${periodLabel(draft.period)}.`)
    }
    setSection(draft.section)
    setLastSaved({ id: result.data?.id ?? '', lastSavedAt: Date.now() })
    setFormOpen(false)
  }

  const scheduleCourse = (courseId: string) => {
    const course = store.data.courses.find((c) => c.id === courseId)
    openCreate({ courseId, facultyId: course?.facultyId })
  }

  const viewDay = (day: string) => {
    setHighlightDay(day as Day)
    setPage('timetable')
    toast.info(`Weekly timetable opened — ${DAY_NAMES[day as Day]} is highlighted.`)
  }

  const goto = (next: Page) => {
    setPage(next)
    if (['dashboard', 'reports', 'settings'].includes(next)) setSearch('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onRoleContext = (nextRole: UserRole) => {
    if (!ROLE_PAGES[nextRole].includes(page)) {
      setPage('dashboard')
      toast.info(`Role changed to ${nextRole}. Opened a screen available to that role.`)
    }
  }

  return (
    <>
      <div id="ff-app" className="ff-app">
      <Shell
        page={page}
        onNavigate={goto}
        term={store.settings.term}
        search={search}
        onSearch={setSearch}
        onRoleContext={onRoleContext}
      >
        {/* Keyed by page + semester so each screen enters with the shared transition. */}
        <div key={`${page}-${store.activeTerm}`} className="page-frame">
          {page === 'dashboard' && (
            <Dashboard
              store={store}
              section={section}
              onSection={setSection}
              onNavigate={goto}
              onAdd={() => openCreate()}
              onEdit={openEdit}
              onViewSchedule={viewDay}
              lastSaved={lastSaved}
            />
          )}

          {page === 'timetable' && (
            <TimetablePage
              store={store}
              section={section}
              onSection={setSection}
              onAdd={openCreate}
              onEdit={openEdit}
              highlightDay={highlightDay}
              onClearHighlight={() => setHighlightDay(null)}
              lastSaved={lastSaved}
              onShowInCore={viewDay}
            />
          )}

          {page === 'workload' && <WorkloadAnalyticsView store={store} />}
          {page === 'bookings' && <ClassroomBookingPage store={store} />}
          {page === 'leaves' && <LeaveSubstitutionPage store={store} onOpenTimetable={() => setPage('timetable')} />}
          {page === 'calendar' && <AcademicCalendarPage store={store} />}
          {page === 'timeline' && <ActivityTimelinePage store={store} />}

          {page === 'faculty' && (
            <FacultyPage store={store} search={search} onOpenTimetable={() => setPage('timetable')} />
          )}
          {page === 'courses' && <CoursesPage store={store} search={search} onSchedule={scheduleCourse} />}
          {page === 'rooms' && <RoomsPage store={store} search={search} />}
          {page === 'reports' && (
            <ReportsPage
              store={store}
              onFix={(slotId) => {
                const slot = store.data.slots.find((s) => s.id === slotId)
                if (slot) {
                  setSection(slot.section)
                  setHighlightDay(slot.day)
                  openEdit(slot)
                }
              }}
              onNavigateTimetable={() => setPage('timetable')}
            />
          )}
          {page === 'settings' && <SettingsPage store={store} />}
        </div>

        <SlotForm
          open={formOpen}
          data={store.data}
          settings={store.settings}
          editing={editing}
          preset={preset}
          saving={savingSlot}
          onClose={() => setFormOpen(false)}
          onSave={saveSlot}
        />

        <footer className="app-foot">
          <span className="app-foot-brand">
            <BrandMark className="brand-mark brand-mark-sm" />
            <span>FacultyFlow</span>
          </span>
          <span>
            {store.termConfig.label} · {store.termConfig.academicYear} · {PERIODS.length} periods/day ·{' '}
            {SECTIONS.length} sections
          </span>
          <span className={`api-state api-${store.apiStatus}`} title={store.apiError ?? undefined}>
            {store.apiStatus === 'online'
              ? 'Connected to MySQL'
              : store.apiStatus === 'checking'
                ? 'Connecting to database…'
                : 'Offline — start the API to save changes'}
          </span>
        </footer>
      </Shell>
      </div>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Workspace />
      </ToastProvider>
    </AuthProvider>
  )
}
