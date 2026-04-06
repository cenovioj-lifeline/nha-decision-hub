import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  isAdmin: boolean
  isViewer: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  enterViewMode: () => void
  exitViewMode: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isViewer, setIsViewer] = useState(() => sessionStorage.getItem('dhub_viewer') === '1')

  async function checkAdmin(email: string | undefined) {
    if (!email) { setIsAdmin(false); return }
    const { data } = await supabase
      .from('allowed_users')
      .select('is_admin')
      .eq('email', email.toLowerCase())
      .single()
    setIsAdmin(data?.is_admin === true)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        setIsViewer(false)
        await checkAdmin(s.user.email)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        setIsViewer(false)
        sessionStorage.removeItem('dhub_viewer')
        checkAdmin(s.user.email)
      } else {
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      setIsViewer(false)
      sessionStorage.removeItem('dhub_viewer')
    }
    return { error: error as Error | null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  function enterViewMode() {
    setIsViewer(true)
    sessionStorage.setItem('dhub_viewer', '1')
  }

  function exitViewMode() {
    setIsViewer(false)
    sessionStorage.removeItem('dhub_viewer')
  }

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isViewer, loading, signIn, signOut, enterViewMode, exitViewMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
