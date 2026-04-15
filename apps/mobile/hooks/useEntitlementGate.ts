/**
 * Redirects users with no active entitlement to the paywall.
 *
 * Runs after useProtectedSession (auth gate) — auth always resolves first
 * because both use useEffect and auth initialises synchronously from storage,
 * while the entitlement check is an async RevenueCat network call.
 *
 * Safe defaults:
 *  - 'unknown' (RC not configured, network error) → allow through, never block
 *  - 'active'  → proceed normally
 *  - 'inactive' → replace current route with /paywall
 *
 * Skips the redirect when already on /paywall or /auth-callback to prevent
 * infinite redirect loops.
 */

import { useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useEntitlement } from '@/contexts/EntitlementContext'

export function useEntitlementGate(): void {
  const { user, initialized: authInitialized } = useAuth()
  const { status, loading } = useEntitlement()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    // Wait for both auth and entitlement to resolve before making routing decisions
    if (!authInitialized || loading) return

    // Auth gate handles unauthenticated users — don't double-redirect
    if (!user) return

    // Never redirect away from these screens mid-flow
    const onPaywall    = segments[0] === 'paywall'
    const onCallback   = segments[0] === 'auth-callback'
    const onAuth       = segments[0] === '(auth)'
    if (onPaywall || onCallback || onAuth) return

    if (status === 'inactive') {
      router.replace('/paywall')
    }
  }, [user, authInitialized, status, loading, segments, router])
}
