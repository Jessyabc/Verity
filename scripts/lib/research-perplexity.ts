/**
 * Perplexity Sonar — structured research for company research (Node scripts).
 *
 * Architecture: 3 focused parallel calls
 *   1. Financial Highlights  — structured key metrics from official filings
 *   2. Company Narrative     — official IR/SEC narrative + sources
 *   3. Media Narrative       — independent third-party coverage + factual gaps
 */
import type { ResearchNewsItem } from '../../src/lib/research/types.ts'

const API = 'https://api.perplexity.ai/chat/completions'

export type FinancialMetric = { label: string; value: string; yoy?: string | null }
export type FinancialHighlights = {
  period: string
  period_end?: string | null
  metrics: FinancialMetric[]
}
export type FactualGapRow = { text: string; category?: string }

export type CompanyResearchResult = {
  items: ResearchNewsItem[]
  model: string
  company_narrative: string | null
  media_narrative: string | null
  factual_gaps: FactualGapRow[]
  financial_highlights: FinancialHighlights | null
}

// ─── Shared caller ────────────────────────────────────────────────────────────

async function callPerplexity(
  apiKey: string,
  model: string,
  systemMessage: string,
  userMessage: string,
  opts?: { recencyFilter?: 'month' | 'week' | 'day' },
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ],
  }
  if (opts?.recencyFilter) {
    body.search_recency_filter = opts.recencyFilter
  }

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Perplexity HTTP ${res.status}: ${errText.slice(0, 500)}`)
  }

  const body2 = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = body2.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('Empty Perplexity response')
  }
  return content
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildFinancialHighlightsPrompt(
  companyName: string,
  ticker: string | null,
  currentDate: string,
): string {
  const t = ticker ? ` (${ticker})` : ''
  return (
    `Today is ${currentDate}. Extract structured key financial highlights for ${companyName}${t} ` +
    `from the most recently completed fiscal quarter or annual period.\n\n` +
    `Rules:\n` +
    `- Use ONLY official SEC filings, earnings releases, and investor relations materials.\n` +
    `- Identify the exact fiscal period you are citing (e.g. "Q2 FY2025 ended March 30, 2025"). ` +
    `If the most recent quarter has not been reported yet, use the prior completed quarter.\n` +
    `- Include: total revenue, net income, and the most important segment revenues.\n` +
    `- Express dollar values in billions ($XB) or millions ($XM) with one decimal place.\n` +
    `- Express year-over-year change with a sign (e.g. "+5.1%" or "-2.3%"). Use null if unavailable.\n` +
    `- Cap at 8 metrics. Prioritize top-level totals over granular sub-metrics.\n` +
    `- If you cannot locate reliable data, return an empty metrics array.\n\n` +
    `Respond with ONLY valid JSON (no markdown fences):\n` +
    `{ "period": string, "period_end": string | null, "metrics": [{ "label": string, "value": string, "yoy": string | null }] }`
  )
}

function buildCompanyNarrativePrompt(
  companyName: string,
  ticker: string | null,
  currentDate: string,
): string {
  const t = ticker ? ` (${ticker})` : ''
  return (
    `Today is ${currentDate}. Summarize the official company narrative for ${companyName}${t}.\n\n` +
    `STRICT SOURCE RULES:\n` +
    `- ONLY use: investor relations page, SEC filings (10-K, 10-Q, 8-K), earnings releases, ` +
    `and company press releases.\n` +
    `- NEVER cite third-party news, analyst reports, or independent commentary.\n\n` +
    `Focus on: business strategy, product developments, financial guidance, key operational updates, ` +
    `and management commentary from the most recent earnings call or filing.\n` +
    `Be factual and neutral — no sentiment, no investment advice, no forecasting language.\n` +
    `Do not repeat detailed financial figures; focus on strategy and context.\n\n` +
    `Respond with ONLY valid JSON (no markdown fences):\n` +
    `{\n` +
    `  "company_narrative": string,\n` +
    `  "company_sources": [{ "title": string, "url": string, "source": string|null, "snippet": string|null, "published_at": string|null }]\n` +
    `}\n` +
    `Cap company_sources at 8. Narrative: 2–4 focused paragraphs.`
  )
}

function buildMediaNarrativePrompt(
  companyName: string,
  ticker: string | null,
  currentDate: string,
): string {
  const t = ticker ? ` (${ticker})` : ''
  return (
    `Today is ${currentDate}. Summarize independent third-party coverage and identify factual gaps ` +
    `for ${companyName}${t}.\n\n` +
    `STRICT SOURCE RULES FOR MEDIA NARRATIVE:\n` +
    `- ONLY use: editorial news with journalist bylines, sell-side analyst reports, ` +
    `Seeking Alpha, Yahoo Finance editorial commentary, peer-reviewed papers, ` +
    `university/lab pages, or reputable independent finance creators.\n` +
    `- NEVER use or cite:\n` +
    `  * The company's own website or any subdomain\n` +
    `  * Corporate newsroom, press releases, blog, careers, or investor pages\n` +
    `  * Official company YouTube, LinkedIn, or X/Twitter accounts\n` +
    `  * Syndicated press releases (GlobeNewswire, PR Newswire, Business Wire, Newsfile)\n` +
    `- If independent coverage is limited, explicitly state ` +
    `"Limited independent media and analyst coverage found." ` +
    `Return fewer or zero media_sources rather than padding.\n\n` +
    `FACTUAL GAPS (3–5 items, category objects):\n` +
    `category must be: numeric | disclosure | timing | definition | coverage\n\n` +
    `Respond with ONLY valid JSON (no markdown fences):\n` +
    `{\n` +
    `  "media_narrative": string,\n` +
    `  "media_sources": [{ "title": string, "url": string, "source": string|null, "snippet": string|null, "published_at": string|null }],\n` +
    `  "factual_gaps": [{ "category": "numeric"|"disclosure"|"timing"|"definition"|"coverage", "text": string }]\n` +
    `}\n` +
    `Cap media_sources at 8. Cap factual_gaps at 5.`
  )
}

