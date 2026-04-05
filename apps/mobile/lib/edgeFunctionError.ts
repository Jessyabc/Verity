import { FunctionsHttpError } from '@supabase/supabase-js'

function withStatus(status: number, message: string): string {
  if (message.includes(`HTTP ${status}`)) return message
  return `HTTP ${status}: ${message}`
}

export async function messageFromFunctionsInvokeFailure(
  fnErr: unknown,
  response: Response | undefined,
): Promise<string> {
  const fallback = fnErr instanceof Error ? fnErr.message : String(fnErr)
  const res =
    response ??
    (fnErr instanceof FunctionsHttpError && fnErr.context instanceof Response
      ? fnErr.context
      : undefined)
  if (!res) return fallback

  const status = res.status

  try {
    const raw = await res.clone().text()
    const trimmed = raw.trim()
    const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    const looksJson = ct.includes('application/json') || trimmed.startsWith('{')

    if (looksJson && trimmed) {
      try {
        const j = JSON.parse(trimmed) as { error?: unknown }
        if (typeof j?.error === 'string' && j.error.trim()) {
          return withStatus(status, j.error.trim())
        }
      } catch {
        // fall through to plain text
      }
    }
    if (trimmed) {
      return withStatus(status, trimmed.length > 400 ? `${trimmed.slice(0, 400)}…` : trimmed)
    }
  } catch {
    // ignore
  }

  return withStatus(status, fallback)
}
