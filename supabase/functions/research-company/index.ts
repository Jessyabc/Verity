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
    `You are a neutral equity research analyst. Your job is to surface the factual gap between ` +
    `what ${companyName}${t} officially communicates (Company Narrative) and what independent ` +
    `media, sell-side analysts, and financial journalists are reporting (Media & Analyst Narrative).\n\n` +
    `RULES:\n` +
    `- 100% factual and neutral. No interpretation, no sentiment, no advice.\n` +
    `- Never use words like "bullish", "bearish", "buy", "sell", or "should".\n` +
    `- Do NOT use YouTube, TikTok, Facebook, Instagram, Reddit, or fan blogs.\n\n` +
    `SOURCE SPLIT:\n` +
    `  Company Narrative → only: investor relations, press releases, 10-K, 10-Q, 8-K, earnings transcripts, SEC EDGAR.\n` +
    `  Media & Analyst Narrative → only: WSJ, Bloomberg, Reuters, FT, Barron's, analyst notes, credible trade press.\n\n` +
    `Respond with ONLY valid JSON (no markdown fences) in this exact shape:\n` +
    `{\n` +
    `  "factual_gaps": [\n` +
    `    "Company reported $X revenue; analyst consensus expected $Y → $Z difference",\n` +
    `    "Topic X mentioned N times in media coverage this quarter but absent from latest 10-K/earnings call"\n` +
    `  ],\n` +
    `  "company_narrative": "3-5 sentence neutral summary of what the company officially says. Cite specific filings or statements.",\n` +
    `  "company_sources": [\n` +
    `    { "title": string, "url": string (https), "source": string|null, "snippet": string|null, "published_at": string|null }\n` +
    `  ],\n` +
    `  "media_narrative": "3-5 sentence neutral summary of what media and analysts are reporting. No editorialising.",\n` +
    `  "media_sources": [\n` +
    `    { "title": string, "url": string (https), "source": string|null, "snippet": string|null, "published_at": string|null }\n` +
    `  ],\n` +
    `  "synthesis": "2-3 sentence factual overview combining both narratives.",\n` +
    `  "items": [ /* all sources combined, same schema as above */ ]\n` +
    `}\n` +
    `Cap factual_gaps at 5; cap each source array at 12; omit duplicates.`
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

function sanitizeItems(rawItems: unknown[], cap = 25): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = []
  for (const row of rawItems) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    const url   = typeof o.url   === 'string' ? o.url.trim()   : ''
    if (!title || !url.startsWith('http')) continue
    items.push({
      title,
      url,
      source:       typeof o.source       === 'string' ? o.source       : null,
      snippet:      typeof o.snippet      === 'string' ? o.snippet      : null,
      published_at: typeof o.published_at === 'string' ? o.published_at : null,
    })
    if (items.length >= cap) break
  }
  return items
}

function parseResponse(content: string): {
  synthesis: string | null
  company_narrative: string | null
  media_narrative: string | null
  factual_gaps: string[]
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
      factual_gaps: [],
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

  const factual_gaps: string[] = []
  if (Array.isArray(obj.factual_gaps)) {
    for (const g of obj.factual_gaps) {
      if (typeof g === 'string' && g.trim()) factual_gaps.push(g.trim())
      if (factual_gaps.length >= 5) break
    }
  }

  // Merge all sources into items[]
  const companySources = Array.isArray(obj.company_sources) ? sanitizeItems(obj.company_sources, 12) : []
  const mediaSources   = Array.isArray(obj.media_sources)   ? sanitizeItems(obj.media_sources,   12) : []
  const legacyItems    = Array.isArray(obj.items)            ? sanitizeItems(obj.items,           25) : []

  // Deduplicate by URL, prefer typed sources
  const urlSeen = new Set<string>()
  const items: Array<Record<string, unknown>> = []
  for (const item of [...companySources, ...mediaSources, ...legacyItems]) {
    const url = item.url as string
    if (!urlSeen.has(url)) { urlSeen.add(url); items.push(item) }
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
              'You have access to web search. Prefer URLs on the issuer official domain, investor relations, press/newsroom, and sec.gov. Avoid YouTube and general social unless it is clearly the company official channel. Return only valid JSON arrays as instructed. No markdown.',
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

    const { synthesis, company_narrative, media_narrative, factual_gaps, items: rawItems } = parseResponse(content)
    const items = rankResearchItems(rawItems)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)
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
