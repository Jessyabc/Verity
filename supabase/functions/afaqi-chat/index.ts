/**
 * Afaqi — adaptive research assistant.
 *
 * Invoke: supabase.functions.invoke('afaqi-chat', {
 *   body: { slug: string, conversationId: string, message: string }
 * })
 * Requires a signed-in user (Authorization: Bearer <access_token>).
 * Secrets: OPENAI_API_KEY, PERPLEXITY_API_KEY (optional), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Flow per request:
 *  1. Validate session + env
 *  2. Load primary company research from cache
 *  3. Load last 20 conversation turns from chat_messages
 *  4. Route mode (analyze | compare | portfolio_synthesis | theme | technical | context_qa)
 *  5. Fetch compare-company cards and/or live Perplexity research as needed
 *  6. Call OpenAI for synthesis with a mode-specific instruction block
 *  7. Persist user + assistant messages; refresh conversation title at 2 and 20 messages
 *  8. Return { message, sources }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSession } from '../_shared/requireSession.ts'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const AFAQI_SYSTEM_PROMPT = `You are Afaqi, the research assistant inside Verity.

Your job is to help users explore company research, market context, and related topics with maximum trust, clarity, and grounding.

NON-NEGOTIABLE RULES
- Use only the provided research context, source bundles, and any injected research.
- Prefer the structured research card fields (official narrative, independent narrative, financial highlights, factual gaps) over headline snippets when both exist.
- Keep official (company/IR/filings) and independent (media/analyst) layers distinct — never blend them into one undifferentiated "truth."
- Never invent facts, numbers, dates, events, or conclusions.
- Never answer from generic memory when a source-backed answer is possible.
- If the evidence is incomplete, say so plainly.
- If sources conflict, explain the conflict rather than forcing certainty.
- Show source references, titles, or source labels whenever possible.
- Never give investment advice, buy/sell recommendations, ratings, or price targets. Reframe advice-seeking into research questions and what to verify.
- Respect FRESHNESS and CONFIDENCE lines on research cards. If a card is STALE or VERY STALE, say so briefly when the answer depends on it, and suggest Refresh on the company profile for current events.
- If a LIVE RESEARCH UNAVAILABLE block is present, tell the user clearly — do not invent a live web answer.

WHEN ADDITIONAL CONTEXT IS PROVIDED
- You may draw on injected cross-company research or live web research when it has been provided to you in the context blocks below.
- Always attribute which company or search result each piece of information comes from.
- Label live search as live/secondary when a Verity research card is also present.
- If a company mentioned is not currently tracked in Verity, say so naturally (e.g. "This company isn't currently tracked in Verity's research database, but based on available sources…").

WHAT YOU ARE FOR
- Explaining and comparing company research across primary and referenced companies.
- Answering factual, scientific, or market questions using live research when it has been provided.
- Surfacing factual gaps and narrative divergences.
- Pointing users to the right headlines and sources.
- Helping users ask deeper follow-up questions.
- Clarifying what is verified vs. interpreted.

WHAT YOU ARE NOT FOR
- Unverified speculation or general web chat without sources.
- Investment advice or buy/sell recommendations.
- Hiding uncertainty — if you don't have the evidence, say so.

RESPONSE STYLE
- Start with the direct answer.
- Give a short explanation organized by evidence layer when relevant (Official / Independent / Financials / Gaps).
- For analyze / compare / portfolio synthesis, end with a one-line confidence note based on card freshness and coverage (high / medium / low) — about evidence quality, not price outlook.
- Cite or list supporting sources.
- Keep responses concise and useful.
- Be calm, precise, and analyst-like. Friendly but credible.

SOURCE DISCLOSURE
Format citations as: [Source: title — domain]

After your answer, output a JSON block on the last line in this exact format (no extra text after it):
SOURCES_JSON: [{"title":"...","url":"...","source":"..."}]
If there are no specific sources to cite, output: SOURCES_JSON: []`

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResearchItem = {
  title: string
  url: string
  snippet: string | null
  source: string | null
  published_at: string | null
  narrative_scope?: 'company' | 'media' | string | null
}

type FactualGap =
  | string
  | { text?: string; category?: string }

type FinancialMetric = { label?: string; value?: string; yoy?: string | null }

type FinancialHighlights = {
  period?: string
  period_end?: string | null
  metrics?: FinancialMetric[]
}

type CacheRow = {
  slug: string
  company_name: string
  ticker: string | null
  items: ResearchItem[]
  fetched_at: string
  company_narrative?: string | null
  media_narrative?: string | null
  factual_gaps?: FactualGap[] | null
  financial_highlights?: FinancialHighlights | null
  change_summary?: {
    bullets?: string[]
    previous_fetched_at?: string | null
    sources_added?: number
    sources_removed?: number
    gaps_added?: number
    gaps_removed?: number
    metrics_changed?: Array<{ label?: string; from?: string; to?: string }>
    company_narrative_changed?: boolean
    media_narrative_changed?: boolean
  } | null
  research_version?: number | null
}

type AfaqiSource = {
  title: string
  url: string
  source?: string
}

type ResearchMode =
  | 'analyze'
  | 'compare'
  | 'portfolio_synthesis'
  | 'theme'
  | 'technical'
  | 'context_qa'

type ModeRoute = {
  mode: ResearchMode
  companies: string[]
  query: string
  needs_live_research: boolean
}

type PerplexityResult = {
  content: string
  sources: AfaqiSource[]
}

const CACHE_SELECT_FULL =
  'slug, company_name, ticker, items, fetched_at, company_narrative, media_narrative, factual_gaps, financial_highlights, change_summary, research_version'

const CACHE_SELECT_LEGACY =
  'slug, company_name, ticker, items, fetched_at, company_narrative, media_narrative, factual_gaps, financial_highlights'

/** Prefer full select; fall back if snapshots migration not applied yet. */
let preferLegacyCacheSelect = false

