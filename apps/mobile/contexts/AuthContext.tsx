import * as Linking from 'expo-linking'
import type { Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { applySessionFromUrl, getEmailMagicLinkRedirect } from '@/lib/authDeepLink'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: Error | null }>
  signUpWithPassword: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null; hint?: string }>
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setInitialized(true)
      return
    }

    let cancelled = false

    const boot = async () => {
      try {
        const initialUrl = await Linking.getInitialURL()
        if (initialUrl) await applySessionFromUrl(initialUrl)
      } catch {
        // Deep link may be malformed; continue with stored session.
      }
      const { data } = await supabase.auth.getSession()
      if (!cancelled) setSession(data.session ?? null)
      if (!cancelled) setInitialized(true)
    }

    void boot()

    const linkSub = Linking.addEventListener('url', ({ url }) => {
      void applySessionFromUrl(url)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      cancelled = true
      linkSub.remove()
      subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Supabase is not configured (missing EXPO_PUBLIC_* env).') }
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Supabase is not configured (missing EXPO_PUBLIC_* env).') }
    }
    if (password.length < 6) {
      return { error: new Error('Password must be at least 6 characters.') }
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    })
    if (error) return { error: new Error(error.message) }
    if (!data.session && data.user) {
      return {
        error: null,
        hint: 'Confirm your email if your Supabase project requires it, then sign in.',
      }
    }
    return { error: null }
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Supabase is not configured (missing EXPO_PUBLIC_* env).') }
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: getEmailMagicLinkRedirect() },
    })
    return { error: error ? new Error(error.message) : null }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading: !initialized,
      initialized,
      signInWithPassword,
      signUpWithPassword,
      signInWithMagicLink,
      signOut,
    }),
    [
      session,
      initialized,
      signInWithPassword,
      signUpWithPassword,
      signInWithMagicLink,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
