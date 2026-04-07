import { supabase } from '@/lib/supabase'

export type ResearchNewsItem = {
  title: string
  url: string
  source?: string | null
  snippet?: string | null
  published_at?: string | null
}

export type FactualGap = { text: string } | string

export type CompanyResearchRow = {
  slug: string
  company_name: string
  ticker: string | null
  items: ResearchNewsItem[]
  synthesis: string | null
  company_narrative: string | null
  media_narrative: string | null
  factual_gaps: FactualGap[]
  fetched_at: string
  error: string | null
  model: string | null
}

function rowFromCache(data: Record<string, unknown>): CompanyResearchRow {
  const items = Array.isArray(data.items) ? (data.items as ResearchNewsItem[]) : []
  return {
    slug: data.slug as string,
    company_name: data.company_name as string,
    ticker: (data.ticker as string | null) ?? null,
    items,
    synthesis: (data.synthesis as string | null) ?? null,
    company_narrative: (data.company_narrative as string | null) ?? null,
    media_narrative: (data.media_narrative as string | null) ?? null,
    factual_gaps: Array.isArray(data.factual_gaps) ? (data.factual_gaps as FactualGap[]) : [],
    fetched_at: data.fetched_at as string,
    error: (data.error as string | null) ?? null,
    model: (data.model as string | null) ?? null,
  }
}

export async function fetchResearchCacheRow(slug: string): Promise<CompanyResearchRow | null> {
  const { data, error } = await supabase
    .from('company_research_cache')
    .select('slug, company_name, ticker, items, synthesis, company_narrative, media_narrative, factual_gaps, fetched_at, error, model')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return rowFromCache(data as Record<string, unknown>)
}

/** Batched cache read for home / watchlist feeds. */
export async function fetchResearchCacheRowsForSlugs(slugs: string[]): Promise<CompanyResearchRow[]> {
  if (slugs.length === 0) return []
  const { data, error } = await supabase
    .from('company_research_cache')
    .select('slug, company_name, ticker, items, synthesis, company_narrative, media_narrative, factual_gaps, fetched_at, error, model')
    .in('slug', slugs)
    .order('fetched_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(rowFromCache)
}

export type WatchlistResearchHighlight = {
  slug: string
  companyName: string
  ticker: string | null
  fetchedAt: string
  item: ResearchNewsItem
}

/** Flatten cached Perplexity items into a single watchlist feed (newest companies first). */
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
