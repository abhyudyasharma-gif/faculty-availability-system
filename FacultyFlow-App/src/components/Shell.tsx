import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './Icon'
import { BrandMark } from './BrandMark'
import { RoleDock } from './RoleDock'
import { useAuth } from '../context/AuthContext'
import type { Page } from '../types-ui'
import type { UserRole } from '../types'

interface NavItem {
  id: Page
  label: string
  icon: IconName
  group: string
  roles?: UserRole[]
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', group: 'Overview' },
  { id: 'timeline', label: 'Activity Timeline', icon: 'clock', group: 'Overview' },
  { id: 'timetable', label: 'Timetable Builder', icon: 'grid', group: 'Planning' },
  { id: 'workload', label: 'Faculty Workload', icon: 'chart', group: 'Planning', roles: ['Admin', 'HOD', 'Faculty'] },
  { id: 'bookings', label: 'Classroom Booking', icon: 'building', group: 'Operations' },
  { id: 'leaves', label: 'Leave & Substitution', icon: 'users', group: 'Operations', roles: ['Admin', 'HOD', 'Faculty'] },
  { id: 'calendar', label: 'Academic Calendar', icon: 'calendar', group: 'Operations' },
  { id: 'faculty', label: 'Faculty Directory', icon: 'users', group: 'Registry' },
  { id: 'courses', label: 'Course Registry', icon: 'book', group: 'Registry' },
  { id: 'rooms', label: 'Classrooms & Labs', icon: 'building', group: 'Registry' },
  { id: 'reports', label: 'Reports & CSV', icon: 'chart', group: 'Administration', roles: ['Admin', 'HOD'] },
  { id: 'settings', label: 'Settings', icon: 'settings', group: 'Administration', roles: ['Admin'] },
]

const PAGE_TITLES: Record<Page, { title: string; crumb: string }> = {
  dashboard: { title: 'Dashboard', crumb: 'Overview' },
  timetable: { title: 'Timetable Builder', crumb: 'Planning' },
  workload: { title: 'Faculty Workload', crumb: 'Analytics' },
  bookings: { title: 'Classroom Booking', crumb: 'Operations' },
  leaves: { title: 'Leave & Substitution', crumb: 'Operations' },
  calendar: { title: 'Academic Calendar', crumb: 'Milestones' },
  timeline: { title: 'Activity Timeline', crumb: 'Overview' },
  faculty: { title: 'Faculty Directory', crumb: 'Registry' },
  courses: { title: 'Course Registry', crumb: 'Registry' },
  rooms: { title: 'Classrooms & Labs', crumb: 'Registry' },
  reports: { title: 'Reports', crumb: 'Administration' },
  settings: { title: 'Settings', crumb: 'Administration' },
}

interface ShellProps {
  page: Page
  onNavigate: (page: Page) => void
  term: string
  search: string
  onSearch: (value: string) => void
  /** Contextual action triggered when the role changes. */
  onRoleContext: (role: UserRole) => void
  children: React.ReactNode
}

