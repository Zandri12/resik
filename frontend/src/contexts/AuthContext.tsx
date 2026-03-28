import { createContext, useContext, useEffect, useState } from 'react'
import { authApi, type AuthUser } from '../services/authApi'

export type Permissions = Record<string, boolean>

export type User = AuthUser

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setToken: (token: string) => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const setToken = (token: string) => {
    localStorage.setItem('token', token)
  }

  const loadUser = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const { data } = await authApi.user()
      setUser(data)
    } catch {
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
  }, [])

  const refreshUser = async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const { data } = await authApi.user()
      setUser(data)
    } catch {
      localStorage.removeItem('token')
      setUser(null)
    }
  }

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password)
    setToken(data.token)
    setUser(data.user)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      /* ignore */
    }
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setToken, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
