/**
 * Auto-refreshing watchlist digest hook.
 *
 * Behaviour:
 *  - Fetches the stored digest on mount.
 *  - If stale (>6h, watchlist changed, or no digest yet) triggers silent
 *    background regeneration immediately — no spinner, no user action.
 *  - Polls for an updated row every 8 seconds while `is_generating` is true.
 *  - Re-checks staleness every 30 minutes while the app is in the foreground.
 *  - On login the hook remounts (user changes) → triggers fresh check.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { formatUnknownError } from '@/lib/format'
import {
  fetchWatchlistDigest,
  isDigestStale,
  triggerDigestRegeneration,
  type WatchlistDigestRow,
} from '@/lib/watchlistDigest'

const POLL_INTERVAL_MS     = 8_000   // poll while generating
const REFRESH_INTERVAL_MS  = 30 * 60 * 1000 // recheck staleness

export function useWatchlistDigest(userId: string | null, slugs: string[]) {
  const [digest, setDigest] = useState<WatchlistDigestRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const triggeredRef = useRef(false)

  const stopPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  const startPoll = useCallback((uid: string) => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const row = await fetchWatchlistDigest(uid)
        if (row) {
          setDigest(row)
          if (!row.is_generating) stopPoll()
        }
      } catch { /* silent */ }
    }, POLL_INTERVAL_MS)
  }, [])

  const checkAndRefresh = useCallback(async (uid: string, currentSlugs: string[]) => {
    if (!uid || currentSlugs.length === 0) return
    try {
      const row = await fetchWatchlistDigest(uid)
      if (row) setDigest(row)

      if (isDigestStale(row, currentSlugs)) {
        // Fire background regeneration — don't await
        void triggerDigestRegeneration(currentSlugs)
        startPoll(uid)
      }
    } catch (e) {
      setError(formatUnknownError(e))
    }
  }, [startPoll])

  // Initial fetch + stale check on mount / when user or slugs change
  useEffect(() => {
    if (!userId || slugs.length === 0) {
      setDigest(null)
      return
    }

    triggeredRef.current = false
    setLoading(true)
    setError(null)

    void fetchWatchlistDigest(userId)
      .then((row) => {
        setDigest(row)
        setLoading(false)

        if (isDigestStale(row, slugs) && !triggeredRef.current) {
          triggeredRef.current = true
          void triggerDigestRegeneration(slugs)
          startPoll(userId)
        } else if (row?.is_generating) {
          startPoll(userId)
        }
      })
      .catch((e) => {
        setError(formatUnknownError(e))
        setLoading(false)
      })

    return () => stopPoll()
  }, [userId, slugs.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic staleness re-check (every 30 min while foregrounded)
  useEffect(() => {
    if (!userId || slugs.length === 0) return

    refreshRef.current = setInterval(() => {
      if (AppState.currentState === 'active') {
        void checkAndRefresh(userId, slugs)
      }
    }, REFRESH_INTERVAL_MS)

    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current)
    }
  }, [userId, slugs.join('|'), checkAndRefresh]) // eslint-disable-line react-hooks/exhaustive-deps

  // Also re-check whenever app comes back to foreground
  useEffect(() => {
    if (!userId || slugs.length === 0) return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkAndRefresh(userId, slugs)
    })
    return () => sub.remove()
  }, [userId, slugs.join('|'), checkAndRefresh]) // eslint-disable-line react-hooks/exhaustive-deps

  return { digest, loading, error }
}
