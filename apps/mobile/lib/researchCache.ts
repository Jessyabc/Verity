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

export type ResearchChangeSummary = {
  generated_at: string
  previous_fetched_at: string | null
  research_version: number
  bullets: string[]
  sources_added: number
  sources_removed: number
  gaps_added: number
  gaps_removed: number
  metrics_changed: Array<{ label: string; from: string; to: string }>
  company_narrative_changed: boolean
  media_narrative_changed: boolean
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
  change_summary: ResearchChangeSummary | null
  research_version: number
  previous_fetched_at: string | null
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

function parseChangeSummary(raw: unknown): ResearchChangeSummary | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const bullets = Array.isArray(obj.bullets)
    ? obj.bullets.filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
    : []
  if (bullets.length === 0) return null
  const metrics_changed: ResearchChangeSummary['metrics_changed'] = []
  if (Array.isArray(obj.metrics_changed)) {
    for (const m of obj.metrics_changed) {
      if (!m || typeof m !== 'object') continue
      const mo = m as Record<string, unknown>
      const label = typeof mo.label === 'string' ? mo.label.trim() : ''
      const from = typeof mo.from === 'string' ? mo.from.trim() : ''
      const to = typeof mo.to === 'string' ? mo.to.trim() : ''
      if (label && from && to) metrics_changed.push({ label, from, to })
    }
  }
  return {
    generated_at: typeof obj.generated_at === 'string' ? obj.generated_at : '',
    previous_fetched_at:
      typeof obj.previous_fetched_at === 'string' ? obj.previous_fetched_at : null,
    research_version: typeof obj.research_version === 'number' ? obj.research_version : 0,
    bullets,
    sources_added: typeof obj.sources_added === 'number' ? obj.sources_added : 0,
    sources_removed: typeof obj.sources_removed === 'number' ? obj.sources_removed : 0,
    gaps_added: typeof obj.gaps_added === 'number' ? obj.gaps_added : 0,
    gaps_removed: typeof obj.gaps_removed === 'number' ? obj.gaps_removed : 0,
    metrics_changed,
    company_narrative_changed: Boolean(obj.company_narrative_changed),
    media_narrative_changed: Boolean(obj.media_narrative_changed),
  }
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
    change_summary: parseChangeSummary(data.change_summary),
    research_version: typeof data.research_version === 'number' ? data.research_version : 0,
    previous_fetched_at:
      typeof data.previous_fetched_at === 'string' ? data.previous_fetched_at : null,
  }
}

const CACHE_SELECT_FULL =
  'slug, company_name, ticker, items, synthesis, company_narrative, media_narrative, factual_gaps, financial_highlights, fetched_at, error, model, change_summary, research_version, previous_fetched_at'

const CACHE_SELECT_LEGACY =
  'slug, company_name, ticker, items, synthesis, company_narrative, media_narrative, factual_gaps, financial_highlights, fetched_at, error, model'

/** Once true, skip requesting snapshot columns until the app restarts (migration applied). */
let preferLegacyCacheSelect = false

function isMissingSnapshotColumnError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703') return true
  const msg = error.message ?? ''
  return /change_summary|research_version|previous_fetched_at|does not exist/i.test(msg)
}

async function selectCache(opts: {
  slugs?: string[]
  slug?: string
  maybeSingle?: boolean
}): Promise<{ data: unknown; error: { message?: string; code?: string } | null }> {
  const select = preferLegacyCacheSelect ? CACHE_SELECT_LEGACY : CACHE_SELECT_FULL
  let q = supabase.from('company_research_cache').select(select)
  if (opts.slug) q = q.eq('slug', opts.slug)
  if (opts.slugs) q = q.in('slug', opts.slugs).order('fetched_at', { ascending: false })

  const first = opts.maybeSingle ? await q.maybeSingle() : await q
  if (!first.error || preferLegacyCacheSelect || !isMissingSnapshotColumnError(first.error)) {
    return first
  }

  preferLegacyCacheSelect = true
  let legacy = supabase.from('company_research_cache').select(CACHE_SELECT_LEGACY)
  if (opts.slug) legacy = legacy.eq('slug', opts.slug)
  if (opts.slugs) legacy = legacy.in('slug', opts.slugs).order('fetched_at', { ascending: false })
  return opts.maybeSingle ? await legacy.maybeSingle() : await legacy
}

export async function fetchResearchCacheRow(slug: string): Promise<CompanyResearchRow | null> {
  const { data, error } = await selectCache({ slug, maybeSingle: true })
  if (error) throw error
  if (!data) return null
  return rowFromCache(data as Record<string, unknown>)
}

/** Batched cache read for home / watchlist feeds. */
export async function fetchResearchCacheRowsForSlugs(slugs: string[]): Promise<CompanyResearchRow[]> {
  if (slugs.length === 0) return []
  const { data, error } = await selectCache({ slugs })
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
