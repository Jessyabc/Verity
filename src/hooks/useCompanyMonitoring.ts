import { useEffect, useMemo, useState } from 'react'
import { fetchCompanyBundleBySlug } from '@/lib/supabase/monitoringQueries'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export function useCompanyMonitoring(slug: string | undefined) {
  const canFetch = useMemo(
    () => Boolean(slug && isSupabaseConfigured()),
    [slug],
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bundle, setBundle] = useState<Awaited<
    ReturnType<typeof fetchCompanyBundleBySlug>
  > | null>(null)

  useEffect(() => {
    if (!canFetch) return

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setBundle(null)
      setLoading(true)
      setError(null)

      void fetchCompanyBundleBySlug(slug!)
        .then((b) => {
          if (!cancelled) {
            setBundle(b)
            setLoading(false)
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : String(e))
            setBundle(null)
            setLoading(false)
          }
        })
    })

    return () => {
      cancelled = true
    }
  }, [canFetch, slug])

  return {
    loading: canFetch && loading,
    error: canFetch ? error : null,
    bundle: canFetch ? bundle : null,
  }
}
