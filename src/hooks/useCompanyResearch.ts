import { useCallback, useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import {
  fetchResearchCacheRow,
  type CompanyResearchRow,
} from '@/lib/supabase/researchQueries'

export function useCompanyResearch(
  slug: string | undefined,
  companyName: string,
  ticker: string | null,
) {
  const [row, setRow] = useState<CompanyResearchRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!slug || !isSupabaseConfigured()) return
    setLoading(true)
    setError(null)
    try {
      const r = await fetchResearchCacheRow(slug)
      setRow(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(async () => {
    if (!slug || !isSupabaseConfigured()) return
    setRefreshing(true)
    setError(null)
    try {
      const sb = getSupabaseBrowserClient()
      const { data, error: fnErr } = await sb.functions.invoke<{
        ok?: boolean
        error?: string
      }>('research-company', {
        body: { slug, companyName, ticker },
      })
      if (fnErr) throw new Error(fnErr.message)
      if (data && typeof data === 'object' && data.error) {
        throw new Error(String(data.error))
      }
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRefreshing(false)
    }
  }, [slug, companyName, ticker, load])

  return { row, loading, refreshing, error, refresh, reload: load }
}
