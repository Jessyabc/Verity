/**
 * Afaqi — contextual research assistant for a specific company.
 *
 * Invoke: supabase.functions.invoke('afaqi-chat', {
 *   body: { slug: string, messages: { role: 'user' | 'assistant', content: string }[] }
 * })
 * Requires a signed-in user (Authorization: Bearer <access_token>).
 * Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Afaqi only answers from the company's current research context.
 * It cites sources and clearly separates fact from synthesis.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { requireSession } from '../_shared/requireSession.ts'

const AFAQI_SYSTEM_PROMPT = `You are Afaqi, the research assistant inside Verity.

Your job is to help users explore a specific company's research context with maximum trust, clarity, and grounding.

NON-NEGOTIABLE RULES
- Use only the provided research context, source bundles, and current company information.
- Never invent facts, numbers, dates, events, or conclusions.
- Never answer from generic memory when a source-backed answer is possible.
- If the evidence is incomplete, say so plainly.
- If sources conflict, explain the conflict rather than forcing certainty.
- If the user asks for information not supported by the available research, say you cannot verify it from the current sources.
- Show source references, titles, or source labels whenever possible.
- Stay focused on the current company and its research context.

WHAT YOU ARE FOR
- Explaining the latest summary.
- Comparing public narrative vs. company narrative.
- Pointing users to the right headlines and source bundles.
- Helping users ask deeper follow-up questions about the research.
- Clarifying what is verified vs. interpreted.

WHAT YOU ARE NOT FOR
- General web chat.
- Unverified speculation.
- Broad market commentary unrelated to the current company context.
- Hidden reasoning without evidence.
- Replacing the source trail.

RESPONSE STYLE
- Start with the direct answer.
- Then give a short explanation.
- Then cite or list the supporting sources used.
- Keep responses concise and useful.
- Be calm, precise, and analyst-like.
- Friendly, but never casual in a way that reduces credibility.

ANSWERING BEHAVIOR
- Prefer grounded, source-specific language: "Based on the current research…", "The evidence suggests…", "I can verify…", "I cannot confirm from the available sources…"
- When useful, mention which headline or source bundle the user should open next.
- If a question has multiple interpretations, ask a brief clarifying question instead of guessing.

SOURCE DISCLOSURE
Whenever possible, include source title, source type, date, and a reference label.
Format citations as: [Source: title — domain]

After your answer, output a JSON block on the last line in this exact format (no extra text after it):
SOURCES_JSON: [{"title":"...","url":"...","source":"..."}]
If there are no specific sources to cite, output: SOURCES_JSON: []`

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ResearchItem = {
  title: string
  url: string
  snippet: string | null
  source: string | null
  published_at: string | null
}

type CacheRow = {
  slug: string
  company_name: string
  ticker: string | null
  items: ResearchItem[]
  fetched_at: string
}

function buildResearchContext(row: CacheRow): string {
  const ticker = row.ticker ? ` (${row.ticker})` : ''
  const lines: string[] = [
    `COMPANY: ${row.company_name}${ticker}`,
    `Research last updated: ${new Date(row.fetched_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    '',
    'RESEARCH SOURCES:',
  ]

  row.items.forEach((item, i) => {
    lines.push(`${i + 1}. ${item.title}`)
    if (item.source) lines.push(`   Source: ${item.source}`)
    if (item.published_at) lines.push(`   Date: ${item.published_at}`)
    lines.push(`   URL: ${item.url}`)
    if (item.snippet) lines.push(`   Summary: ${item.snippet}`)
    lines.push('')
  })

  return lines.join('\n')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const sessionResult = await requireSession(req)
  if ('response' in sessionResult) return sessionResult.response

  const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
  if (!openaiKey) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  let slug: string
  let messages: ChatMessage[]
  try {
    const body = await req.json()
    slug = body.slug
    messages = body.messages ?? []
    if (!slug || typeof slug !== 'string') throw new Error('slug required')
    if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages required')
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Bad request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  // Fetch research context from Supabase (service role for reliability)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'Supabase env vars missing' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const db = createClient(supabaseUrl, serviceKey)
  const { data: cacheRow, error: dbErr } = await db
    .from('company_research_cache')
    .select('slug, company_name, ticker, items, fetched_at')
    .eq('slug', slug)
    .maybeSingle()

  if (dbErr) {
    return new Response(
      JSON.stringify({ error: 'Failed to load research context' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const researchContext = cacheRow
    ? buildResearchContext(cacheRow as CacheRow)
    : `No research context found for "${slug}". Tell the user to run research on this company first.`

  // Build OpenAI messages: system + context injection + conversation
  const openaiMessages = [
    { role: 'system', content: AFAQI_SYSTEM_PROMPT },
    {
      role: 'system',
      content: `CURRENT RESEARCH CONTEXT:\n\n${researchContext}`,
    },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ]

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
      max_tokens: 800,
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    return new Response(
      JSON.stringify({ error: `OpenAI error: ${errText}` }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const openaiJson = await openaiRes.json()
  const rawContent: string = openaiJson.choices?.[0]?.message?.content ?? ''

  // Parse the trailing SOURCES_JSON line
  let messageText = rawContent
  let sources: { title: string; url: string; source?: string }[] = []

  const sourcesMatch = rawContent.match(/SOURCES_JSON:\s*(\[.*\])\s*$/s)
  if (sourcesMatch) {
    try {
      sources = JSON.parse(sourcesMatch[1])
    } catch {
      sources = []
    }
    messageText = rawContent.slice(0, sourcesMatch.index).trim()
  }

  return new Response(
    JSON.stringify({ message: messageText, sources }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