// ─── Response parsers ─────────────────────────────────────────────────────────

function extractJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.trim()
  let jsonStr = trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) jsonStr = fence[1].trim()
  const parsed = JSON.parse(jsonStr) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Expected a JSON object')
  }
  return parsed as Record<string, unknown>
}

const GAP_CATEGORIES = new Set(['numeric', 'disclosure', 'timing', 'definition', 'coverage'])

function parseFactualGaps(raw: unknown): FactualGapRow[] {
  if (!Array.isArray(raw)) return []
  const out: FactualGapRow[] = []
  for (const g of raw) {
    if (typeof g === 'string') {
      const t = g.trim()
      if (t) out.push({ text: t })
    } else if (g && typeof g === 'object') {
      const o = g as Record<string, unknown>
      const text = typeof o.text === 'string' ? o.text.trim() : ''
      if (!text) continue
      const rawCat = typeof o.category === 'string' ? o.category.trim().toLowerCase() : ''
      const category = GAP_CATEGORIES.has(rawCat) ? rawCat : undefined
      out.push(category ? { text, category } : { text })
    }
    if (out.length >= 5) break
  }
  return out
}

function sanitizeSourceItems(rawItems: unknown[], cap: number): ResearchNewsItem[] {
  const out: ResearchNewsItem[] = []
  if (!Array.isArray(rawItems)) return out
  for (const row of rawItems) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    const url = typeof o.url === 'string' ? o.url.trim() : ''
    if (!title || !url.startsWith('http')) continue
    out.push({
      title,
      url,
      source: typeof o.source === 'string' ? o.source : null,
      snippet: typeof o.snippet === 'string' ? o.snippet : null,
      published_at: typeof o.published_at === 'string' ? o.published_at : null,
    })
    if (out.length >= cap) break
  }
  return out
}

function parseFinancialHighlightsResponse(content: string): FinancialHighlights | null {
  try {
    const obj = extractJsonObject(content)
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
        if (metrics.length >= 8) break
      }
    }
    return { period, period_end, metrics }
  } catch {
    return null
  }
}

