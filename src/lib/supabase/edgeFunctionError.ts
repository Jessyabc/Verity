import { FunctionsHttpError } from '@supabase/supabase-js'

/**
 * `functions.invoke` sets error.message to a generic "non-2xx" string; the function often returns
 * `{ error: "..." }` in the body — parse it for actionable UI.
 */
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

  try {
    const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (ct === 'application/json') {
      const j = (await res.clone().json()) as { error?: unknown }
      if (typeof j?.error === 'string' && j.error.trim()) return j.error.trim()
    } else {
      const t = (await res.clone().text()).trim()
      if (t) return t.length > 400 ? `${t.slice(0, 400)}…` : t
    }
  } catch {
    // ignore parse errors
  }

  return fallback
}
