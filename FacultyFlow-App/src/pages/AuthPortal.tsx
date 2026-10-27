import { useState } from 'react'
import { DEMO_USERS } from '../data/seed'
import { Icon } from '../components/Icon'
import { BrandMark } from '../components/BrandMark'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

interface AuthModalProps {
  onSuccess?: () => void
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset'

const ROLE_ICONS: Record<UserRole, 'shield' | 'building' | 'book'> = {
  Admin: 'shield',
  HOD: 'building',
  Faculty: 'book',
}

export function AuthPortal({ onSuccess }: AuthModalProps) {
  const { login } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('admin@kce.ac.in')
  const [password, setPassword] = useState('demo1234')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [selectedRole, setSelectedRole] = useState<UserRole>('Admin')
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleRoleQuickSelect = (role: UserRole) => {
    setSelectedRole(role)
    const user = DEMO_USERS.find((u) => u.role === role)
    if (user) setEmail(user.email)
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    setStatusMsg(null)
    if (!email.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter your institutional email.' })
      return
    }
    if (password.length < 4) {
      setStatusMsg({ type: 'error', text: 'Password must be at least 4 characters.' })
      return
    }
    setIsLoading(true)
    window.setTimeout(() => {
      login(email, selectedRole)
      setIsLoading(false)
      onSuccess?.()
    }, 450)
  }

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    window.setTimeout(() => {
      login(email, selectedRole)
      setIsLoading(false)
      onSuccess?.()
    }, 450)
  }

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setStatusMsg({ type: 'error', text: 'Enter your registered email address.' })
      return
    }
    setIsLoading(true)
    window.setTimeout(() => {
      setIsLoading(false)
      setStatusMsg({ type: 'success', text: `Demo reset link prepared for ${email}. Continue to set a new password.` })
      setMode('reset')
    }, 400)
  }

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    window.setTimeout(() => {
      setIsLoading(false)
      setStatusMsg({ type: 'success', text: 'Password updated in the demo session. You can sign in now.' })
      setMode('login')
    }, 400)
  }

  return (
    <div className="auth-portal-page">
      <div className="auth-visual">
        <div className="auth-visual-grid" aria-hidden="true" />
        <div className="auth-brand">
          <BrandMark className="logo-mark" />
          <div>
            <strong>FacultyFlow</strong>
            <span>Availability &amp; timetables</span>
          </div>
        </div>

        <div>
          <h1>Faculty availability &amp; timetable management</h1>
          <p className="lead">
            One workspace for the odd and even semester timetables, faculty availability, substitutions and the academic
            calendar.
          </p>
          <ul className="auth-points">
            <li>
              <Icon name="clock-check" size={18} /> Availability derived from the live timetable and substitution desk
            </li>
            <li>
              <Icon name="grid" size={18} /> Separate odd and even semester schedules with configurable term dates
            </li>
            <li>
              <Icon name="calendar" size={18} /> Month, week and agenda views of exams, holidays and milestones
            </li>
          </ul>
        </div>

        <div className="term-preview">
          <div className="auth-term-pill">
            <strong>Odd Semester</strong>20 Jul – 18 Dec 2026
          </div>
          <div className="auth-term-pill">
            <strong>Even Semester</strong>11 Jan – 28 May 2027
          </div>
        </div>
      </div>

      <div className="auth-form-side">
        <div className="auth-card">
          {mode !== 'login' && (
            <button
              type="button"
              className="auth-back"
              onClick={() => {
                setStatusMsg(null)
                setMode('login')
              }}
            >
              <Icon name="arrow-left" size={15} /> Back to sign in
            </button>
          )}

          <h2>
            {mode === 'login' && 'Sign in'}
            {mode === 'signup' && 'Create a demo login'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Set a new password'}
          </h2>
          <p className="auth-sub">
            {mode === 'login' && 'Pick a demo role below, or enter any college email to explore the workspace.'}
            {mode === 'signup' && 'Demo registrations are stored in this browser only.'}
            {mode === 'forgot' && 'Enter your institutional email to receive a demo reset link.'}
            {mode === 'reset' && `Choose a new demo password for ${email}.`}
          </p>

          {statusMsg && (
            <div className={`auth-alert auth-alert-${statusMsg.type}`} role="status">
              <Icon
                name={statusMsg.type === 'error' ? 'warning' : statusMsg.type === 'success' ? 'check' : 'info'}
                size={17}
              />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin}>
              <div className="auth-field">
                <label htmlFor="auth-email">Institutional email</label>
                <div className="auth-input-wrap">
                  <Icon name="user" size={17} className="auth-input-icon" />
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@kce.ac.in"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="auth-pass">Password</label>
                  <button
                    type="button"
                    className="auth-link-subtle"
                    onClick={() => {
                      setStatusMsg(null)
                      setMode('forgot')
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="auth-input-wrap">
                  <Icon name="shield" size={17} className="auth-input-icon" />
                  <input
                    id="auth-pass"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    style={{ paddingRight: 64 }}
                  />
                  <button
                    type="button"
                    className="auth-pw-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="auth-options-row">
                <label className="auth-checkbox-label">
                  <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  <span>Remember this device</span>
                </label>
                <span className="demo-notice-tag">Demo access</span>
              </div>

              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={isLoading}>
                {isLoading ? (
                  <span className="spinner-inline">Signing in…</span>
                ) : (
                  <>
                    <span>Continue as {selectedRole}</span>
                    <Icon name="arrow-right" size={17} />
                  </>
                )}
              </button>

              <div className="auth-footer-links">
                <span>New to the demo? </span>
                <button
                  type="button"
                  className="auth-link-bold"
                  onClick={() => {
                    setStatusMsg(null)
                    setMode('signup')
                  }}
                >
                  Create a login
                </button>
              </div>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup}>
              <div className="auth-field">
                <label htmlFor="su-name">Full name</label>
                <div className="auth-input-wrap">
                  <Icon name="user" size={17} className="auth-input-icon" />
                  <input id="su-name" type="text" defaultValue="Prof. N. Venkatesh" />
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="su-email">Campus email</label>
                <div className="auth-input-wrap">
                  <Icon name="user" size={17} className="auth-input-icon" />
                  <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="su-pass">Create password</label>
                <div className="auth-input-wrap">
                  <Icon name="shield" size={17} className="auth-input-icon" />
                  <input id="su-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={isLoading}>
                {isLoading ? 'Creating…' : 'Create demo login'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot}>
              <div className="auth-field">
                <label htmlFor="fp-email">Institutional email</label>
                <div className="auth-input-wrap">
                  <Icon name="user" size={17} className="auth-input-icon" />
                  <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={isLoading}>
                {isLoading ? 'Preparing…' : 'Prepare reset link'}
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleReset}>
              <div className="auth-field">
                <label htmlFor="rp-pass">New password</label>
                <div className="auth-input-wrap">
                  <Icon name="shield" size={17} className="auth-input-icon" />
                  <input id="rp-pass" type="password" defaultValue="demo5678" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary auth-submit-btn" disabled={isLoading}>
                {isLoading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}

          <div className="demo-roles">
            <span className="demo-roles-label">Demo roles</span>
            {(['Admin', 'HOD', 'Faculty'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`demo-role-btn${selectedRole === r ? ' is-active' : ''}`}
                onClick={() => handleRoleQuickSelect(r)}
                aria-pressed={selectedRole === r}
              >
                <Icon name={ROLE_ICONS[r]} size={16} />
                {r}
              </button>
            ))}
          </div>

          <p className="auth-disclaimer">
            FacultyFlow demo · data is stored in this browser only. Role switching only changes what the interface
            shows; it is not authentication and does not provide production authorisation.
          </p>
        </div>
      </div>
    </div>
  )
}
