import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { AuthContext, type User } from '@/contexts/auth-context'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const STORAGE_KEY = 'verity_session_v1'

function loadMockSession(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function mapSupabaseUser(u: SupabaseUser): User {
  return {
    id: u.id,
    email: u.email ?? '',
    name:
      (u.user_metadata?.name as string | undefined) ??
      (u.user_metadata?.full_name as string | undefined),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    typeof window !== 'undefined' && !isSupabaseConfigured()
      ? loadMockSession()
      : null,
  )

  const [authInitialized, setAuthInitialized] = useState(() => {
    if (typeof window === 'undefined') return false
    return !isSupabaseConfigured()
  })

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const sb = getSupabaseBrowserClient()

    void sb.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) setUser(mapSupabaseUser(session.user))
      })
      .finally(() => {
        setAuthInitialized(true)
      })

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? mapSupabaseUser(session.user) : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, name?: string) => {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return

    if (isSupabaseConfigured()) {
      const sb = getSupabaseBrowserClient()
      const redirectTo = `${window.location.origin}/app/watchlist`
      const { error } = await sb.auth.signInWithOtp({
        email: normalized,
        options: {
          emailRedirectTo: redirectTo,
          data: name?.trim() ? { name: name.trim() } : undefined,
        },
      })
      if (error) throw error
      return
    }

    const next: User = {
      id: `usr_${btoa(normalized).slice(0, 12)}`,
      email: normalized,
      name: name?.trim() || undefined,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    setUser(next)
  }, [])

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      const sb = getSupabaseBrowserClient()
      await sb.auth.signOut()
    }
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, authInitialized, signIn, signOut }),
    [user, authInitialized, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
