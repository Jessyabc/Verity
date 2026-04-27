import { supabase } from '@/lib/supabase'

const REFRESH_SKEW_MS = 120_000
const SYNC_TIMEOUT_MS = 12_000

/**
 * PostgREST sends 401 (e.g. PGRST301) when the access JWT is expired. `getSession()` can still
 * return the cached session briefly; refresh before RPC/table calls that require `authenticated`.
 *
 * Hard-capped with a timeout: at iOS resume time the network can be slow to wake up, and a
 * stuck refreshSession call would otherwise pin every UI surface that awaits this helper.
 */
export async function syncSessionForApi(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.expires_at) return
  const expiresAtMs = session.expires_at * 1000
  if (expiresAtMs > Date.now() + REFRESH_SKEW_MS) return

  let timer: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Auth refresh timed out after ${SYNC_TIMEOUT_MS}ms`)),
      SYNC_TIMEOUT_MS,
    )
  })
  try {
    await Promise.race([supabase.auth.refreshSession(), timeout])
  } catch (err) {
    // Don't block the upcoming API call — let it run with whatever bearer the
    // fetch wrapper resolves. The request itself is also time-bounded, so the
    // worst case is a fast 401 instead of a multi-minute UI freeze.
    if (__DEV__) console.warn('[syncSessionForApi] refresh failed', err)
  } finally {
    if (timer) clearTimeout(timer)
  }
}
