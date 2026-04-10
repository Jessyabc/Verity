/**
 * Invoke from the app: supabase.functions.invoke('research-company', { body: { slug, companyName, ticker } })
 * Requires a signed-in user (Authorization: Bearer <access_token>).
 * Secrets: PERPLEXITY_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Architecture: 3 focused parallel Perplexity calls
 *   1. Financial Highlights  — structured key metrics from official filings
 *   2. Company Narrative     — official IR/SEC narrative + sources
 *   3. Media Narrative       — independent third-party coverage + factual gaps
 *
 * Source contamination: after parsing, company-owned and syndicated-press URLs are
 * deterministically removed from media_sources using company_sources roots from DB.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSession } from '../_shared/requireSession.ts'

// ─── Types ────────────────────────────────────────────────────────────────────

type FactualGapRow = { text: string; category?: string }
type FinancialMetric = { label: string; value: string; yoy?: string | null }
type FinancialHighlights = { period: string; period_end?: string | null; metrics: FinancialMetric[] }

// ─── URL / source utilities ───────────────────────────────────────────────────

/** Prefer official / IR / SEC; demote social and video aggregators after the model returns. */
function scoreResearchUrl(url: string): number {
  try {
    const h = new URL(url).hostname.toLowerCase()
    if (h.includes('sec.gov')) return 100
    if (h.endsWith('.gov')) return 75
    if (
      h.startsWith('ir.') ||
      h.startsWith('investors.') ||
      h.includes('.ir.') ||
      h.includes('investor.') ||
      h.includes('investors.') ||
      h.includes('investorrelations') ||
      h.includes('newsroom') ||
      h.includes('pressroom') ||
      h.includes('media.')
    ) {
      return 90
    }
    if (h.includes('youtube.com') || h === 'youtu.be') return -40
    if (
      h.includes('tiktok.com') ||
      h.includes('facebook.com') ||
      h.includes('instagram.com') ||
      h.includes('reddit.com')
    ) {
      return -35
    }
    if (h.includes('twitter.com') || h === 'x.com' || h.endsWith('.x.com')) return -15
    return 30
  } catch {
    return 0
  }
}

function rankResearchItems(items: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...items].sort((a, b) => {
    const ua = typeof a.url === 'string' ? a.url : ''
    const ub = typeof b.url === 'string' ? b.url : ''
    return scoreResearchUrl(ub) - scoreResearchUrl(ua)
  })
}

function sanitizeItems(
  rawItems: unknown[],
  cap = 25,
  narrative_scope?: 'company' | 'media',
): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = []
  for (const row of rawItems) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    const url   = typeof o.url   === 'string' ? o.url.trim()   : ''
    if (!title || !url.startsWith('http')) continue
    const base: Record<string, unknown> = {
      title,
      url,
      source:       typeof o.source       === 'string' ? o.source       : null,
      snippet:      typeof o.snippet      === 'string' ? o.snippet      : null,
      published_at: typeof o.published_at === 'string' ? o.published_at : null,
    }
    if (narrative_scope) base.narrative_scope = narrative_scope
    items.push(base)
    if (items.length >= cap) break
  }
  return items
}

const GAP_CATEGORIES = new Set(['numeric', 'disclosure', 'timing', 'definition', 'coverage'])

function parseFactualGaps(raw: unknown): FactualGapRow[] {
  const factual_gaps: FactualGapRow[] = []
  if (!Array.isArray(raw)) return factual_gaps
  for (const g of raw) {
    if (typeof g === 'string') {
      const t = g.trim()
      if (t) factual_gaps.push({ text: t })
    } else if (g && typeof g === 'object') {
      const o = g as Record<string, unknown>
      const text = typeof o.text === 'string' ? o.text.trim() : ''
      if (!text) continue
      const rawCat = typeof o.category === 'string' ? o.category.trim().toLowerCase() : ''
      const category = GAP_CATEGORIES.has(rawCat) ? rawCat : undefined
      factual_gaps.push(category ? { text, category } : { text })
    }
    if (factual_gaps.length >= 5) break
  }
  return factual_gaps
}

