import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Icon, type IconName } from './Icon'
import type { UserRole } from '../types'

const ROLES: { role: UserRole; label: string; icon: IconName; hint: string }[] = [
  { role: 'Admin', label: 'Admin', icon: 'shield', hint: 'Dean of academic affairs' },
  { role: 'HOD', label: 'HOD', icon: 'building', hint: 'Department head' },
  { role: 'Faculty', label: 'Faculty', icon: 'book', hint: 'Teaching staff' },
]

interface RoleDockProps {
  onRoleChange: (role: UserRole) => void
}

/**
 * Floating, frosted role switcher pinned to the right-middle edge.
 * Keyboard: ↑/↓ move between roles, Enter/Space selects, Escape collapses.
 */
export function RoleDock({ onRoleChange }: RoleDockProps) {
  const { role, switchRole } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [announce, setAnnounce] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const activeIndex = Math.max(
    0,
    ROLES.findIndex((r) => r.role === role),
  )

  useEffect(() => {
    setAnnounce(`${role} role selected`)
  }, [role])

  const select = (next: UserRole) => {
    if (next === role) return
    switchRole(next)
    onRoleChange(next)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('.role-chip') ?? [])
    const index = buttons.findIndex((b) => b === document.activeElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      buttons[(index + 1 + buttons.length) % buttons.length]?.focus()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
    } else if (e.key === 'Escape') {
      setCollapsed(true)
    }
  }

  return (
    <section
      className={`role-dock${collapsed ? ' is-collapsed' : ''}`}
      aria-label="Role switcher"
      onKeyDown={onKeyDown}
    >
      <div className="role-dock-head">
        <p id="role-dock-title">Switch role</p>
        <button
          type="button"
          className="role-collapse"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-controls="role-dock-list"
          aria-label={collapsed ? 'Expand role switcher' : 'Collapse role switcher'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <Icon name="chevron-left" size={15} strokeWidth={2} />
        </button>
      </div>

      <div
        className="role-list"
        id="role-dock-list"
        role="radiogroup"
        aria-labelledby="role-dock-title"
        ref={listRef}
      >
        <span
          className="role-rail"
          style={{ transform: `translateY(${activeIndex * 40}px)` }}
          aria-hidden="true"
        />
        {ROLES.map(({ role: value, label, icon, hint }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={role === value}
            className={`role-chip${role === value ? ' is-active' : ''}`}
            onClick={() => select(value)}
            title={`${label} — ${hint}`}
          >
            <Icon name={icon} size={16} />
            <span className="role-chip-label">{label}</span>
          </button>
        ))}
      </div>

      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </section>
  )
}
