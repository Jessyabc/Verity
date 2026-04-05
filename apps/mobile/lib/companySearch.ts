import { supabase } from '@/lib/supabase'

export type SearchCompanyRow = {
  id: string
  slug: string
  name: string
  ticker: string | null
  cik: string | null
}

/**
 * Same RPC as the Vite web app (`search_companies`). Requires an authenticated session.
 */
export async function searchCompanies(
  query: string,
  limit = 20,
): Promise<SearchCompanyRow[]> {
  const { data, error } = await supabase.rpc('search_companies', {
    p_query: query.trim(),
    p_limit: limit,
  })
  if (error) throw error
  return (data ?? []) as SearchCompanyRow[]
}
