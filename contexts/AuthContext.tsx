'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { ensureProfile, isProfileWriteInFlight, logOut } from '@/lib/auth-actions'

interface AuthContextType {
  user: User | null
  loading: boolean
  isAuthenticated: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
  logout: async () => {},
})

const PROTECTED_ROUTES = [
  '/home',
  '/profile',
  '/contacts',
  '/history',
  '/tracking',
  '/emergency',
  '/sos-settings',
  '/safety-tips',
  '/permissions',
]

const AUTH_ROUTES = ['/login', '/signup', '/onboarding']

const matches = (pathname: string, routes: string[]) =>
  routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname() ?? '/'

  // Session restoration: Firebase reports the persisted user (or null) once.
  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)
    })
  }, [])

  // Self-heal: a Firebase account with no SQLite profile (e.g. the server was down at signup) gets one.
  const uid = user?.uid
  useEffect(() => {
    if (!user || isProfileWriteInFlight()) return
    ensureProfile(user).catch((error) => console.warn('Profile sync skipped:', error?.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  useEffect(() => {
    if (loading) return
    // While signup is still writing the profile, let the signup page choose the next screen.
    if (user && isProfileWriteInFlight()) return
    if (!user && matches(pathname, PROTECTED_ROUTES)) {
      router.replace('/login')
    } else if (user && (matches(pathname, AUTH_ROUTES) || pathname === '/')) {
      router.replace('/home')
    }
  }, [user, loading, pathname, router])

  const logout = async () => {
    await logOut()
    router.replace('/login')
  }

  if (loading && matches(pathname, PROTECTED_ROUTES)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Restoring your session…</p>
        </div>
      </div>
    )
  }

  // Never flash a protected screen to a signed-out user while the redirect runs.
  if (!user && matches(pathname, PROTECTED_ROUTES)) return null

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
