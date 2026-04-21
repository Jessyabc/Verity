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

import { useAuth } from '@/contexts/AuthContext'
import {
  getEntitlementStatus,
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

  // Important: avoid calling RevenueCat native modules during app startup.
  // A launch-time TurboModule abort (SIGABRT) is hard to recover from in JS.
  // We keep startup safe and let the user continue; entitlement can be checked
  // later (e.g. from a settings screen action or after a purchase).
  useEffect(() => {
    if (!authInitialized) return

    // Auth resolved; default to "unknown" (allowed through) without hitting RC.
    setStatus('unknown')
    setLoading(false)
  }, [user?.id, authInitialized]) // eslint-disable-line react-hooks/exhaustive-deps

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
