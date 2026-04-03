import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ReadUpdatesContext, type ReadUpdatesState } from '@/contexts/read-updates-context'
import { useAuth } from '@/hooks/useAuth'

const PREFIX = 'verity_read_updates_v1'

function storageKey(userId: string) {
  return `${PREFIX}:${userId}`
}

function loadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

export function ReadUpdatesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [readIds, setReadIds] = useState<Set<string>>(() =>
    user ? loadIds(user.id) : new Set(),
  )

  const markRead = useCallback(
    (updateId: string) => {
      if (!user || !updateId) return
      setReadIds((prev) => {
        if (prev.has(updateId)) return prev
        const next = new Set(prev)
        next.add(updateId)
        localStorage.setItem(storageKey(user.id), JSON.stringify([...next]))
        return next
      })
    },
    [user],
  )

  const isRead = useCallback(
    (updateId: string) => readIds.has(updateId),
    [readIds],
  )

  const value = useMemo<ReadUpdatesState>(
    () => ({
      markRead,
      isRead,
    }),
    [markRead, isRead],
  )

  return (
    <ReadUpdatesContext.Provider value={value}>
      {children}
    </ReadUpdatesContext.Provider>
  )
}
