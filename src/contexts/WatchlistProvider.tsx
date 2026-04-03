import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { WatchlistContext, type WatchlistState } from '@/contexts/watchlist-context'
import { useAuth } from '@/hooks/useAuth'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import {
  deleteWatchlistSlug,
  fetchWatchlistSlugs,
  insertWatchlistSlug,
} from '@/lib/supabase/watchlistQueries'

const STORAGE_PREFIX = 'verity_watchlist_v1'

function keyForUser(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`
}

function readSlugs(userId: string): string[] {
  try {
    const raw = localStorage.getItem(keyForUser(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

function writeSlugs(userId: string, slugs: string[]) {
  localStorage.setItem(keyForUser(userId), JSON.stringify(slugs))
}

function mergeSortedUnique(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort()
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [slugs, setSlugs] = useState<string[]>(() =>
    user ? readSlugs(user.id) : [],
  )

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setSlugs([]))
      return
    }

    if (!isSupabaseConfigured()) {
      queueMicrotask(() => setSlugs(readSlugs(userId)))
      return
    }

    let cancelled = false
    const sb = getSupabaseBrowserClient()

    queueMicrotask(() => {
      void (async () => {
        try {
          const fromDb = await fetchWatchlistSlugs(sb)
          const fromLocal = readSlugs(userId)
          const toAdd = fromLocal.filter((s) => !fromDb.includes(s))
          for (const s of toAdd) {
            try {
              await insertWatchlistSlug(sb, userId, s)
            } catch {
              // duplicate or transient — ignore
            }
          }
          if (cancelled) return
          const merged = mergeSortedUnique(fromDb, fromLocal)
          setSlugs(merged)
          writeSlugs(userId, merged)
        } catch {
          if (!cancelled) setSlugs(readSlugs(userId))
        }
      })()
    })

    return () => {
      cancelled = true
    }
  }, [userId])

  const add = useCallback(
    (slug: string) => {
      if (!user) return
      setSlugs((prev) => {
        if (prev.includes(slug)) return prev
        const next = mergeSortedUnique(prev, [slug])
        writeSlugs(user.id, next)
        return next
      })
      if (!isSupabaseConfigured()) return
      void (async () => {
        try {
          const sb = getSupabaseBrowserClient()
          await insertWatchlistSlug(sb, user.id, slug)
        } catch {
          // optimistic UI; sync retries on next load
        }
      })()
    },
    [user],
  )

  const remove = useCallback(
    (slug: string) => {
      if (!user) return
      setSlugs((prev) => {
        const next = prev.filter((s) => s !== slug)
        writeSlugs(user.id, next)
        return next
      })
      if (!isSupabaseConfigured()) return
      void (async () => {
        try {
          const sb = getSupabaseBrowserClient()
          await deleteWatchlistSlug(sb, slug)
        } catch {
          // optimistic UI
        }
      })()
    },
    [user],
  )

  const isWatched = useCallback(
    (slug: string) => slugs.includes(slug),
    [slugs],
  )

  const toggle = useCallback(
    (slug: string) => {
      if (isWatched(slug)) remove(slug)
      else add(slug)
    },
    [add, remove, isWatched],
  )

  const watchedSet = useMemo(() => new Set(slugs), [slugs])

  const value = useMemo<WatchlistState>(
    () => ({ slugs, watchedSet, add, remove, isWatched, toggle }),
    [slugs, watchedSet, add, remove, isWatched, toggle],
  )

  return (
    <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
  )
}
