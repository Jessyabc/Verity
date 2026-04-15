/**
 * EntitlementContext — provides subscription status app-wide.
 *
 * Initialises RevenueCat once the Supabase user is known, then exposes:
 *   status  — 'active' | 'inactive' | 'unknown'
 *   loading — true during the initial RC check
 *   refresh — re-check entitlement on demand (call after a purchase)
 *
 * Re-checks whenever the app comes back to the foreground so a subscription
 * that expired in the background is caught without a restart.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { AppState } from 'react-native'

import { useAuth } from '@/contexts/AuthContext'
import {
  getEntitlementStatus,
  initPurchases,
  type EntitlementStatus,
} from '@/lib/purchases'

// ─── Context type ─────────────────────────────────────────────────────────────

type EntitlementContextValue = {
  status: EntitlementStatus
  loading: boolean
  refresh: () => Promise<void>
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { user, initialized: authInitialized } = useAuth()
  const [status, setStatus] = useState<EntitlementStatus>('unknown')
  const [loading, setLoading] = useState(true)

  const check = useCallback(async () => {
    if (!user) {
      setStatus('unknown')
      setLoading(false)
      return
    }
    try {
      const s = await getEntitlementStatus(user.email)
      setStatus(s)
    } catch {
      // Network error — don't penalise the user, keep 'unknown' (access allowed)
      setStatus('unknown')
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.email]) // eslint-disable-line react-hooks/exhaustive-deps

  // Init RevenueCat + first entitlement check when auth resolves
  useEffect(() => {
    if (!authInitialized) return

    if (!user) {
      setStatus('unknown')
      setLoading(false)
      return
    }

    // Identify the user in RC using their Supabase UUID
    initPurchases(user.id)
    setLoading(true)
    void check()
  }, [user?.id, authInitialized]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check whenever the app returns to the foreground
  useEffect(() => {
    if (!user) return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check()
    })
    return () => sub.remove()
  }, [user?.id, check]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <EntitlementContext.Provider value={{ status, loading, refresh: check }}>
      {children}
    </EntitlementContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEntitlement(): EntitlementContextValue {
  const ctx = useContext(EntitlementContext)
  if (!ctx) throw new Error('useEntitlement must be used within EntitlementProvider')
  return ctx
}
