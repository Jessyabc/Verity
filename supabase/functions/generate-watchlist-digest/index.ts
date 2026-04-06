/**
 * Cross-portfolio synthesis digest for the user's watchlist.
 *
 * Invoke: supabase.functions.invoke('generate-watchlist-digest', {
 *   body: { slugs: string[] }
 * })
 * Requires a signed-in user (Authorization: Bearer <access_token>).
 * Secrets: PERPLEXITY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Process:
 *  1. Fetch company_research_cache rows for the supplied slugs.
 *  2. Build a cross-portfolio synthesis prompt with all company contexts.
 *  3. Call Perplexity sonar-pro — grounded in web search + scientific sources.
 *  4. Parse JSON response: { digest, sources }.
 *  5. Upsert into watchlist_digest (one row per user, always overwritten).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSession } from '../_shared/requireSession.ts'

type ResearchItem = {
  title: string
  url: string
  snippet: string | null
  source: string | null
}

type CacheRow = {
  slug: string
  company_name: string
  ticker: string | null
  items: ResearchItem[]
  fetched_at: string
}

type DigestSource = {
  title: string
  url: string
  type: 'paper' | 'news' | 'filing' | 'report'
  relevance: string
}

type DigestResponse = {
  digest: string
  sources: DigestSource[]
}

function buildCompanyContext(row: CacheRow): string {
  const ticker = row.ticker ? ` (${row.ticker})` : ''
  const items = (row.items ?? []).slice(0, 6)
  if (items.length === 0) return `**${row.company_name}${ticker}**: No recent data available.`
  const lines = items
    .map((it) => `  - ${it.title}${it.snippet ? ': ' + it.snippet : ''}`)
    .join('\n')
  return `**${row.company_name}${ticker}**:\n${lines}`
}

function buildPrompt(companies: CacheRow[]): string {
  const contexts = companies.map(buildCompanyContext).join('\n\n')

  return (
    `You are a cross-sector research analyst and scientist. The user tracks these companies:\n\n` +
    `${contexts}\n\n` +
    `Using your web search capability, synthesize a forward-looking digest that:\n` +
    `1. Identifies the most important macro and industry movements relevant to this specific portfolio — name companies and explain why they stand out.\n` +
    `2. Surfaces correlating scientific papers, preprints (arXiv), regulatory reports, or investor research that ground the analysis. Include DOI or arXiv IDs where available.\n` +
    `3. Draws cross-portfolio patterns: technology convergences, sector rotations, supply chain signals, policy tailwinds or headwinds.\n\n` +
    `Quality standards: be specific, cite credible sources, avoid vague commentary. The reader is a sophisticated investor.\n\n` +
    `Respond with ONLY valid JSON (no markdown fences, no prose outside the object):\n` +
    `{\n` +
    `  "digest": "2-3 flowing paragraphs as a single string — rich, specific, grounded",\n` +
    `  "sources": [\n` +
    `    {\n` +
    `      "title": "Full source title",\n` +
    `      "url": "https://...",\n` +
    `      "type": "paper | news | filing | report",\n` +
    `      "relevance": "One sentence: why this matters to the portfolio"\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Cap sources at 12. Prioritize: arXiv/DOI papers, SEC filings, earnings transcripts, reputable research institutions. No social media.`
  )
}

function parseDigest(content: string): DigestResponse {
  const trimmed = content.trim()
  let jsonStr = trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) jsonStr = fence[1].trim()

  const parsed = JSON.parse(jsonStr) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Model did not return a JSON object')
  }
  const obj = parsed as Record<string, unknown>

  const digest = typeof obj.digest === 'string' ? obj.digest.trim() : ''
  if (!digest) throw new Error('Model returned empty digest')

  const rawSources = Array.isArray(obj.sources) ? obj.sources : []
  const sources: DigestSource[] = []
  for (const s of rawSources) {
    if (!s || typeof s !== 'object') continue
    const o = s as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    const url = typeof o.url === 'string' ? o.url.trim() : ''
    if (!title || !url.startsWith('http')) continue
    sources.push({
      title,
      url,
      type: (['paper', 'news', 'filing', 'report'] as const).includes(o.type as never)
        ? (o.type as DigestSource['type'])
        : 'news',
      relevance: typeof o.relevance === 'string' ? o.relevance.trim() : '',
    })
    if (sources.length >= 12) break
  }

  return { digest, sources }
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
    const userId = auth.user.id

    const body = (await req.json()) as { slugs?: string[] }
    const slugs = Array.isArray(body.slugs) ? body.slugs.filter((s) => typeof s === 'string') : []

    if (slugs.length === 0) {
      return new Response(JSON.stringify({ error: 'slugs array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY')?.trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()

    if (!perplexityKey || !supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing server secrets (PERPLEXITY_API_KEY, SUPABASE_*)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Mark as generating (prevent concurrent duplicate calls)
    await supabase.from('watchlist_digest').upsert(
      { user_id: userId, is_generating: true, slugs_snapshot: slugs },
      { onConflict: 'user_id' },
    )

    // Fetch research cache for all watchlist companies
    const { data: cacheRows, error: fetchErr } = await supabase
      .from('company_research_cache')
      .select('slug, company_name, ticker, items, fetched_at')
      .in('slug', slugs)

    if (fetchErr) throw fetchErr

    const companies = (cacheRows ?? []) as CacheRow[]

    if (companies.length === 0) {
      // No research context yet — store a placeholder and return
      await supabase.from('watchlist_digest').upsert(
        {
          user_id: userId,
          digest_text: '',
          sources: [],
          slugs_snapshot: slugs,
          generated_at: new Date().toISOString(),
          model: null,
          is_generating: false,
        },
        { onConflict: 'user_id' },
      )
      return new Response(
        JSON.stringify({ ok: true, digest: '', sources: [], note: 'No research cache yet — run company research first' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
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
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are a cross-sector analyst with access to web search. ' +
              'Prioritize academic papers (arXiv, DOI), SEC filings, and reputable financial/scientific press. ' +
              'Return only valid JSON as instructed. No markdown outside the JSON object.',
          },
          {
            role: 'user',
            content: buildPrompt(companies),
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
      model?: string
    }
    const content = pjson.choices?.[0]?.message?.content
    if (!content) throw new Error('Empty Perplexity response')

    const { digest, sources } = parseDigest(content)
    const usedModel = pjson.model ?? model

    await supabase.from('watchlist_digest').upsert(
      {
        user_id: userId,
        digest_text: digest,
        sources,
        slugs_snapshot: slugs,
        generated_at: new Date().toISOString(),
        model: usedModel,
        is_generating: false,
      },
      { onConflict: 'user_id' },
    )

    return new Response(
      JSON.stringify({ ok: true, digest, sources, model: usedModel }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Clear generating flag on error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
      if (supabaseUrl && serviceKey) {
        const sb = createClient(supabaseUrl, serviceKey)
        const auth = await requireSession(req).catch(() => null)
        if (auth && !('response' in auth)) {
          await sb.from('watchlist_digest').update({ is_generating: false }).eq('user_id', auth.user.id)
        }
      }
    } catch { /* best effort */ }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
