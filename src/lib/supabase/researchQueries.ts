import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type { ResearchNewsItem } from '@/lib/research/types'

/** One line in the watchlist “research digest” (flattened from company_research_cache). */
export type WatchlistResearchHighlight = {
  slug: string
  companyName: string
  ticker: string | null
  fetchedAt: string
  item: ResearchNewsItem
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

export async function fetchResearchCacheRow(
  slug: string,
): Promise<CompanyResearchRow | null> {
  if (!isSupabaseConfigured()) return null

  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
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

export async function fetchResearchCacheRowsForSlugs(slugs: string[]): Promise<CompanyResearchRow[]> {
  if (!isSupabaseConfigured() || slugs.length === 0) return []

  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('company_research_cache')
    .select('slug, company_name, ticker, items, fetched_at, error, model')
    .in('slug', slugs)
    .order('fetched_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => {
    const items = Array.isArray(row.items) ? (row.items as ResearchNewsItem[]) : []
    return {
      slug: row.slug as string,
      company_name: row.company_name as string,
      ticker: (row.ticker as string | null) ?? null,
      items,
      fetched_at: row.fetched_at as string,
      error: (row.error as string | null) ?? null,
      model: (row.model as string | null) ?? null,
    }
  })
}

export function flattenWatchlistResearchHighlights(
  rows: CompanyResearchRow[],
  options?: { itemsPerCompany?: number; maxTotal?: number },
): WatchlistResearchHighlight[] {
  const per = options?.itemsPerCompany ?? 2
  const max = options?.maxTotal ?? 12
  const sorted = [...rows].sort(
    (a, b) => new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime(),
  )
  const out: WatchlistResearchHighlight[] = []
  for (const row of sorted) {
    for (const item of row.items.slice(0, per)) {
      if (!item?.title?.trim() || !item?.url?.trim()) continue
      out.push({
        slug: row.slug,
        companyName: row.company_name,
        ticker: row.ticker,
        fetchedAt: row.fetched_at,
        item,
      })
      if (out.length >= max) return out
    }
  }
  return out
}
