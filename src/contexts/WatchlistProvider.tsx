import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { WatchlistContext, type WatchlistState } from '@/contexts/watchlist-context'
import { useAuth } from '@/hooks/useAuth'

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

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [slugs, setSlugs] = useState<string[]>(() =>
    user ? readSlugs(user.id) : [],
  )

  const add = useCallback(
    (slug: string) => {
      if (!user) return
      setSlugs((prev) => {
        if (prev.includes(slug)) return prev
        const next = [...prev, slug]
        writeSlugs(user.id, next)
        return next
      })
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