function isMissingSnapshotColumnError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false
  if ((error as { code?: string }).code === '42703') return true
  const msg = error.message ?? ''
  return /change_summary|research_version|previous_fetched_at|does not exist/i.test(msg)
}

async function selectResearchCache(
  // deno-lint-ignore no-explicit-any
  db: any,
  opts: { slug?: string; slugs?: string[] },
): Promise<CacheRow[]> {
  const select = preferLegacyCacheSelect ? CACHE_SELECT_LEGACY : CACHE_SELECT_FULL
  let q = db.from('company_research_cache').select(select)
  if (opts.slug) q = q.eq('slug', opts.slug)
  if (opts.slugs?.length) q = q.in('slug', opts.slugs)

  const first = opts.slug ? await q.maybeSingle() : await q
  if (first.error && !preferLegacyCacheSelect && isMissingSnapshotColumnError(first.error)) {
    preferLegacyCacheSelect = true
    let legacy = db.from('company_research_cache').select(CACHE_SELECT_LEGACY)
    if (opts.slug) legacy = legacy.eq('slug', opts.slug)
    if (opts.slugs?.length) legacy = legacy.in('slug', opts.slugs)
    const second = opts.slug ? await legacy.maybeSingle() : await legacy
    if (second.error) throw second.error
    if (opts.slug) return second.data ? [second.data as CacheRow] : []
    return (second.data ?? []) as CacheRow[]
  }
  if (first.error) throw first.error
  if (opts.slug) return first.data ? [first.data as CacheRow] : []
  return (first.data ?? []) as CacheRow[]
}

const PORTFOLIO_SLUG = '__portfolio__'

