import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEMO_USERS } from '../data/seed'
import type { UserProfile, UserRole } from '../types'

interface AuthContextType {
  user: UserProfile | null
  role: UserRole
  isAuthenticated: boolean
  login: (email: string, role?: UserRole) => boolean
  logout: () => void
  switchRole: (role: UserRole) => void
  updateProfile: (updates: Partial<UserProfile>) => void
}

const AUTH_STORAGE_KEY = 'facultyflow_auth_user_v2'

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY)
      if (stored) return JSON.parse(stored) as UserProfile
    } catch {
      // fallback
    }
    // Default logged in as Dean/Admin for demo discovery or HOD
    return DEMO_USERS[0]
  })

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [user])

  const login = (email: string, requestedRole?: UserRole) => {
    let matched = DEMO_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (!matched && requestedRole) {
      matched = DEMO_USERS.find((u) => u.role === requestedRole)
    }
    if (!matched) {
      matched = DEMO_USERS.find((u) => u.role === (requestedRole || 'Admin')) || DEMO_USERS[0]
    }
    setUser(matched)
    return true
  }

  const logout = () => {
    setUser(null)
  }

  const switchRole = (newRole: UserRole) => {
    const roleUser = DEMO_USERS.find((u) => u.role === newRole)
    if (roleUser) {
      setUser(roleUser)
    }
  }

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!user) return
    setUser({ ...user, ...updates })
  }

  const role: UserRole = user?.role || 'Admin'

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        login,
        logout,
        switchRole,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