export function Shell({ page, onNavigate, term, search, onSearch, onRoleContext, children }: ShellProps) {
  const { user, role, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState({ top: 0, height: 0, visible: false })

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    setMobileNav(false)
    setMenuOpen(false)
  }, [page])

  const meta = PAGE_TITLES[page] || { title: 'FacultyFlow', crumb: 'Portal' }
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role))
  const groups = Array.from(new Set(visibleNavItems.map((item) => item.group)))

  // The active item's indicator slides rather than jumping between links.
  const placeIndicator = () => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector<HTMLElement>('.nav-item.active')
    if (!active) {
      setIndicator((cur) => ({ ...cur, visible: false }))
      return
    }
    const navBox = nav.getBoundingClientRect()
    const box = active.getBoundingClientRect()
    setIndicator({ top: box.top - navBox.top + nav.scrollTop + 9, height: Math.max(20, box.height - 18), visible: true })
  }

  useLayoutEffect(() => {
    placeIndicator()
    const id = window.setTimeout(placeIndicator, 80)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, role, mobileNav])

  const initials = (user?.name || 'FacultyFlow')
    .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*/, '')
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const academicYear = term.includes('·') ? term.split('·').pop()?.trim() : '2026–27'

  return (
    <div className="shell">
      <a className="skip-link" href="#ff-app-main">
        Skip to main content
      </a>

      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <BrandMark />
          <span className="brand-text">
            <strong>FacultyFlow</strong>
            <small>Availability &amp; timetables</small>
          </span>
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="nav" aria-label="Main navigation" ref={navRef}>
          <span
            className="nav-indicator"
            style={{ top: indicator.top, height: indicator.height, opacity: indicator.visible ? 1 : 0 }}
            aria-hidden="true"
          />
          {groups.map((group) => (
            <div className="nav-group" key={group}>
              <p className="nav-label">{group}</p>
              {visibleNavItems
                .filter((item) => item.group === group)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item${page === item.id ? ' active' : ''}`}
                    onClick={() => onNavigate(item.id)}
                    aria-current={page === item.id ? 'page' : undefined}
                  >
                    <Icon name={item.icon} size={18} />
                    <span>{item.label}</span>
                  </button>
                ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <p className="nav-label">Signed in as</p>
          <div className="sidebar-user">
            <span className="avatar avatar-sm">{user?.avatar || initials}</span>
            <span className="user-details-truncate">
              <strong>{user?.name || 'Authorized User'}</strong>
              <small>{user?.title || role}</small>
            </span>
          </div>
          <p className="sidebar-term">
            <span>{term}</span>
          </p>
        </div>
      </aside>

      {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} aria-hidden="true" />}

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn nav-toggle"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Icon name="list" size={20} />
          </button>

          <div className="topbar-title">
            <p className="crumb">{meta.crumb}</p>
            <h1>{meta.title}</h1>
          </div>

          <div className="institution-chip" title={`Academic year ${academicYear}`}>
            <span>Academic year</span>
            <strong>{academicYear}</strong>
          </div>

          <div className="topbar-tools">
            {['faculty', 'courses', 'rooms'].includes(page) && (
              <label className="global-search">
                <Icon name="search" size={16} />
                <input
                  type="search"
                  placeholder="Search this page"
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                  aria-label="Search this page"
                />
                <kbd>/</kbd>
              </label>
            )}

            <div className="profile" ref={menuRef}>
              <button
                type="button"
                className="profile-btn"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="avatar avatar-sm">{user?.avatar || initials}</span>
                <span className="profile-name">
                  <strong>{user?.name || 'Administrator'}</strong>
                  <small>{role}</small>
                </span>
                <Icon name="chevron-down" size={15} />
              </button>

              {menuOpen && (
                <div className="dropdown" role="menu">
                  <div className="dropdown-head">
                    <strong>{user?.name}</strong>
                    <span>{user?.email}</span>
                    <span>{user?.department}</span>
                  </div>

                  {role === 'Admin' && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onNavigate('settings')
                        setMenuOpen(false)
                      }}
                    >
                      <Icon name="settings" size={16} /> Semester &amp; institution settings
                    </button>
                  )}

                  <div className="dropdown-sep" />

                  <button
                    type="button"
                    role="menuitem"
                    className="muted-action"
                    onClick={() => {
                      logout()
                      setMenuOpen(false)
                    }}
                  >
                    <Icon name="logout" size={16} /> Sign out
                  </button>

                  <p className="dropdown-note">
                    Role switching only changes what this interface shows; it is not authentication or authorisation.
                  </p>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content" id="ff-app-main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <RoleDock onRoleChange={onRoleContext} />
      <span className="sr-only" aria-live="polite">
        Signed in as {role} role
      </span>
    </div>
  )
}
