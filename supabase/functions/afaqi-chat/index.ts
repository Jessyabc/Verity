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
 *  4. Classify intent of the new message (context_only | cross_company | research_needed)
 *  5. Fetch cross-company context or live Perplexity research as needed
 *  6. Call OpenAI for synthesis
 *  7. Persist user + assistant messages to chat_messages; refresh conversation title via LLM at 2 and 20 messages
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
- Never invent facts, numbers, dates, events, or conclusions.
- Never answer from generic memory when a source-backed answer is possible.
- If the evidence is incomplete, say so plainly.
- If sources conflict, explain the conflict rather than forcing certainty.
- Show source references, titles, or source labels whenever possible.

WHEN ADDITIONAL CONTEXT IS PROVIDED
- You may draw on injected cross-company research or live web research when it has been provided to you in the context blocks below.
- Always attribute which company or search result each piece of information comes from.
- If a company mentioned is not currently tracked in Verity, say so naturally (e.g. "This company isn't currently tracked in Verity's research database, but based on available sources…").

WHAT YOU ARE FOR
- Explaining and comparing company research across primary and referenced companies.
- Answering factual, scientific, or market questions using live research when it has been provided.
- Pointing users to the right headlines and sources.
- Helping users ask deeper follow-up questions.
- Clarifying what is verified vs. interpreted.

WHAT YOU ARE NOT FOR
- Unverified speculation or general web chat without sources.
- Investment advice or buy/sell recommendations.
- Hiding uncertainty — if you don't have the evidence, say so.

RESPONSE STYLE
- Start with the direct answer.
- Give a short explanation.
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
}

type CacheRow = {
  slug: string
  company_name: string
  ticker: string | null
  items: ResearchItem[]
  fetched_at: string
}

type AfaqiSource = {
  title: string
  url: string
  source?: string
}

type Intent = {
  type: 'context_only' | 'cross_company' | 'research_needed'
  companies: string[]
  query: string
}