function isUnderOfficialRoot(url: string, officialRoots: string[]): boolean {
  if (!url || officialRoots.length === 0) return false
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`)
    const host = urlObj.hostname.toLowerCase().replace(/^www\./, '')
    return officialRoots.some((root) => {
      const cleanRoot = root.toLowerCase().replace(/^www\./, '')
      return host === cleanRoot || host.endsWith('.' + cleanRoot)
    })
  } catch {
    return false
  }
}

function registrableRootGuess(hostname: string): string | null {
  const h = hostname.toLowerCase().replace(/^www\./, '')
  const parts = h.split('.').filter(Boolean)
  if (parts.length < 2) return null
  // Heuristic: works for .com/.io/.ai; may be imperfect for co.uk-style domains.
  return parts.slice(-2).join('.')
}

function isSyndicatedPressHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '')
  return (
    h === 'prnewswire.com' ||
    h.endsWith('.prnewswire.com') ||
    h === 'globenewswire.com' ||
    h.endsWith('.globenewswire.com') ||
    h === 'businesswire.com' ||
    h.endsWith('.businesswire.com') ||
    h === 'newsfilecorp.com' ||
    h.endsWith('.newsfilecorp.com') ||
    h === 'newsfile.com' ||
    h.endsWith('.newsfile.com')
  )
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Fetch official domain roots from company_sources in the DB. */
async function getOfficialRoots(
  supabase: ReturnType<typeof createClient>,
  companySlug: string,
): Promise<string[]> {
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', companySlug)
    .maybeSingle()

  if (!company?.id) return []

  const { data: sources } = await supabase
    .from('company_sources')
    .select('base_url')
    .eq('company_id', company.id)

  const roots = new Set<string>()
  for (const s of (sources ?? []) as Array<{ base_url: string }>) {
    try {
      const host = new URL(s.base_url).hostname.toLowerCase().replace(/^www\./, '')
      if (host) roots.add(host)
      const rootGuess = registrableRootGuess(host)
      if (rootGuess) roots.add(rootGuess)
    } catch {
      // ignore malformed base_url
    }
  }
  return [...roots]
}

/** Reassign narrative_scope for leaked first-party / syndicated-PR items and dedupe. */
function applySourceReconciliation(
  items: Array<Record<string, unknown>>,
  officialRoots: string[],
): Array<Record<string, unknown>> {
  const reconciled = items.map((item) => {
    const url = typeof item.url === 'string' ? item.url : ''
    if (!url) return item
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
      if (isSyndicatedPressHost(host)) return { ...item, narrative_scope: 'company' }
    } catch {
      // fall through
    }
    if (isUnderOfficialRoot(url, officialRoots)) {
      return { ...item, narrative_scope: 'company' }
    }
    return item
  })

  // Dedupe by URL
  return reconciled.filter((item, index, self) => {
    const url = typeof item.url === 'string' ? item.url : ''
    if (!url) return false
    return index === self.findIndex((t) => (typeof t.url === 'string' ? t.url : '') === url)
  })
}

/**
 * Hard-filter: remove any media source URL that is company-owned or syndicated press.
 * This is the deterministic post-processing layer on top of prompt-based enforcement.
 */
function filterContaminatedMediaSources(
  mediaSources: Array<Record<string, unknown>>,
  officialRoots: string[],
): Array<Record<string, unknown>> {
  return mediaSources.filter((item) => {
    const url = typeof item.url === 'string' ? item.url : ''
    if (!url) return false
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
      if (isSyndicatedPressHost(host)) return false
      if (isUnderOfficialRoot(url, officialRoots)) return false
    } catch {
      // keep item if URL parse fails
    }
    return true
  })
}

// ─── Perplexity caller ────────────────────────────────────────────────────────

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

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Perplexity HTTP ${res.status}: ${errText.slice(0, 400)}`)
  }

  const pjson = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = pjson.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty Perplexity response')
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
    `If the most recent quarter has not yet been reported, use the prior completed quarter.\n` +
    `- Include: total revenue, net income, and the most important segment revenues ` +
    `(e.g. key product categories or geographic segments).\n` +
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
    `Do not repeat financial figures already captured in a separate highlights section; ` +
    `focus on strategy and context.\n\n` +
    `Respond with ONLY valid JSON (no markdown fences):\n` +
    `{\n` +
    `  "company_narrative": string,\n` +
    `  "company_sources": [{ "title": string, "url": string, "source": string|null, "snippet": string|null, "published_at": string|null }]\n` +
    `}\n` +
    `Cap company_sources at 8. The narrative should be 2–4 focused paragraphs.`
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
    `  * Syndicated press releases (GlobeNewswire, PR Newswire, Business Wire, Newsfile) — ` +
    `treat these as company messaging\n` +
    `- If independent coverage is limited, explicitly state ` +
    `"Limited independent media and analyst coverage found." ` +
    `Return fewer or zero media_sources rather than padding with company content.\n\n` +
    `FACTUAL GAPS (3–5 items):\n` +
    `Identify objective discrepancies between what official disclosures state and what independent ` +
    `coverage addresses or contests.\n` +
    `category must be one of: numeric | disclosure | timing | definition | coverage\n` +
    `Do not editorialize or imply intent — state the factual mismatch only.\n` +
    `Do not repeat the same sentence template across bullets.\n\n` +
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
  company_sources: Array<Record<string, unknown>>
} {
  try {
    const obj = extractJsonObject(content)
    return {
      company_narrative:
        typeof obj.company_narrative === 'string' ? obj.company_narrative.trim() || null : null,
      company_sources: Array.isArray(obj.company_sources)
        ? sanitizeItems(obj.company_sources, 8, 'company')
        : [],
    }
  } catch {
    return { company_narrative: null, company_sources: [] }
  }
}

