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

export type FinancialMetric = { label: string; value: string; yoy?: string | null }
export type FinancialHighlights = {
  period: string
  period_end?: string | null
  metrics: FinancialMetric[]
}

export type CompanyResearchRow = {
  slug: string
  company_name: string
  ticker: string | null
  items: ResearchNewsItem[]
  fetched_at: string
  error: string | null
  model: string | null
  company_narrative?: string | null
  media_narrative?: string | null
  factual_gaps?: unknown[] | null
  financial_highlights?: FinancialHighlights | null
}

export async function fetchResearchCacheRow(
  slug: string,
): Promise<CompanyResearchRow | null> {
  if (!isSupabaseConfigured()) return null

  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('company_research_cache')
    .select(
      'slug, company_name, ticker, items, fetched_at, error, model, company_narrative, media_narrative, factual_gaps, financial_highlights',
    )
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const items = Array.isArray(data.items) ? (data.items as ResearchNewsItem[]) : []
  const d = data as Record<string, unknown>

  return {
    slug: data.slug as string,
    company_name: data.company_name as string,
    ticker: (data.ticker as string | null) ?? null,
    items,
    fetched_at: data.fetched_at as string,
    error: (data.error as string | null) ?? null,
    model: (data.model as string | null) ?? null,
    company_narrative: typeof d.company_narrative === 'string' ? d.company_narrative : null,
    media_narrative: typeof d.media_narrative === 'string' ? d.media_narrative : null,
    factual_gaps: Array.isArray(d.factual_gaps) ? (d.factual_gaps as unknown[]) : null,
    financial_highlights: (d.financial_highlights as FinancialHighlights | null) ?? null,
  }
}

export async function fetchResearchCacheRowsForSlugs(slugs: string[]): Promise<CompanyResearchRow[]> {
  if (!isSupabaseConfigured() || slugs.length === 0) return []

  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('company_research_cache')
    .select(
      'slug, company_name, ticker, items, fetched_at, error, model, company_narrative, media_narrative, factual_gaps, financial_highlights',
    )
    .in('slug', slugs)
    .order('fetched_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => {
    const items = Array.isArray(row.items) ? (row.items as ResearchNewsItem[]) : []
    const r = row as Record<string, unknown>
    return {
      slug: row.slug as string,
      company_name: row.company_name as string,
      ticker: (row.ticker as string | null) ?? null,
      items,
      fetched_at: row.fetched_at as string,
      error: (row.error as string | null) ?? null,
      model: (row.model as string | null) ?? null,
      company_narrative: typeof r.company_narrative === 'string' ? r.company_narrative : null,
      media_narrative: typeof r.media_narrative === 'string' ? r.media_narrative : null,
      factual_gaps: Array.isArray(r.factual_gaps) ? (r.factual_gaps as unknown[]) : null,
      financial_highlights: (r.financial_highlights as FinancialHighlights | null) ?? null,
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
