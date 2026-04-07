import { supabase } from '@/lib/supabase'

export type CompanyRow = {
  id: string
  slug: string
  name: string
  ticker: string | null
  exchange: string | null
  tagline: string | null
  overview: string | null
  logo_url?: string | null
  created_at: string
}

export async function fetchCompanyBySlug(slug: string): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('id,slug,name,ticker,exchange,tagline,overview,logo_url,created_at')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data as CompanyRow | null
}
