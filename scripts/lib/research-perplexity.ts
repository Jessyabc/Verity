/**
 * Perplexity Sonar — structured news for company research (Node scripts).
 */
import type { ResearchNewsItem } from '../../src/lib/research/types.ts'

const API = 'https://api.perplexity.ai/chat/completions'

export function buildResearchUserPrompt(
  companyName: string,
  ticker: string | null,
): string {
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

function parseItemsFromContent(content: string): ResearchNewsItem[] {
  const trimmed = content.trim()
  let jsonStr = trimmed
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) jsonStr = fence[1].trim()
  const parsed = JSON.parse(jsonStr) as unknown
  if (!Array.isArray(parsed)) throw new Error('Model did not return a JSON array')
  const out: ResearchNewsItem[] = []
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

export async function fetchCompanyResearchFromPerplexity(
  companyName: string,
  ticker: string | null,
): Promise<{ items: ResearchNewsItem[]; model: string }> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim()
  if (!apiKey) throw new Error('Missing PERPLEXITY_API_KEY')

  const model =
    process.env.PERPLEXITY_MODEL?.trim() || 'sonar-pro'

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
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
          content: buildResearchUserPrompt(companyName, ticker),
        },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Perplexity HTTP ${res.status}: ${errText.slice(0, 500)}`)
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = body.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('Empty Perplexity response')
  }

  const items = parseItemsFromContent(content)
  return { items, model }
}
