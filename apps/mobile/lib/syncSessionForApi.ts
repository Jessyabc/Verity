import { supabase } from '@/lib/supabase'

/**
 * PostgREST sends 401 (e.g. PGRST301) when the access JWT is expired. `getSession()` can still
 * return the cached session briefly; refresh before RPC/table calls that require `authenticated`.
 */
export async function syncSessionForApi(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.expires_at) return
  const expiresAtMs = session.expires_at * 1000
  const skewMs = 120_000
  if (expiresAtMs > Date.now() + skewMs) return
  await supabase.auth.refreshSession()
}
