import { useEffect, useMemo, useState } from 'react'
import { fetchRecentDocumentsForSlugs } from '@/lib/supabase/monitoringQueries'
import type { RecentDbDoc } from '@/lib/supabase/monitoringQueries'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export function useRecentDbDocuments(slugs: string[], limit = 12) {
  const key = useMemo(() => slugs.slice().sort().join('|'), [slugs])
  const canFetch = isSupabaseConfigured() && slugs.length > 0

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<RecentDbDoc[]>([])

  useEffect(() => {
    if (!canFetch) return

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setRows([])
      setLoading(true)
      setError(null)

      void fetchRecentDocumentsForSlugs(slugs, limit)
        .then((r) => {
          if (!cancelled) {
            setRows(r)
            setLoading(false)
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : String(e))
            setRows([])
            setLoading(false)
          }
        })
    })

    return () => {
      cancelled = true
    }
  }, [canFetch, key, limit, slugs])

  return {
    loading: canFetch && loading,
    error: canFetch ? error : null,
    rows: canFetch ? rows : [],
  }
}
