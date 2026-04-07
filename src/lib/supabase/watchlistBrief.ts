import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { messageFromFunctionsInvokeFailure } from '@/lib/supabase/edgeFunctionError'

export type WatchlistBriefResult = {
  brief: string
  model: string | null
  generated_at: string
}

export async function invokeWatchlistBrief(): Promise<WatchlistBriefResult> {
  if (!isSupabaseConfigured()) throw new Error('Supabase not configured')

  const sb = getSupabaseBrowserClient()
  const { data, error, response } = await sb.functions.invoke<
    WatchlistBriefResult & { error?: string }
  >('watchlist-brief', { body: {} })

  if (error) {
    throw new Error(await messageFromFunctionsInvokeFailure(error, response))
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error))
  }
  if (!data || typeof (data as WatchlistBriefResult).brief !== 'string') {
    throw new Error('Invalid response from watchlist-brief')
  }

  const d = data as WatchlistBriefResult
  return {
    brief: d.brief,
    model: d.model ?? null,
    generated_at: d.generated_at ?? new Date().toISOString(),
  }
}
