/**
 * Afaqi TTS — OpenAI Speech API (Cedar voice on gpt-4o-mini-tts).
 *
 * Invoke: supabase.functions.invoke('afaqi-tts', { body: { text: string } })
 * Returns: { audioBase64: string, mimeType: 'audio/mpeg' }
 */

import { corsHeaders } from '../_shared/cors.ts'
import { requireSession } from '../_shared/requireSession.ts'

const MAX_INPUT_CHARS = 3800

function stripSourcesJsonBlock(text: string): string {
  return text.replace(/SOURCES_JSON:\s*\[.*\]\s*$/s, '').trim()
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
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
      JSON.stringify({ error: 'OPENAI_API_KEY not configured', code: 'config' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  let text = ''
  try {
    const body = await req.json()
    const raw = typeof body.text === 'string' ? body.text : ''
    text = stripSourcesJsonBlock(raw).trim()
    if (!text) throw new Error('text required')
    if (text.length > MAX_INPUT_CHARS) text = text.slice(0, MAX_INPUT_CHARS)
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : 'Bad request',
        code: 'validation',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const openaiRes = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'cedar',
      input: text,
      response_format: 'mp3',
    }),
  })

  if (!openaiRes.ok) {
    const errText = await openaiRes.text()
    let msg = errText
    try {
      const parsed = JSON.parse(errText) as { error?: { message?: string } }
      if (typeof parsed?.error?.message === 'string') msg = parsed.error.message
    } catch {
      /* keep raw */
    }
    return new Response(
      JSON.stringify({
        error: msg,
        code: 'openai_upstream',
        details: errText.length > 600 ? `${errText.slice(0, 600)}…` : errText,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const buf = new Uint8Array(await openaiRes.arrayBuffer())
  const audioBase64 = bytesToBase64(buf)

  return new Response(
    JSON.stringify({
      audioBase64,
      mimeType: 'audio/mpeg' as const,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