const MODE_INSTRUCTIONS: Record<ResearchMode, string> = {
  analyze: `MODE: Analyze ticker
Using only the Company Research Card (and any labeled live blocks), produce a structured memo with these headings:

1. Takeaway
2. Official narrative
3. Independent narrative
4. Financial snapshot
5. Factual gaps / unresolved
6. What to verify next (research watchpoints — not trade ideas)
7. Sources (official first, then independent)

Rules: no advice, ratings, or price targets; attribute claims by layer; if a section is missing in cache, say so.`,

  compare: `MODE: Compare
Write a dense side-by-side research compare. Prefer scannable structure over essay prose.

FORMAT — plain text only. Do NOT use markdown headings (# ## ###) or horizontal rules.
Use this exact skeleton:

COMPARE: {A} vs {B}
Scope: one short line on what is / is not comparable.

OFFICIAL
Strategy — {A}: … | {B}: …
Model — {A}: … | {B}: …

INDEPENDENT
Narrative — {A}: … | {B}: …
Debate — one line on where coverage agrees or diverges.

FINANCIALS
Use "n/a" when missing. At most 5 rows:
{metric} — {A value} | {B value}

GAPS / RISKS
Shared — …
{A}-only — …
{B}-only — …

OPEN
- 2–4 short research questions

SOURCES
{A} — title (domain); title (domain)
{B} — title (domain); title (domain)

Rules:
- One short clause per side after each em dash. No paragraphs.
- Keep official vs independent separated.
- No winner language, advice, ratings, or price targets.
- If a peer card is thin/missing, keep rows as n/a and say what to refresh.`,

  portfolio_synthesis: `MODE: Portfolio synthesis
Using the portfolio digest and company research cards, produce:

1. Cross-portfolio themes (name companies)
2. Narrative divergences worth attention (official vs independent)
3. Shared gap patterns
4. Concentration / theme overlap observations (descriptive only — not advisory)
5. Best next research questions (3–5)
6. Sources

No investment advice or portfolio allocation recommendations.`,

  theme: `MODE: Theme / sector research
1) Summarize the theme from live research and any card evidence (mechanics, current status, key actors).
2) Map relevance to provided holdings/cards — only where evidence supports a link.
3) Separate confirmed links vs uncertain links.
4) Open research questions.
5) Sources — prefer papers, standards bodies, filings, primary policy, reputable technical/trade press.

No investment advice.`,

  technical: `MODE: Technical / market-structure explanation
1) Explain the concept clearly for a serious investor.
2) If a company card is present, connect to disclosed uses/risks only when supported.
3) Prefer technical primary sources when present in live research.
4) Call out contested claims.
5) Sources.

No investment advice.`,

  context_qa: `MODE: Context Q&A
Answer directly from the provided research context.
Keep official vs independent layers distinct when both are relevant.
If evidence is thin, say so and suggest a sharper follow-up.
No investment advice.`,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateText(text: string, maxChars: number): string {
  const t = text.trim()
  if (t.length <= maxChars) return t
  return `${t.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

function gapLine(g: FactualGap): string | null {
  if (typeof g === 'string') {
    const t = g.trim()
    return t || null
  }
  if (g && typeof g === 'object') {
    const text = typeof g.text === 'string' ? g.text.trim() : ''
    if (!text) return null
    const cat = typeof g.category === 'string' && g.category.trim() ? g.category.trim() : null
    return cat ? `[${cat}] ${text}` : text
  }
  return null
}

function formatFinancialHighlights(
  fh: FinancialHighlights | null | undefined,
  maxMetrics = 8,
): string[] {
  if (!fh || typeof fh !== 'object') return []
  const lines: string[] = []
  const period = typeof fh.period === 'string' ? fh.period.trim() : ''
  if (period) {
    const end = typeof fh.period_end === 'string' && fh.period_end.trim() ? ` (ended ${fh.period_end.trim()})` : ''
    lines.push(`Period: ${period}${end}`)
  }
  const metrics = Array.isArray(fh.metrics) ? fh.metrics : []
  for (const m of metrics.slice(0, maxMetrics)) {
    if (!m || typeof m !== 'object') continue
    const label = typeof m.label === 'string' ? m.label.trim() : ''
    const value = typeof m.value === 'string' ? m.value.trim() : ''
    if (!label || !value) continue
    const yoy = typeof m.yoy === 'string' && m.yoy.trim() ? ` (YoY ${m.yoy.trim()})` : ''
    lines.push(`- ${label}: ${value}${yoy}`)
  }
  return lines
}

function formatSourceItems(items: ResearchItem[], cap: number): string[] {
  const lines: string[] = []
  items.slice(0, cap).forEach((item, i) => {
    lines.push(`${i + 1}. ${item.title}`)
    if (item.source) lines.push(`   Source: ${item.source}`)
    if (item.published_at) lines.push(`   Date: ${item.published_at}`)
    lines.push(`   URL: ${item.url}`)
    if (item.snippet) lines.push(`   Summary: ${truncateText(item.snippet, 280)}`)
    lines.push('')
  })
  return lines
}

/** Full research card for company chat / cross-company compare. */
function buildResearchContext(row: CacheRow, opts?: { compact?: boolean }): string {
  const compact = opts?.compact === true
  const ticker = row.ticker ? ` (${row.ticker})` : ''
  const narrativeMax = compact ? 520 : 2200
  const sourceCap = compact ? 2 : 6
  const metricCap = compact ? 4 : 8
  const lines: string[] = [
    `COMPANY RESEARCH CARD: ${row.company_name}${ticker}`,
    ...freshnessBlock(row),
    '',
  ]

  const change = row.change_summary
  const changeBullets = Array.isArray(change?.bullets)
    ? change!.bullets!.filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
    : []
  if (changeBullets.length > 0) {
    lines.push('WHAT CHANGED (since previous refresh — do not invent beyond this list):')
    changeBullets.slice(0, compact ? 3 : 8).forEach((b, i) => lines.push(`${i + 1}. ${b}`))
    lines.push('')
  }

  const companyNarrative =
    typeof row.company_narrative === 'string' ? row.company_narrative.trim() : ''
  lines.push('OFFICIAL NARRATIVE (IR / filings / company materials):')
  lines.push(companyNarrative ? truncateText(companyNarrative, narrativeMax) : '(not available in cache)')
  lines.push('')

  const mediaNarrative =
    typeof row.media_narrative === 'string' ? row.media_narrative.trim() : ''
  lines.push('INDEPENDENT NARRATIVE (media / analysts):')
  lines.push(mediaNarrative ? truncateText(mediaNarrative, narrativeMax) : '(not available in cache)')
  lines.push('')

  const finLines = formatFinancialHighlights(row.financial_highlights ?? null, metricCap)
  lines.push('FINANCIAL HIGHLIGHTS:')
  if (finLines.length > 0) lines.push(...finLines)
  else lines.push('(not available in cache)')
  lines.push('')

  const gaps = Array.isArray(row.factual_gaps) ? row.factual_gaps : []
  const gapLines = gaps.map(gapLine).filter((x): x is string => Boolean(x)).slice(0, compact ? 3 : 5)
  lines.push('FACTUAL GAPS:')
  if (gapLines.length > 0) {
    gapLines.forEach((g, i) => lines.push(`${i + 1}. ${g}`))
  } else {
    lines.push('(none cached)')
  }
  lines.push('')

  const items = Array.isArray(row.items) ? row.items : []
  const official = items.filter((it) => it.narrative_scope === 'company')
  const independent = items.filter((it) => it.narrative_scope === 'media')
  const unscoped = items.filter(
    (it) => it.narrative_scope !== 'company' && it.narrative_scope !== 'media',
  )

  const officialList = (official.length > 0 ? official : unscoped).slice(0, sourceCap)
  const independentList = independent.slice(0, sourceCap)

  lines.push(`OFFICIAL SOURCES (top ${officialList.length}):`)
  if (officialList.length === 0) lines.push('(none)')
  else lines.push(...formatSourceItems(officialList, sourceCap))

  lines.push(`INDEPENDENT SOURCES (top ${independentList.length}):`)
  if (independentList.length === 0) lines.push('(none)')
  else lines.push(...formatSourceItems(independentList, sourceCap))

  return lines.join('\n')
}

/** Portfolio: digest + compact research cards per holding. */
function buildPortfolioContext(digestText: string, rows: CacheRow[]): string {
  const lines: string[] = [
    'PORTFOLIO CONTEXT (Watchlist)',
    '',
  ]

  if (digestText.trim()) {
    lines.push('LATEST PORTFOLIO DIGEST:')
    lines.push(digestText.trim())
    lines.push('')
  } else {
    lines.push('LATEST PORTFOLIO DIGEST: (not available yet)')
    lines.push('')
  }

  if (rows.length === 0) {
    lines.push('No company research cache rows were found for the current watchlist.')
    lines.push('If the user asks for details, instruct them to run research on companies first.')
    return lines.join('\n')
  }

  lines.push('WATCHLIST COMPANY RESEARCH CARDS (compact):')
  lines.push('')

  for (const row of rows) {
    lines.push(buildResearchContext(row, { compact: true }))
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

/** Fresh < 48h; stale until 7d; very stale after that. Keep aligned with mobile `researchFreshness.ts`. */
const FRESH_MS = 48 * 60 * 60 * 1000
const VERY_STALE_MS = 7 * 24 * 60 * 60 * 1000

function researchAgeMs(fetchedAt: string): number | null {
  const t = new Date(fetchedAt).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Date.now() - t)
}

function formatAgeShort(ageMs: number): string {
  const m = Math.floor(ageMs / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function freshnessBlock(row: CacheRow): string[] {
  const ageMs = researchAgeMs(row.fetched_at)
  const updated = new Date(row.fetched_at).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  const hasNarr =
    Boolean(row.company_narrative?.trim()) || Boolean(row.media_narrative?.trim())
  const hasFin = Boolean(
    row.financial_highlights &&
      Array.isArray(row.financial_highlights.metrics) &&
      row.financial_highlights.metrics.length > 0,
  )
  const hasGaps = Array.isArray(row.factual_gaps) && row.factual_gaps.length > 0
  const depth = (hasNarr ? 1 : 0) + (hasFin ? 1 : 0) + (hasGaps ? 1 : 0)

  if (ageMs == null) {
    return [
      `Research last updated: unknown`,
      `Freshness: MISSING`,
      `Confidence: low (no usable timestamp)`,
    ]
  }

  let level = 'FRESH'
  let confidence = depth >= 2 ? 'high' : 'medium'
  if (ageMs >= VERY_STALE_MS) {
    level = 'VERY STALE'
    confidence = 'low'
  } else if (ageMs >= FRESH_MS) {
    level = 'STALE'
    confidence = depth >= 2 ? 'medium' : 'low'
  }

  return [
    `Research last updated: ${updated} (${formatAgeShort(ageMs)})`,
    `Freshness: ${level}`,
    `Confidence: ${confidence} (evidence coverage — not a price outlook)`,
    level === 'FRESH'
      ? ''
      : 'Note: If the user asks about current events, mention staleness and suggest Refresh on the company profile.',
  ].filter(Boolean)
}

/** Returns true when a cache row is fresh enough to prefer over live fill (< 48 h old). */
function isCacheFresh(fetchedAt: string): boolean {
  const age = researchAgeMs(fetchedAt)
  return age != null && age < FRESH_MS
}

/**
 * OpenAI rejects requests if any chat message has null/empty content or an invalid role.
 * DB rows can be malformed; drop bad rows instead of failing the whole completion.
 */
function sanitizeHistory(
  rows: { role: string; content: unknown }[],
): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  for (const row of rows) {
    if (row.role !== 'user' && row.role !== 'assistant') continue
    const raw =
      typeof row.content === 'string'
        ? row.content
        : row.content == null
          ? ''
          : String(row.content)
    const trimmed = raw.trim()
    if (!trimmed) continue
    out.push({ role: row.role, content: trimmed })
  }
  return out
}

/** Short thread title for the conversation list (after 1st exchange and again at 20 messages). */
async function generateConversationTitle(
  openaiKey: string,
  mode: 'initial' | 'refresh',
  transcript: string,
): Promise<string | null> {
  const trimmed = transcript.trim()
  if (!trimmed) return null
  const system =
    mode === 'initial'
      ? 'You title research-chat threads in a financial app called Verity. Reply with a short title only: maximum 6 words, title case, no quotation marks, no period at the end. Describe the user’s main question or topic.'
      : 'You refresh a thread title after more messages. Reply with a short title only: maximum 8 words, title case, no quotation marks, no period. Summarize the main theme of the conversation.'
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Conversation excerpt:\n\n${trimmed.slice(0, 3500)}` },
        ],
        max_tokens: 40,
        temperature: 0.3,
      }),
    })
    if (!res.ok) return null
    const json = await res.json()
    const raw = (json.choices?.[0]?.message?.content ?? '')
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, '')
    const oneLine = raw.replace(/\s+/g, ' ').trim().slice(0, 80)
    return oneLine || null
  } catch {
    return null
  }
}