type PerplexityResult = {
  content: string
  sources: AfaqiSource[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildResearchContext(row: CacheRow): string {
  const ticker = row.ticker ? ` (${row.ticker})` : ''
  const lines: string[] = [
    `COMPANY: ${row.company_name}${ticker}`,
    `Research last updated: ${new Date(row.fetched_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })}`,
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

/** Returns true when a cache row is fresh enough to use directly (< 48 h old). */
function isCacheFresh(fetchedAt: string): boolean {
  const age = Date.now() - new Date(fetchedAt).getTime()
  return age < 48 * 60 * 60 * 1000
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

/** Classify the user message to determine what extra context is needed. */
async function classifyIntent(
  message: string,
  primaryCompanyName: string,
  openaiKey: string,
): Promise<Intent> {
  const fallback: Intent = { type: 'context_only', companies: [], query: '' }
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
            content: `Classify the user message for a financial research assistant. Respond with JSON only.
Primary company in context: "${primaryCompanyName}"

Intent types:
- "context_only": the question is answerable from the primary company's existing research (no external lookup needed)
- "cross_company": the user mentions a DIFFERENT specific company, stock, or organisation by name or ticker that is NOT the primary company
- "research_needed": the user asks about a general topic, technology, concept, scientific area, or market theme that requires a web search to answer well (e.g. "what is NVLink?", "latest quantum computing research", "how does trapped-ion work?")

Note: if a question is both cross_company AND research_needed (e.g. "how does Nvidia's NVLink compare?"), prefer "cross_company".

Output JSON only:
{
  "type": "context_only" | "cross_company" | "research_needed",
  "companies": ["CompanyName or TICKER"],
  "query": "concise web search query string (empty string if context_only)"
}`,
          },
          { role: 'user', content: message },
        ],
        temperature: 0,
        max_tokens: 120,
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) return fallback
    const json = await res.json()
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? '{}')
    return {
      type: parsed.type ?? 'context_only',
      companies: Array.isArray(parsed.companies) ? parsed.companies.slice(0, 3) : [],
      query: typeof parsed.query === 'string' ? parsed.query : '',
    }
  } catch {
    return fallback
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

  // 1. Primary company research context
  const { data: cacheRow } = await db
    .from('company_research_cache')
    .select('slug, company_name, ticker, items, fetched_at')
    .eq('slug', slug)
    .maybeSingle()

  const primaryContext = cacheRow
    ? buildResearchContext(cacheRow as CacheRow)
    : `No research context found for "${slug}". Tell the user to run research on this company first from the company profile.`

  const primaryCompanyName = (cacheRow as CacheRow | null)?.company_name ?? slug

  // 2. Load conversation history (last 20 turns, ascending order)
  const { data: historyRows } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20)

  const history = sanitizeHistory([...(historyRows ?? [])].reverse())

  // 3. Classify intent (run in parallel with nothing yet, kept sequential for clarity)
  const intent = await classifyIntent(message, primaryCompanyName, openaiKey)

  // 4. Gather additional context blocks
  const contextBlocks: string[] = []
  const extraSources: AfaqiSource[] = []
  const extraContextSlugs: string[] = []

  if (intent.type === 'cross_company' && intent.companies.length > 0) {
    // Process up to 2 cross-company lookups
    for (const companyRef of intent.companies.slice(0, 2)) {
      // Look up in Verity's companies table (name or ticker match)
      const { data: foundCompany } = await db
        .from('companies')
        .select('slug, name, ticker')
        .or(`name.ilike.%${companyRef}%,ticker.ilike.${companyRef.toUpperCase()}`)
        .limit(1)
        .maybeSingle()

      if (foundCompany) {
        // Try cache first
        const { data: otherCache } = await db
          .from('company_research_cache')
          .select('slug, company_name, ticker, items, fetched_at')
          .eq('slug', foundCompany.slug)
          .maybeSingle()

        if (otherCache && isCacheFresh((otherCache as CacheRow).fetched_at)) {
          const otherCtx = buildResearchContext(otherCache as CacheRow)
          contextBlocks.push(
            `--- CROSS-COMPANY CONTEXT: ${(otherCache as CacheRow).company_name}${(otherCache as CacheRow).ticker ? ` (${(otherCache as CacheRow).ticker})` : ''} (from Verity research cache) ---\n${otherCtx}`,
          )
          extraContextSlugs.push(foundCompany.slug)
        } else if (perplexityKey) {
          // Cache stale or missing — do a targeted Perplexity fetch
          const result = await searchPerplexity(
            `${foundCompany.name}${foundCompany.ticker ? ` ${foundCompany.ticker}` : ''} company overview latest news`,
            perplexityKey,
          )
          if (result.content) {
            contextBlocks.push(
              `--- CROSS-COMPANY CONTEXT: ${foundCompany.name} (live search — research cache is stale or unavailable) ---\n${result.content}`,
            )
            extraSources.push(...result.sources)
            extraContextSlugs.push(foundCompany.slug)
          }
        }
      } else if (perplexityKey) {
        // Company not in Verity's database at all
        const result = await searchPerplexity(
          `${companyRef} company overview recent news`,
          perplexityKey,
        )
        if (result.content) {
          contextBlocks.push(
            `--- CROSS-COMPANY CONTEXT: ${companyRef} (not currently tracked in Verity — live search results) ---\n${result.content}`,
          )
          extraSources.push(...result.sources)
        }
      }
    }
  } else if (intent.type === 'research_needed' && intent.query && perplexityKey) {
    const result = await searchPerplexity(intent.query, perplexityKey)
    if (result.content) {
      contextBlocks.push(
        `--- LIVE RESEARCH: "${intent.query}" ---\n${result.content}`,
      )
      extraSources.push(...result.sources)
    }
  }

  // 5. Build OpenAI message list
  const openaiMessages: { role: string; content: string }[] = [
    { role: 'system', content: AFAQI_SYSTEM_PROMPT },
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
      max_tokens: 1000,
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
