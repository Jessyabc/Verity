/**
 * Invoke from the app: supabase.functions.invoke('research-company', { body: { slug, companyName, ticker } })
 * Requires a signed-in user (Authorization: Bearer <access_token>).
 * Secrets: PERPLEXITY_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSession } from '../_shared/requireSession.ts'

function buildPrompt(companyName: string, ticker: string | null): string {
  const t = ticker ? ` (${ticker})` : ''
  return (
    `You are a neutral research assistant for ${companyName}${t}. ` +
    `Enforce strict source separation at all times.\n\n` +
    `GLOBAL RULES:\n` +
    `- 100% factual and neutral. No sentiment, no advice, no forecasting.\n` +
    `- Never use words like "bullish", "bearish", "buy", "sell", "should", or "recommend".\n` +
    `- Do NOT use TikTok, Facebook, Instagram, Reddit, or fan blogs.\n\n` +
    `COMPANY NARRATIVE (required text field company_narrative):\n` +
    `Strict source rules for Company Narrative:\n` +
    `- ONLY official sources: investor relations page, SEC filings, earnings releases, and company press releases.\n` +
    `- NEVER use or cite third-party news, analysts, or independent commentary.\n\n` +
    `Summarize ONLY official company sources: investor relations page, press releases, latest 10-K/SEC filings, ` +
    `earnings releases. Do not use any third-party news.\n\n` +
    `MEDIA & ANALYST NARRATIVE (required text field media_narrative):\n` +
    `// === MEDIA & ANALYST NARRATIVE RULES (add this verbatim) ===\n` +
    `Strict source rules for Media & Analyst Narrative:\n\n` +
    `- ONLY use truly independent third-party sources: editorial news outlets with journalist bylines, sell-side analyst reports, Seeking Alpha, Yahoo Finance commentary, The Quantum Insider, reputable YouTube channels run by independent creators/journalists, peer-reviewed papers (Nature, IEEE, arXiv when not company-authored), university/lab pages, or independent conference coverage.\n\n` +
    `- NEVER use or cite:\n` +
    `  - The company’s own website or any subdomain (e.g. ionq.com, quantumemotion.com)\n` +
    `  - Corporate newsroom, press, blog, careers, or investor pages\n` +
    `  - Official company YouTube channel, LinkedIn company page, or X account\n` +
    `  - Syndicated press releases (GlobeNewswire, PR Newswire, Business Wire, Newsfile) even if hosted on third-party domains — treat these as company messaging\n\n` +
    `- YouTube / video: Only include if the channel/publisher is clearly independent (news org, university, known finance creator). Exclude any video that is a repost or verbatim reading of a company press release.\n\n` +
    `- If independent coverage is very limited or nonexistent, explicitly state in the narrative: "Limited independent media and analyst coverage found." Do not pad the section with first-party content. Return fewer or zero media_sources if necessary.\n\n` +
    `- Always list sources at the bottom clearly labeled "Media & Analyst".\n\n` +
    `Summarize ONLY independent third-party sources: news articles, analyst reports, Seeking Alpha, Yahoo Finance, ` +
    `credible financial press. Explicitly exclude the company's own website and company press releases.\n\n` +
    `FACTUAL GAPS (factual_gaps array):\n` +
    `3–5 items. Prefer objects: { "category": string, "text": string }. Plain strings are allowed but objects are preferred.\n` +
    `category must be one of: numeric | disclosure | timing | definition | coverage (use at most one item per category when possible).\n` +
    `Gap types to rotate (do not repeat the same sentence template across bullets):\n` +
    `(1) numeric — only when both sides cite numbers (e.g. company line item vs consensus or third-party figure).\n` +
    `(2) disclosure — topic appears in filings/MD&A vs absent or thin elsewhere (or reverse).\n` +
    `(3) timing — event date, fiscal period, or document vintage differs between sources.\n` +
    `(4) definition — non-GAAP label, segment, geography, or scope differs between sources.\n` +
    `(5) coverage — asymmetry: what official sources document vs what independent sources in your list do or do not address (no speculation, no motive).\n` +
    `If independent coverage is thin: prefer 2–3 strong gaps over weak padding; include at least one coverage- or disclosure-type gap when applicable.\n` +
    `When possible, one bullet should name time periods or document types (e.g. Q3 earnings vs FY 10-K).\n` +
    `Do not use the same template repeatedly (e.g. avoid five “company claims X / media claims Y” lines). ` +
    `Do not use “sentiment”, “market reaction”, or evaluative adjectives.\n\n` +
    `SOURCES:\n` +
    `- company_sources: URLs that are ONLY official IR / SEC / earnings (same scope as company narrative).\n` +
    `- media_sources: URLs that are ONLY third-party (same scope as media narrative). Never put a company official URL in media_sources.\n` +
    `- items: same objects as company_sources + media_sources combined (dedupe by URL).\n\n` +
    `Respond with ONLY valid JSON (no markdown fences) in this exact shape:\n` +
    `{\n` +
    `  "factual_gaps": [ { "category": "numeric"|"disclosure"|"timing"|"definition"|"coverage", "text": string } | string ],\n` +
    `  "company_narrative": string,\n` +
    `  "company_sources": [\n` +
    `    { "title": string, "url": string, "source": string|null, "snippet": string|null, "published_at": string|null }\n` +
    `  ],\n` +
    `  "media_narrative": string,\n` +
    `  "media_sources": [\n` +
    `    { "title": string, "url": string, "source": string|null, "snippet": string|null, "published_at": string|null }\n` +
    `  ],\n` +
    `  "synthesis": string,\n` +
    `  "items": [ /* union of company_sources and media_sources; same schema */ ]\n` +
    `}\n` +
    `Cap factual_gaps at 5; cap company_sources and media_sources at 12 each; omit duplicate URLs.`
  )
}

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

type FactualGapRow = { text: string; category?: string }

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
  // Heuristic: good enough for most .com/.io/.ai. May be imperfect for co.uk-style domains.
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

async function reconcileSources(
  supabase: ReturnType<typeof createClient>,
  parsedItems: Array<Record<string, unknown>>,
  companySlug: string,
): Promise<Array<Record<string, unknown>>> {
  // Fetch official roots from DB
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', companySlug)
    .maybeSingle()

  if (!company?.id) return parsedItems

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
  const officialRoots = [...roots]

  // Reassign any leaked first-party or syndicated-PR items
  const reconciled = parsedItems.map((item) => {
    const url = typeof item.url === 'string' ? item.url : ''
    if (!url) return item
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
      if (isSyndicatedPressHost(host)) {
        return { ...item, narrative_scope: 'company' }
      }
    } catch {
      // fall through
    }
    if (isUnderOfficialRoot(url, officialRoots)) {
      return { ...item, narrative_scope: 'company' }
    }
    return item
  })

  // Simple dedupe by URL
  return reconciled.filter((item, index, self) => {
    const url = typeof item.url === 'string' ? item.url : ''
    if (!url) return false
    return index === self.findIndex((t) => (typeof t.url === 'string' ? t.url : '') === url)
  })
}

function parseResponse(content: string): {
  synthesis: string | null
  company_narrative: string | null
  media_narrative: string | null
  factual_gaps: FactualGapRow[]
  items: Array<Record<string, unknown>>
} {
  const trimmed = content.trim()
  let jsonStr = trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) jsonStr = fence[1].trim()

  const parsed = JSON.parse(jsonStr) as unknown

  // Support legacy bare array
  if (Array.isArray(parsed)) {
    return {
      synthesis: null,
      company_narrative: null,
      media_narrative: null,
      factual_gaps: [] as FactualGapRow[],
      items: sanitizeItems(parsed),
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Model did not return expected JSON shape')
  }

  const obj = parsed as Record<string, unknown>

  const synthesis          = typeof obj.synthesis          === 'string' ? obj.synthesis.trim()          || null : null
  const company_narrative  = typeof obj.company_narrative  === 'string' ? obj.company_narrative.trim()  || null : null
  const media_narrative    = typeof obj.media_narrative    === 'string' ? obj.media_narrative.trim()    || null : null

  const factual_gaps = parseFactualGaps(obj.factual_gaps)

  // Merge all sources into items[]
  const companySources = Array.isArray(obj.company_sources)
    ? sanitizeItems(obj.company_sources, 12, 'company')
    : []
  const mediaSources = Array.isArray(obj.media_sources)
    ? sanitizeItems(obj.media_sources, 12, 'media')
    : []
  const legacyItems = Array.isArray(obj.items) ? sanitizeItems(obj.items, 25) : []

  // Deduplicate by URL — company rows first, then media, then untagged legacy (score URL for bucket).
  const urlSeen = new Set<string>()
  const items: Array<Record<string, unknown>> = []
  for (const item of [...companySources, ...mediaSources]) {
    const url = item.url as string
    if (!urlSeen.has(url)) {
      urlSeen.add(url)
      items.push(item)
    }
    if (items.length >= 25) break
  }
  for (const item of legacyItems) {
    const url = item.url as string
    if (urlSeen.has(url)) continue
    urlSeen.add(url)
    if (!item.narrative_scope) {
      item.narrative_scope = scoreResearchUrl(url) >= 55 ? 'company' : 'media'
    }
    items.push(item)
    if (items.length >= 25) break
  }

  return { synthesis, company_narrative, media_narrative, factual_gaps, items }
}

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
      return new Response(JSON.stringify({ error: 'PERPLEXITY_API_KEY not set on Edge Function' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const model = Deno.env.get('PERPLEXITY_MODEL')?.trim() || 'sonar-pro'

    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${perplexityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You have access to web search. Enforce strict source separation at all times. Company narrative + company_sources: ONLY official IR, SEC filings, earnings releases, and company press releases. Media & Analyst narrative + media_sources: ONLY truly independent third-party sources; NEVER cite the company website/subdomains; treat syndicated press releases (PR Newswire/GlobeNewswire/Business Wire/Newsfile) as company messaging; exclude official company social/video channels; if independent coverage is limited, explicitly say "Limited independent media and analyst coverage found." and return fewer/zero media_sources rather than padding with first-party content. Remain neutral: no sentiment, no investment advice. Return only valid JSON as instructed. No markdown fences.',
          },
          {
            role: 'user',
            content: buildPrompt(companyName, body.ticker ?? null),
          },
        ],
      }),
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { synthesis, company_narrative, media_narrative, factual_gaps, items: rawItems } = parseResponse(content)
    const reconciledItems = await reconcileSources(supabase, rawItems, slug)
    const items = rankResearchItems(reconciledItems)
    const { error: upErr } = await supabase.from('company_research_cache').upsert(
      {
        slug,
        company_name: companyName,
        ticker: body.ticker ?? null,
        items,
        synthesis: synthesis ?? null,
        company_narrative: company_narrative ?? null,
        media_narrative: media_narrative ?? null,
        factual_gaps: factual_gaps ?? [],
        fetched_at: new Date().toISOString(),
        error: null,
        model,
      },
      { onConflict: 'slug' },
    )

    if (upErr) throw upErr

    return new Response(
      JSON.stringify({ ok: true, items, synthesis, company_narrative, media_narrative, factual_gaps, model, count: items.length }),
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