/** Fast path for obvious starter-chip / keyword shapes before calling the classifier. */
function heuristicMode(
  message: string,
  isPortfolio: boolean,
): Partial<ModeRoute> | null {
  const m = message.toLowerCase()
  if (/\bcompare\b/.test(m) || /\bvs\.?\b/.test(m) || /\bversus\b/.test(m)) {
    // Same-company narrative contrast is analyze/context, not peer compare
    if (
      /\bofficial\b/.test(m) &&
      (/\bindependent\b/.test(m) || /\bmedia\b/.test(m) || /\banalyst\b/.test(m))
    ) {
      return { mode: isPortfolio ? 'portfolio_synthesis' : 'analyze', needs_live_research: false }
    }
    return { mode: 'compare', needs_live_research: false }
  }
  if (
    /\banalyze\b/.test(m) ||
    /\bresearch memo\b/.test(m) ||
    /\bstructured research memo\b/.test(m) ||
    /\bdeep dive\b/.test(m)
  ) {
    return { mode: isPortfolio ? 'portfolio_synthesis' : 'analyze', needs_live_research: false }
  }
  if (
    isPortfolio &&
    (/\bthemes?\b/.test(m) ||
      /\bcross-portfolio\b/.test(m) ||
      (/\bwatchlist\b/.test(m) && /\bsynthesis\b/.test(m)) ||
      /\bshared risks?\b/.test(m) ||
      /\bgaps stand out\b/.test(m))
  ) {
    return { mode: 'portfolio_synthesis', needs_live_research: false }
  }
  if (/\bhow does\b/.test(m) || /\bwhat is\b/.test(m) && /\bwork\b/.test(m)) {
    return { mode: 'technical', needs_live_research: true }
  }
  if (/\bsector\b/.test(m) || /\btheme\b/.test(m) || /\bindustry\b/.test(m)) {
    return { mode: 'theme', needs_live_research: true }
  }
  return null
}

