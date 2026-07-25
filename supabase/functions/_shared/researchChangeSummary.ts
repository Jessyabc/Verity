/**
 * Deterministic research card diffs for “what changed” memory.
 * Shared by research-company (and any future writers). Keep hallucination-free:
 * URL sets, gap text, metric label/value, narrative equality — no freeform LLM.
 */

export type FactualGapLike = string | { text?: string; category?: string }

export type FinancialMetricLike = { label?: string; value?: string; yoy?: string | null }

export type FinancialHighlightsLike = {
  period?: string
  period_end?: string | null
  metrics?: FinancialMetricLike[]
} | null

export type ResearchItemLike = {
  title?: string
  url?: string
  source?: string | null
}

export type ResearchCardLike = {
  company_narrative?: string | null
  media_narrative?: string | null
  factual_gaps?: FactualGapLike[] | null
  financial_highlights?: FinancialHighlightsLike
  items?: ResearchItemLike[] | null
  fetched_at?: string | null
}

export type MetricDelta = { label: string; from: string; to: string }

export type ChangeSummary = {
  generated_at: string
  previous_fetched_at: string | null
  research_version: number
  bullets: string[]
  sources_added: number
  sources_removed: number
  gaps_added: number
  gaps_removed: number
  metrics_changed: MetricDelta[]
  company_narrative_changed: boolean
  media_narrative_changed: boolean
}

function gapKey(g: FactualGapLike): string {
  if (typeof g === 'string') return g.trim().toLowerCase()
  return String(g?.text ?? '').trim().toLowerCase()
}

function gapLabel(g: FactualGapLike): string {
  if (typeof g === 'string') return g.trim()
  return String(g?.text ?? '').trim()
}

function urlKey(u: string): string {
  try {
    const parsed = new URL(u)
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}`
  } catch {
    return u.trim().toLowerCase()
  }
}

function normNarrative(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

function metricMap(h: FinancialHighlightsLike): Map<string, string> {
  const out = new Map<string, string>()
  const metrics = h?.metrics
  if (!Array.isArray(metrics)) return out
  for (const m of metrics) {
    const label = typeof m?.label === 'string' ? m.label.trim() : ''
    const value = typeof m?.value === 'string' ? m.value.trim() : ''
    if (!label || !value) continue
    out.set(label.toLowerCase(), value)
  }
  return out
}

/** Build a compact change summary, or null when there is nothing meaningful to say. */
export function buildChangeSummary(
  previous: ResearchCardLike,
  current: ResearchCardLike,
  researchVersion: number,
): ChangeSummary | null {
  const prevUrls = new Set(
    (previous.items ?? [])
      .map((i) => (typeof i.url === 'string' ? urlKey(i.url) : ''))
      .filter(Boolean),
  )
  const currUrls = new Set(
    (current.items ?? [])
      .map((i) => (typeof i.url === 'string' ? urlKey(i.url) : ''))
      .filter(Boolean),
  )

  let sources_added = 0
  let sources_removed = 0
  for (const u of currUrls) if (!prevUrls.has(u)) sources_added++
  for (const u of prevUrls) if (!currUrls.has(u)) sources_removed++

  const prevGaps = new Map<string, string>()
  for (const g of previous.factual_gaps ?? []) {
    const k = gapKey(g)
    if (k) prevGaps.set(k, gapLabel(g))
  }
  const currGaps = new Map<string, string>()
  for (const g of current.factual_gaps ?? []) {
    const k = gapKey(g)
    if (k) currGaps.set(k, gapLabel(g))
  }

  const gapsAddedLabels: string[] = []
  const gapsRemovedLabels: string[] = []
  for (const [k, label] of currGaps) if (!prevGaps.has(k)) gapsAddedLabels.push(label)
  for (const [k, label] of prevGaps) if (!currGaps.has(k)) gapsRemovedLabels.push(label)

  const prevMetrics = metricMap(previous.financial_highlights ?? null)
  const currMetrics = metricMap(current.financial_highlights ?? null)
  const metrics_changed: MetricDelta[] = []
  for (const [labelKey, to] of currMetrics) {
    const from = prevMetrics.get(labelKey)
    if (from != null && from !== to) {
      const label =
        (current.financial_highlights?.metrics ?? []).find(
          (m) => (m.label ?? '').trim().toLowerCase() === labelKey,
        )?.label ?? labelKey
      metrics_changed.push({ label, from, to })
    }
  }

  const company_narrative_changed =
    normNarrative(previous.company_narrative) !== normNarrative(current.company_narrative) &&
    Boolean(normNarrative(current.company_narrative) || normNarrative(previous.company_narrative))

  const media_narrative_changed =
    normNarrative(previous.media_narrative) !== normNarrative(current.media_narrative) &&
    Boolean(normNarrative(current.media_narrative) || normNarrative(previous.media_narrative))

  const bullets: string[] = []
  if (sources_added > 0 || sources_removed > 0) {
    const parts: string[] = []
    if (sources_added > 0) parts.push(`${sources_added} new source${sources_added === 1 ? '' : 's'}`)
    if (sources_removed > 0) {
      parts.push(`${sources_removed} source${sources_removed === 1 ? '' : 's'} no longer listed`)
    }
    bullets.push(parts.join(', '))
  }
  if (gapsAddedLabels.length > 0) {
    const sample = gapsAddedLabels.slice(0, 2).join('; ')
    bullets.push(
      gapsAddedLabels.length === 1
        ? `New factual gap: ${sample}`
        : `${gapsAddedLabels.length} new factual gaps (e.g. ${sample})`,
    )
  }
  if (gapsRemovedLabels.length > 0) {
    bullets.push(
      `${gapsRemovedLabels.length} prior gap${gapsRemovedLabels.length === 1 ? '' : 's'} cleared from the card`,
    )
  }
  for (const m of metrics_changed.slice(0, 4)) {
    bullets.push(`${m.label}: ${m.from} → ${m.to}`)
  }
  if (company_narrative_changed) bullets.push('Official narrative updated')
  if (media_narrative_changed) bullets.push('Independent narrative updated')

  if (bullets.length === 0) return null

  return {
    generated_at: new Date().toISOString(),
    previous_fetched_at:
      typeof previous.fetched_at === 'string' ? previous.fetched_at : null,
    research_version: researchVersion,
    bullets: bullets.slice(0, 8),
    sources_added,
    sources_removed,
    gaps_added: gapsAddedLabels.length,
    gaps_removed: gapsRemovedLabels.length,
    metrics_changed: metrics_changed.slice(0, 6),
    company_narrative_changed,
    media_narrative_changed,
  }
}

/** Compact payload for snapshot storage (full card without oversized item bodies). */
export function buildSnapshotPayload(row: {
  company_name?: string
  ticker?: string | null
  company_narrative?: string | null
  media_narrative?: string | null
  factual_gaps?: unknown
  financial_highlights?: unknown
  items?: ResearchItemLike[] | null
  change_summary?: ChangeSummary | null
}): Record<string, unknown> {
  const items = Array.isArray(row.items) ? row.items : []
  return {
    company_name: row.company_name ?? null,
    ticker: row.ticker ?? null,
    company_narrative: row.company_narrative ?? null,
    media_narrative: row.media_narrative ?? null,
    factual_gaps: row.factual_gaps ?? [],
    financial_highlights: row.financial_highlights ?? null,
    items: items.slice(0, 25).map((it) => ({
      title: it.title ?? null,
      url: it.url ?? null,
      source: it.source ?? null,
    })),
  }
}
