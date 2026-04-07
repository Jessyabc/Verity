/**
 * POST {} — builds a neutral, fact-only watchlist summary from cached research + monitored documents.
 * Secrets: OPENAI_API_KEY, OPENAI_WATCHLIST_MODEL (optional, default gpt-4o-mini),
 *          SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSession } from '../_shared/requireSession.ts'

type ResearchItem = { title?: string; snippet?: string | null }

type CompanyBriefInput = {
  slug: string
  name: string
  ticker: string | null
  research_fetched_at: string | null
  research_error: string | null
  research_items: { title: string; snippet: string | null }[]
  monitored: { title: string | null; summary: string | null; checked_at: string | null }[]
}

function buildUserPrompt(payload: { companies: CompanyBriefInput[] }): string {
  return (
    `CONTEXT (facts only — do not add facts not listed here):\n\n` +
    `${JSON.stringify(payload, null, 2)}\n\n` +
    `Write 2–4 short paragraphs of plain prose summarizing what appears in CONTEXT for this watchlist. ` +
    `If a company has no research items and no monitored rows, state that no cached updates are present for that name.`
  )
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

    const url = Deno.env.get('SUPABASE_URL')?.trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(url, serviceKey)

    const { data: wlRows, error: wlErr } = await supabase
      .from('user_watchlist')
      .select('company_slug')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: true })

    if (wlErr) throw wlErr

    const slugs = [...new Set((wlRows ?? []).map((r) => r.company_slug as string).filter(Boolean))]

    if (slugs.length === 0) {
      return new Response(
        JSON.stringify({
          brief:
            'Your watchlist is empty. Add companies from search or a company profile, then generate a summary again.',
          model: null,
          generated_at: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { data: companyRows, error: cErr } = await supabase
      .from('companies')
      .select('id, slug, name, ticker')
      .in('slug', slugs)

    if (cErr) throw cErr

    const bySlug = new Map((companyRows ?? []).map((c) => [c.slug as string, c]))

    const { data: researchRows, error: rErr } = await supabase
      .from('company_research_cache')
      .select('slug, items, fetched_at, error')
      .in('slug', slugs)

    if (rErr) throw rErr

    const researchBySlug = new Map<string, { items: ResearchItem[]; fetched_at: string | null; error: string | null }>()
    for (const row of researchRows ?? []) {
      const raw = row.items as unknown
      const items = Array.isArray(raw) ? (raw as ResearchItem[]) : []
      researchBySlug.set(row.slug as string, {
        items,
        fetched_at: (row.fetched_at as string) ?? null,
        error: (row.error as string | null) ?? null,
      })
    }

    const companyIds = (companyRows ?? []).map((c) => c.id as string)
    const docsByCompany = new Map<
      string,
      { title: string | null; summary: string | null; checked_at: string | null }[]
    >()

    if (companyIds.length > 0) {
      const { data: docRows, error: dErr } = await supabase
        .from('tracked_documents')
        .select('company_id, title, summary_text, last_checked_at, first_seen_at')
        .in('company_id', companyIds)
        .order('last_checked_at', { ascending: false, nullsFirst: false })
        .limit(200)

      if (dErr) throw dErr

      const perCap = 5
      for (const d of docRows ?? []) {
        const cid = d.company_id as string
        const arr = docsByCompany.get(cid) ?? []
        if (arr.length >= perCap) continue
        const checked =
          (d.last_checked_at as string | null) ?? (d.first_seen_at as string | null) ?? null
        arr.push({
          title: (d.title as string | null) ?? null,
          summary: (d.summary_text as string | null) ?? null,
          checked_at: checked,
        })
        docsByCompany.set(cid, arr)
      }
    }

    const companies: CompanyBriefInput[] = []
    for (const slug of slugs) {
      const c = bySlug.get(slug)
      if (!c) {
        companies.push({
          slug,
          name: slug,
          ticker: null,
          research_fetched_at: null,
          research_error: null,
          research_items: [],
          monitored: [],
        })
        continue
      }
      const rs = researchBySlug.get(slug)
      const research_items = (rs?.items ?? [])
        .slice(0, 6)
        .map((it) => ({
          title: typeof it.title === 'string' ? it.title : '',
          snippet: typeof it.snippet === 'string' ? it.snippet : null,
        }))
        .filter((it) => it.title)

      companies.push({
        slug,
        name: c.name as string,
        ticker: (c.ticker as string | null) ?? null,
        research_fetched_at: rs?.fetched_at ?? null,
        research_error: rs?.error ?? null,
        research_items,
        monitored: docsByCompany.get(c.id as string) ?? [],
      })
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not set on Edge Function' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const model = Deno.env.get('OPENAI_WATCHLIST_MODEL')?.trim() || 'gpt-4o-mini'

    const system = [
      'You summarize equity watchlist activity for a professional reader.',
      'Output 2–4 short paragraphs of plain prose (no bullets, no markdown headings).',
      '',
      'Strict rules:',
      '- Use ONLY information in the user message CONTEXT JSON. If a fact is not there, do not infer it.',
      '- No investment advice, recommendations, buy/sell language, or predictions.',
      '- Avoid opinion or evaluative wording (e.g. good, bad, strong, weak, worry, opportunity, should, attractive, concerning).',
      '- Prefer neutral reporting: filed, announced, listed, updated, published, according to cached snippets.',
      '- If research_error is non-null for a company, you may note that the research cache reported an error (do not invent a cause).',
      '- If both research_items and monitored are empty for a company, say there are no cached research or monitored page updates for that company.',
      '- You may briefly note recency using provided dates (e.g. "as of …") when dates exist.',
    ].join('\n')

    const userContent = buildUserPrompt({ companies })

    const ores = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 700,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    })

    if (!ores.ok) {
      const t = await ores.text()
      throw new Error(`OpenAI HTTP ${ores.status}: ${t.slice(0, 400)}`)
    }

    const ojson = (await ores.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const brief = ojson.choices?.[0]?.message?.content?.trim()
    if (!brief) throw new Error('Empty OpenAI response')

    const generated_at = new Date().toISOString()

    return new Response(JSON.stringify({ brief, model, generated_at }), {
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