const VALID_MODES = new Set<ResearchMode>([
  'analyze',
  'compare',
  'portfolio_synthesis',
  'theme',
  'technical',
  'context_qa',
])

/** Route the user message to a research mode and any extra lookups needed. */
async function classifyMode(
  message: string,
  primaryCompanyName: string,
  isPortfolio: boolean,
  openaiKey: string,
): Promise<ModeRoute> {
  const fallback: ModeRoute = {
    mode: isPortfolio ? 'portfolio_synthesis' : 'context_qa',
    companies: [],
    query: '',
    needs_live_research: false,
  }

  const hint = heuristicMode(message, isPortfolio)

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Classify the user message for Verity's research assistant. Respond with JSON only.
Primary context: "${primaryCompanyName}"
Is portfolio chat: ${isPortfolio}

Modes:
- "analyze": structured deep dive on the primary company using its research card
- "compare": side-by-side compare of two or more companies (fill companies[])
- "portfolio_synthesis": themes/risks/gaps across the watchlist (portfolio chat or multi-holding questions)
- "theme": sector/theme research that may need live search; map back to holdings when possible
- "technical": how a technology/process/market structure works; usually needs live search
- "context_qa": follow-up answerable from existing research cards (default)

Rules:
- Prefer "compare" when the user contrasts companies or asks for a peer compare.
- Prefer "analyze" for "analyze", "memo", "deep dive" on one company.
- Prefer "portfolio_synthesis" in portfolio chat for themes/risks/gaps across holdings.
- If theme/technical needs web search, set needs_live_research true and provide query.
- For compare, put peer company names/tickers in companies (exclude the primary if already in context). Max 2.
- If both compare and technical apply (e.g. "compare NVLink at Nvidia vs AMD"), prefer "compare".

Output JSON only:
{
  "mode": "analyze" | "compare" | "portfolio_synthesis" | "theme" | "technical" | "context_qa",
  "companies": ["CompanyName or TICKER"],
  "query": "concise web search query (empty if not needed)",
  "needs_live_research": boolean
}`,
          },
          { role: 'user', content: message },
        ],
        temperature: 0,
        max_tokens: 160,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) {
      return hint
        ? {
            mode: hint.mode ?? fallback.mode,
            companies: [],
            query: '',
            needs_live_research: hint.needs_live_research ?? false,
          }
        : fallback
    }
    const json = await res.json()
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}')
    const modeRaw = typeof parsed.mode === 'string' ? parsed.mode : ''
    let mode: ResearchMode = VALID_MODES.has(modeRaw as ResearchMode)
      ? (modeRaw as ResearchMode)
      : fallback.mode

    // Heuristic wins on clear chip/keyword shapes when classifier disagrees mildly
    if (hint?.mode && (mode === 'context_qa' || mode === hint.mode)) {
      mode = hint.mode
    }

    if (isPortfolio && mode === 'analyze') mode = 'portfolio_synthesis'

    return {
      mode,
      companies: Array.isArray(parsed.companies) ? parsed.companies.slice(0, 2) : [],
      query: typeof parsed.query === 'string' ? parsed.query : '',
      needs_live_research: Boolean(parsed.needs_live_research) ||
        mode === 'theme' ||
        mode === 'technical' ||
        Boolean(hint?.needs_live_research),
    }
  } catch {
    return hint
      ? {
          mode: hint.mode ?? fallback.mode,
          companies: [],
          query: '',
          needs_live_research: hint.needs_live_research ?? false,
        }
      : fallback
  }
}

/** Targeted Perplexity search returning a short text block + source list. */
async function searchPerplexity(query: string, perplexityKey: string): Promise<PerplexityResult> {
  const empty: PerplexityResult = { content: '', sources: [] }
  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content:
              'Provide a concise, factual summary with the most relevant information. Stay neutral. No advice or opinion. Cite sources inline.',
          },
          { role: 'user', content: query },
        ],
        max_tokens: 600,
      }),
    })
    if (!res.ok) return empty
    const json = await res.json()
    const content: string = json.choices?.[0]?.message?.content ?? ''
    const citations: string[] = json.citations ?? []
    const sources: AfaqiSource[] = citations.slice(0, 6).map((url: string) => {
      try {
        return { title: new URL(url).hostname, url, source: new URL(url).hostname }
      } catch {
        return { title: url, url }
      }
    })
    return { content, sources }
  } catch {
    return empty
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth
  const sessionResult = await requireSession(req)
  if ('response' in sessionResult) return sessionResult.response
  const { user } = sessionResult

  // Env
  const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured', code: 'config' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
  const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY')?.trim() ?? ''

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase env vars missing', code: 'config' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Parse body
  let slug: string
  let conversationId: string
  let message: string
  try {
    const body = await req.json()
    slug = body.slug
    conversationId = body.conversationId
    message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!slug || typeof slug !== 'string') throw new Error('slug required')
    if (!conversationId || typeof conversationId !== 'string') throw new Error('conversationId required')
    if (!message) throw new Error('message required')
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'Bad request',
        code: 'validation',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const db = createClient(supabaseUrl, serviceKey)

  // 1. Primary context
  let primaryContext = ''
  let primaryCompanyName = slug

  if (slug === PORTFOLIO_SLUG) {
    // Portfolio mode: use watchlist_digest + multiple company research caches
    const { data: digestRow } = await db
      .from('watchlist_digest')
      .select('digest_text, slugs_snapshot, generated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const slugsFromDigest = Array.isArray(digestRow?.slugs_snapshot) ? digestRow!.slugs_snapshot : []

    // Fallback to user_watchlist if digest not generated yet
    const { data: watchRows } = slugsFromDigest.length === 0
      ? await db
        .from('user_watchlist')
        .select('company_slug')
        .eq('user_id', user.id)
      : { data: null }

    const slugs = (slugsFromDigest.length > 0
      ? slugsFromDigest
      : (watchRows ?? []).map((r: { company_slug: string }) => r.company_slug)
    )
      .filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
      .slice(0, 8)

    const cacheRows =
      slugs.length > 0 ? await selectResearchCache(db, { slugs }) : []

    primaryContext = buildPortfolioContext(
      typeof digestRow?.digest_text === 'string' ? digestRow.digest_text : '',
      cacheRows,
    )
    primaryCompanyName = 'User Portfolio'
  } else {
    // Company mode
    const cacheRows = await selectResearchCache(db, { slug })
    const cacheRow = cacheRows[0] ?? null

    primaryContext = cacheRow
      ? buildResearchContext(cacheRow)
      : `No research context found for "${slug}". Tell the user to run research on this company first from the company profile.`

    primaryCompanyName = cacheRow?.company_name ?? slug
  }

  // 2. Load conversation history (last 20 turns, ascending order)
  const { data: historyRows } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20)

  const history = sanitizeHistory([...(historyRows ?? [])].reverse())

  // 3. Route mode
  const isPortfolio = slug === PORTFOLIO_SLUG
  const route = await classifyMode(message, primaryCompanyName, isPortfolio, openaiKey)

  // 4. Gather additional context blocks (compare peers and/or live research)
  const contextBlocks: string[] = []
  const extraSources: AfaqiSource[] = []
  const extraContextSlugs: string[] = []

  const shouldLoadPeers =
    route.mode === 'compare' ||
    (route.companies.length > 0 && route.mode !== 'portfolio_synthesis')

  if (shouldLoadPeers && route.companies.length > 0) {
    for (const companyRef of route.companies.slice(0, 2)) {
      const { data: foundCompany } = await db
        .from('companies')
        .select('slug, name, ticker')
        .or(`name.ilike.%${companyRef}%,ticker.ilike.${companyRef.toUpperCase()}`)
        .limit(1)
        .maybeSingle()

      if (foundCompany) {
        if (foundCompany.slug === slug) continue

        const { data: otherCache } = await db
          .from('company_research_cache')
          .select(CACHE_SELECT)
          .eq('slug', foundCompany.slug)
          .maybeSingle()

        if (otherCache) {
          // Prefer cache even if slightly stale for structured compare; label freshness in block.
          const fresh = isCacheFresh((otherCache as CacheRow).fetched_at)
          const otherCtx = buildResearchContext(otherCache as CacheRow)
          contextBlocks.push(
            `--- COMPARE / PEER CARD: ${(otherCache as CacheRow).company_name}${(otherCache as CacheRow).ticker ? ` (${(otherCache as CacheRow).ticker})` : ''} (${fresh ? 'Verity research cache' : 'Verity research cache — may be stale'}) ---\n${otherCtx}`,
          )
          extraContextSlugs.push(foundCompany.slug)
        } else if (perplexityKey) {
          const result = await searchPerplexity(
            `${foundCompany.name}${foundCompany.ticker ? ` ${foundCompany.ticker}` : ''} company overview latest news filings`,
            perplexityKey,
          )
          if (result.content) {
            contextBlocks.push(
              `--- COMPARE / PEER CONTEXT: ${foundCompany.name} (live search — not in Verity research cache) ---\n${result.content}`,
            )
            extraSources.push(...result.sources)
            extraContextSlugs.push(foundCompany.slug)
          }
        }
      } else if (perplexityKey) {
        const result = await searchPerplexity(
          `${companyRef} company overview recent news filings`,
          perplexityKey,
        )
        if (result.content) {
          contextBlocks.push(
            `--- COMPARE / PEER CONTEXT: ${companyRef} (not currently tracked in Verity — live search) ---\n${result.content}`,
          )
          extraSources.push(...result.sources)
        }
      }
    }
  }

  // For company-chat compare with no named peer: ask model to pick from live research only if needed
  if (route.mode === 'compare' && !isPortfolio && route.companies.length === 0 && perplexityKey) {
    const result = await searchPerplexity(
      `${primaryCompanyName} closest public company peers competitors overview`,
      perplexityKey,
    )
    if (result.content) {
      contextBlocks.push(
        `--- PEER CANDIDATES (live search — use only to choose one peer and compare carefully) ---\n${result.content}`,
      )
      extraSources.push(...result.sources)
      route.needs_live_research = true
    }
  }

  if (route.needs_live_research && route.query && perplexityKey) {
    const result = await searchPerplexity(route.query, perplexityKey)
    if (result.content) {
      contextBlocks.push(
        `--- LIVE RESEARCH: "${route.query}" ---\n${result.content}`,
      )
      extraSources.push(...result.sources)
    } else {
      contextBlocks.push(
        `--- LIVE RESEARCH UNAVAILABLE ---\nA live web lookup was attempted for "${route.query}" but returned no usable results. Answer only from research cards. Tell the user the live lookup did not return useful material.`,
      )
    }
  } else if (
    route.needs_live_research &&
    !route.query &&
    perplexityKey &&
    (route.mode === 'theme' || route.mode === 'technical')
  ) {
    const fallbackQuery = message.slice(0, 180)
    const result = await searchPerplexity(fallbackQuery, perplexityKey)
    if (result.content) {
      contextBlocks.push(
        `--- LIVE RESEARCH: "${fallbackQuery}" ---\n${result.content}`,
      )
      extraSources.push(...result.sources)
    } else {
      contextBlocks.push(
        `--- LIVE RESEARCH UNAVAILABLE ---\nA live web lookup was attempted but returned no usable results. Answer only from research cards and say so clearly.`,
      )
    }
  } else if (route.needs_live_research && !perplexityKey) {
    contextBlocks.push(
      `--- LIVE RESEARCH UNAVAILABLE ---\nThis question needed a live web lookup, but live research is not configured on the server. Answer only from research cards. Tell the user clearly that live research is unavailable right now.`,
    )
  }

  // 5. Build OpenAI message list with mode instruction
  const modeInstruction = MODE_INSTRUCTIONS[route.mode]
  const maxTokens =
    route.mode === 'analyze' || route.mode === 'compare' || route.mode === 'portfolio_synthesis'
      ? 1600
      : 1400

  const openaiMessages: { role: string; content: string }[] = [
    { role: 'system', content: AFAQI_SYSTEM_PROMPT },
    { role: 'system', content: modeInstruction },
    { role: 'system', content: `PRIMARY RESEARCH CONTEXT:\n\n${primaryContext}` },
    ...contextBlocks.map((block) => ({ role: 'system', content: block })),
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  // 6. Call OpenAI for synthesis
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    let openaiMessage = errText
    try {
      const parsed = JSON.parse(errText) as {
        error?: { message?: string; type?: string; code?: string }
      }
      if (typeof parsed?.error?.message === 'string') openaiMessage = parsed.error.message
    } catch {
      /* keep raw body */
    }
    return new Response(
      JSON.stringify({
        error: openaiMessage,
        code: 'openai_upstream',
        details: errText.length > 800 ? `${errText.slice(0, 800)}…` : errText,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const openaiJson = await openaiRes.json()
  const rawContent: string = openaiJson.choices?.[0]?.message?.content ?? ''

  // Parse trailing SOURCES_JSON
  let messageText = rawContent
  let sources: AfaqiSource[] = [...extraSources]

  const sourcesMatch = rawContent.match(/SOURCES_JSON:\s*(\[.*\])\s*$/s)
  if (sourcesMatch) {
    try {
      const parsed: AfaqiSource[] = JSON.parse(sourcesMatch[1])
      sources = [...parsed, ...extraSources]
    } catch {
      // keep extraSources only
    }
    messageText = rawContent.slice(0, sourcesMatch.index).trim()
  }

  // 7. Persist messages to DB (fire-and-forget style errors — don't fail the response)
  try {
    await db.from('chat_messages').insert([
      {
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: message,
        sources_json: null,
        extra_context_slugs: null,
      },
      {
        conversation_id: conversationId,
        user_id: user.id,
        role: 'assistant',
        content: messageText,
        sources_json: sources.length > 0 ? sources : null,
        extra_context_slugs: extraContextSlugs.length > 0 ? extraContextSlugs : null,
      },
    ])

    const { count } = await db
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)

    const updateData: Record<string, unknown> = { last_message_at: new Date().toISOString() }
    const n = count ?? 0

    if (n === 2) {
      const transcript =
        `User: ${message}\nAssistant: ${messageText.slice(0, 800)}`
      const title = await generateConversationTitle(openaiKey, 'initial', transcript)
      if (title) updateData.title = title
    } else if (n === 20) {
      const { data: titleRows } = await db
        .from('chat_messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      const lines = (titleRows ?? [])
        .filter((r: { role: string; content: unknown }) =>
          (r.role === 'user' || r.role === 'assistant') && typeof r.content === 'string'
        )
        .map((r: { role: string; content: string }) =>
          `${r.role}: ${r.content.slice(0, 500)}`
        )
        .join('\n')
      const title = await generateConversationTitle(openaiKey, 'refresh', lines.slice(0, 12000))
      if (title) updateData.title = title
    }

    await db.from('conversations').update(updateData).eq('id', conversationId)
  } catch {
    // Persistence failure should not block the response
  }

  return new Response(
    JSON.stringify({
      message: messageText,
      sources,
      // Surface which extra companies were loaded so the UI can update the context pill
      extraContextSlugs: extraContextSlugs.length > 0 ? extraContextSlugs : undefined,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