function parseCompanyNarrativeResponse(content: string): {
  company_narrative: string | null
  company_sources: ResearchNewsItem[]
} {
  try {
    const obj = extractJsonObject(content)
    return {
      company_narrative:
        typeof obj.company_narrative === 'string' ? obj.company_narrative.trim() || null : null,
      company_sources: sanitizeSourceItems(
        Array.isArray(obj.company_sources) ? obj.company_sources : [],
        8,
      ),
    }
  } catch {
    return { company_narrative: null, company_sources: [] }
  }
}

function parseMediaNarrativeResponse(content: string): {
  media_narrative: string | null
  media_sources: ResearchNewsItem[]
  factual_gaps: FactualGapRow[]
} {
  try {
    const obj = extractJsonObject(content)
    return {
      media_narrative:
        typeof obj.media_narrative === 'string' ? obj.media_narrative.trim() || null : null,
      media_sources: sanitizeSourceItems(
        Array.isArray(obj.media_sources) ? obj.media_sources : [],
        8,
      ),
      factual_gaps: parseFactualGaps(obj.factual_gaps),
    }
  } catch {
    return { media_narrative: null, media_sources: [], factual_gaps: [] }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchCompanyResearchFromPerplexity(
  companyName: string,
  ticker: string | null,
): Promise<CompanyResearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim()
  if (!apiKey) throw new Error('Missing PERPLEXITY_API_KEY')

  const model = process.env.PERPLEXITY_MODEL?.trim() || 'sonar-pro'
  const currentDate = new Date().toISOString().split('T')[0]

  // 3 focused parallel calls
  const [financialContent, companyContent, mediaContent] = await Promise.all([
    callPerplexity(
      apiKey,
      model,
      'You have web search access. Extract financial metrics from official SEC filings and earnings releases only. Return valid JSON only. No markdown fences.',
      buildFinancialHighlightsPrompt(companyName, ticker, currentDate),
    ).catch((err: unknown) => {
      console.warn('Financial highlights call failed:', err instanceof Error ? err.message : String(err))
      return null
    }),

    callPerplexity(
      apiKey,
      model,
      'You have web search access. Use ONLY official IR, SEC filings, earnings releases, and company press releases. Never cite third-party news. Return valid JSON only. No markdown fences.',
      buildCompanyNarrativePrompt(companyName, ticker, currentDate),
    ).catch((err: unknown) => {
      console.warn('Company narrative call failed:', err instanceof Error ? err.message : String(err))
      return null
    }),

    callPerplexity(
      apiKey,
      model,
      'You have web search access. Use ONLY truly independent third-party sources. NEVER cite company websites, subdomains, or syndicated press releases. Return valid JSON only. No markdown fences.',
      buildMediaNarrativePrompt(companyName, ticker, currentDate),
      { recencyFilter: 'month' },
    ).catch((err: unknown) => {
      console.warn('Media narrative call failed:', err instanceof Error ? err.message : String(err))
      return null
    }),
  ])

  if (!financialContent && !companyContent && !mediaContent) {
    throw new Error('All 3 Perplexity calls failed')
  }

  const financial_highlights = financialContent
    ? parseFinancialHighlightsResponse(financialContent)
    : null

  const { company_narrative, company_sources } = companyContent
    ? parseCompanyNarrativeResponse(companyContent)
    : { company_narrative: null, company_sources: [] }

  const { media_narrative, media_sources, factual_gaps } = mediaContent
    ? parseMediaNarrativeResponse(mediaContent)
    : { media_narrative: null, media_sources: [], factual_gaps: [] }

  // Dedupe items by URL
  const seen = new Set<string>()
  const items: ResearchNewsItem[] = []
  for (const item of [...company_sources, ...media_sources]) {
    if (!seen.has(item.url)) {
      seen.add(item.url)
      items.push(item)
    }
  }

  return { items, model, company_narrative, media_narrative, factual_gaps, financial_highlights }
}
