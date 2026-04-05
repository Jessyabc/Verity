import { useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'

import { useAuth } from '@/contexts/AuthContext'

/**
 * Sends signed-out users to sign-in; signed-in users away from the auth stack.
 */
export function useProtectedSession() {
  const { user, loading, initialized } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (!initialized || loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const onCallback = segments[0] === 'auth-callback'

    if (onCallback) return

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/sign-in')
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)')
    }
  }, [user, loading, initialized, segments, router])
}
