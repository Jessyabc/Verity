import { messageFromFunctionsInvokeFailure } from '@/lib/edgeFunctionError'
import { supabase } from '@/lib/supabase'

export type WatchlistBriefResult = {
  brief: string
  model: string | null
  generated_at: string
}

export async function invokeWatchlistBrief(): Promise<WatchlistBriefResult> {
  const { data, error, response } = await supabase.functions.invoke<
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
