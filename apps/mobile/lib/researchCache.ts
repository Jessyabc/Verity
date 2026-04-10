import { supabase } from '@/lib/supabase'

export type ResearchNewsItem = {
  title: string
  url: string
  source?: string | null
  snippet?: string | null
  published_at?: string | null
  /** From Edge Function — strict bucket; when missing, UI falls back to URL heuristics. */
  narrative_scope?: 'company' | 'media'
}

/** Stored in JSONB; strings are legacy. Category is optional metadata for UI chips. */
export type FactualGapCategory =
  | 'numeric'
  | 'disclosure'
  | 'timing'
  | 'definition'
  | 'coverage'
  | string

export type FactualGap =
  | string
  | { text: string; category?: FactualGapCategory }

export function factualGapText(g: FactualGap): string {
  return typeof g === 'string' ? g : g.text ?? ''
}

export function factualGapCategory(g: FactualGap): string | undefined {
  if (typeof g === 'string') return undefined
  const c = g.category
  return typeof c === 'string' && c.trim() ? c.trim() : undefined
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
  synthesis: string | null
  company_narrative: string | null
  media_narrative: string | null
  factual_gaps: FactualGap[]
  financial_highlights: FinancialHighlights | null
  fetched_at: string
  error: string | null
  model: string | null
}

function parseFinancialHighlights(raw: unknown): FinancialHighlights | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const period = typeof obj.period === 'string' ? obj.period.trim() : ''
  if (!period) return null
  const period_end = typeof obj.period_end === 'string' ? obj.period_end.trim() || null : null
  const metrics: FinancialMetric[] = []
  if (Array.isArray(obj.metrics)) {
    for (const m of obj.metrics) {
      if (!m || typeof m !== 'object') continue
      const mo = m as Record<string, unknown>
      const label = typeof mo.label === 'string' ? mo.label.trim() : ''
      const value = typeof mo.value === 'string' ? mo.value.trim() : ''
      if (!label || !value) continue
      const yoy = typeof mo.yoy === 'string' ? mo.yoy.trim() || null : null
      metrics.push({ label, value, yoy })
    }
  }
  return { period, period_end, metrics }
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
    financial_highlights: parseFinancialHighlights(data.financial_highlights),
    fetched_at: data.fetched_at as string,
    error: (data.error as string | null) ?? null,
    model: (data.model as string | null) ?? null,
  }
}

const CACHE_SELECT =
  'slug, company_name, ticker, items, synthesis, company_narrative, media_narrative, factual_gaps, financial_highlights, fetched_at, error, model'

export async function fetchResearchCacheRow(slug: string): Promise<CompanyResearchRow | null> {
  const { data, error } = await supabase
    .from('company_research_cache')
    .select(CACHE_SELECT)
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
    .select(CACHE_SELECT)
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
