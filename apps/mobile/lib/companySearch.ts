import { PostgrestError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'
import { syncSessionForApi } from '@/lib/syncSessionForApi'

function isJwtAuthError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as PostgrestError
  if (e.code === 'PGRST301') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('jwt') || m.includes('expired') || m.includes('authorization')
}

export type SearchCompanyRow = {
  id: string
  slug: string
  name: string
  ticker: string | null
  exchange: string | null
  cik: string | null
  logo_url?: string | null
}

/**
 * Same RPC as the Vite web app (`search_companies`). Requires an authenticated session.
 */
export async function searchCompanies(
  query: string,
  limit = 20,
): Promise<SearchCompanyRow[]> {
  await syncSessionForApi()
  let { data, error } = await supabase.rpc('search_companies', {
    p_query: query.trim(),
    p_limit: limit,
  })
  if (error && isJwtAuthError(error)) {
    await supabase.auth.refreshSession()
    ;({ data, error } = await supabase.rpc('search_companies', {
      p_query: query.trim(),
      p_limit: limit,
    }))
  }
  if (error) throw error
  return (data ?? []) as SearchCompanyRow[]
}
