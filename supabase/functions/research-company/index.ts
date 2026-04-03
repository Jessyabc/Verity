/**
 * Invoke from the app: supabase.functions.invoke('research-company', { body: { slug, companyName, ticker } })
 * Secrets: PERPLEXITY_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function buildPrompt(companyName: string, ticker: string | null): string {
  const t = ticker ? ` (${ticker})` : ''
  return (
    `You are helping an equity research analyst stay current on ${companyName}${t}.\n\n` +
    `Using web search, list as many distinct, recent (last ~30 days when possible) news items as you can — ` +
    `official IR/SEC/press preferred; reputable outlets otherwise.\n\n` +
    `Respond with ONLY valid JSON (no markdown fences): an array of objects, each with:\n` +
    `"title" (string), "url" (string, https), "source" (string or null), "snippet" (string, 1–2 sentences or null), ` +
    `"published_at" (ISO date string or human-readable date or null).\n` +
    `Cap at 25 items; omit duplicates.`
  )
}

function parseItems(content: string): Array<Record<string, unknown>> {
  const trimmed = content.trim()
  let jsonStr = trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) jsonStr = fence[1].trim()
  const parsed = JSON.parse(jsonStr) as unknown
  if (!Array.isArray(parsed)) throw new Error('Model did not return a JSON array')
  const out: Array<Record<string, unknown>> = []
  for (const row of parsed) {
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
    if (out.length >= 25) break
  }
  return out
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
              'You have access to web search. Return only valid JSON arrays as instructed. No markdown.',
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

    const items = parseItems(content)

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
        fetched_at: new Date().toISOString(),
        error: null,
        model,
      },
      { onConflict: 'slug' },
    )

    if (upErr) throw upErr

    return new Response(JSON.stringify({ ok: true, items, model, count: items.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
