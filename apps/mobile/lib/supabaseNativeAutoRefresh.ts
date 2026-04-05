import { AppState, type AppStateStatus, Platform } from 'react-native'

import { isSupabaseConfigured, supabase } from '@/lib/supabase'

/**
 * React Native is not a browser: Supabase does not run the JWT refresh timer until you call
 * `startAutoRefresh()` while the app is foregrounded. Without this, `getSession()` can keep
 * returning an expired access token → PostgREST 401 / "Invalid JWT".
 *
 * @see https://supabase.com/docs/reference/javascript/auth-startautorefresh
 */
export function registerSupabaseNativeAuthAutoRefresh(): () => void {
  if (Platform.OS === 'web' || !isSupabaseConfigured()) {
    return () => {}
  }

  const sync = (state: AppStateStatus) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh()
    } else {
      void supabase.auth.stopAutoRefresh()
    }
  }

  sync(AppState.currentState)

  const sub = AppState.addEventListener('change', sync)

  return () => {
    sub.remove()
    void supabase.auth.stopAutoRefresh()
  }
}
