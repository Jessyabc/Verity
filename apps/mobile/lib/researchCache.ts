import { supabase } from '@/lib/supabase'

export type ResearchNewsItem = {
  title: string
  url: string
  source?: string | null
  snippet?: string | null
  published_at?: string | null
}

export type CompanyResearchRow = {
  slug: string
  company_name: string
  ticker: string | null
  items: ResearchNewsItem[]
  fetched_at: string
  error: string | null
  model: string | null
}

export async function fetchResearchCacheRow(slug: string): Promise<CompanyResearchRow | null> {
  const { data, error } = await supabase
    .from('company_research_cache')
    .select('slug, company_name, ticker, items, fetched_at, error, model')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const items = Array.isArray(data.items) ? (data.items as ResearchNewsItem[]) : []
  return {
    slug: data.slug as string,
    company_name: data.company_name as string,
    ticker: (data.ticker as string | null) ?? null,
    items,
    fetched_at: data.fetched_at as string,
    error: (data.error as string | null) ?? null,
    model: (data.model as string | null) ?? null,
  }
}
