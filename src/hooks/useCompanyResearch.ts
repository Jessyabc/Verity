import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { messageFromFunctionsInvokeFailure } from '@/lib/supabase/edgeFunctionError'
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

  const load = useCallback(async (): Promise<CompanyResearchRow | null> => {
    if (!slug || !isSupabaseConfigured()) return null
    setLoading(true)
    setError(null)
    try {
      const r = await fetchResearchCacheRow(slug)
      setRow(r)
      return r
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setLoading(false)
    }
  }, [slug])

  const refresh = useCallback(async () => {
    if (!slug || !isSupabaseConfigured()) return
    setRefreshing(true)
    setError(null)
    try {
      const sb = getSupabaseBrowserClient()
      const { data, error: fnErr, response: fnResponse } = await sb.functions.invoke<{
        ok?: boolean
        error?: string
      }>('research-company', {
        body: { slug, companyName, ticker },
      })
      if (fnErr) {
        const msg = await messageFromFunctionsInvokeFailure(fnErr, fnResponse)
        throw new Error(msg)
      }
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

  // Always keep a ref to the latest refresh so the initial-load effect can call
  // it without being listed as a dependency (which would create a cycle).
  const refreshRef = useRef(refresh)
  useEffect(() => { refreshRef.current = refresh })

  // Tracks whether auto-refresh has already been triggered for the current slug.
  const autoRefreshFiredRef = useRef(false)

  useEffect(() => {
    autoRefreshFiredRef.current = false // reset when slug changes
    void load().then((r) => {
      // First visit: no cached research exists → kick off fetch automatically.
      if (r === null && !autoRefreshFiredRef.current) {
        autoRefreshFiredRef.current = true
        void refreshRef.current()
      }
    })
  }, [load])

  return { row, loading, refreshing, error, refresh, reload: load }
}