function parseMediaNarrativeResponse(content: string): {
  media_narrative: string | null
  media_sources: Array<Record<string, unknown>>
  factual_gaps: FactualGapRow[]
} {
  try {
    const obj = extractJsonObject(content)
    return {
      media_narrative:
        typeof obj.media_narrative === 'string' ? obj.media_narrative.trim() || null : null,
      media_sources: Array.isArray(obj.media_sources)
        ? sanitizeItems(obj.media_sources, 8, 'media')
        : [],
      factual_gaps: parseFactualGaps(obj.factual_gaps),
    }
  } catch {
    return { media_narrative: null, media_sources: [], factual_gaps: [] }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const auth = await requireSession(req)
    if ('response' in auth) return auth.response

    const body = (await req.json()) as {
      slug?: string
      companyName?: string
      ticker?: string | null
    }
    const slug = body.slug?.trim()
    const companyName = body.companyName?.trim()
    if (!slug || !companyName) {
      return new Response(JSON.stringify({ error: 'slug and companyName required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY')?.trim()
    if (!perplexityKey) {
      return new Response(
        JSON.stringify({ error: 'PERPLEXITY_API_KEY not set on Edge Function' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const model = Deno.env.get('PERPLEXITY_MODEL')?.trim() || 'sonar-pro'
    const supabase = createClient(supabaseUrl, serviceKey)
    const currentDate = new Date().toISOString().split('T')[0] // "YYYY-MM-DD"
    const ticker = body.ticker ?? null

    // ── 3 focused parallel Perplexity calls ───────────────────────────────────
    const [financialContent, companyContent, mediaContent] = await Promise.all([
      callPerplexity(
        perplexityKey,
        model,
        'You have web search access. Extract financial metrics from official SEC filings and earnings releases only. Return valid JSON only. No markdown fences.',
        buildFinancialHighlightsPrompt(companyName, ticker, currentDate),
      ).catch((err: unknown) => {
        console.error('Financial highlights call failed:', err instanceof Error ? err.message : String(err))
        return null
      }),

      callPerplexity(
        perplexityKey,
        model,
        'You have web search access. Use ONLY official IR, SEC filings, earnings releases, and company press releases. Never cite third-party news. Return valid JSON only. No markdown fences.',
        buildCompanyNarrativePrompt(companyName, ticker, currentDate),
      ).catch((err: unknown) => {
        console.error('Company narrative call failed:', err instanceof Error ? err.message : String(err))
        return null
      }),

      callPerplexity(
        perplexityKey,
        model,
        'You have web search access. Use ONLY truly independent third-party sources. NEVER cite company websites, subdomains, or syndicated press releases (PR Newswire, GlobeNewswire, Business Wire, Newsfile). Return valid JSON only. No markdown fences.',
        buildMediaNarrativePrompt(companyName, ticker, currentDate),
        { recencyFilter: 'month' },
      ).catch((err: unknown) => {
        console.error('Media narrative call failed:', err instanceof Error ? err.message : String(err))
        return null
      }),
    ])

    if (!financialContent && !companyContent && !mediaContent) {
      throw new Error('All 3 Perplexity calls failed')
    }

    // ── Parse each response ───────────────────────────────────────────────────
    const financial_highlights = financialContent
      ? parseFinancialHighlightsResponse(financialContent)
      : null

    const { company_narrative, company_sources } = companyContent
      ? parseCompanyNarrativeResponse(companyContent)
      : { company_narrative: null, company_sources: [] }

    const {
      media_narrative,
      media_sources: rawMediaSources,
      factual_gaps,
    } = mediaContent
      ? parseMediaNarrativeResponse(mediaContent)
      : { media_narrative: null, media_sources: [], factual_gaps: [] }

    // ── Deterministic source contamination check ──────────────────────────────
    const officialRoots = await getOfficialRoots(supabase, slug)
    // Hard-remove any company-owned / syndicated-press URLs from media_sources
    const media_sources = filterContaminatedMediaSources(rawMediaSources, officialRoots)

    // ── Merge, reconcile, rank all items for the headlines view ───────────────
    const mergedItems = [...company_sources, ...media_sources]
    const reconciledItems = applySourceReconciliation(mergedItems, officialRoots)
    const items = rankResearchItems(reconciledItems)

    // ── Persist to DB ─────────────────────────────────────────────────────────
    const { error: upErr } = await supabase.from('company_research_cache').upsert(
      {
        slug,
        company_name: companyName,
        ticker,
        items,
        synthesis: null,
        company_narrative: company_narrative ?? null,
        media_narrative: media_narrative ?? null,
        factual_gaps: factual_gaps ?? [],
        financial_highlights: financial_highlights ?? null,
        fetched_at: new Date().toISOString(),
        error: null,
        model,
      },
      { onConflict: 'slug' },
    )

    if (upErr) throw upErr

    return new Response(
      JSON.stringify({
        ok: true,
        items,
        company_narrative,
        media_narrative,
        factual_gaps,
        financial_highlights,
        model,
        count: items.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
