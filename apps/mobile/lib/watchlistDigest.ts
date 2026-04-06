import { supabase } from '@/lib/supabase'

export type DigestSource = {
  title: string
  url: string
  type: 'paper' | 'news' | 'filing' | 'report'
  relevance: string
}

export type WatchlistDigestRow = {
  user_id: string
  digest_text: string
  sources: DigestSource[]
  slugs_snapshot: string[]
  generated_at: string
  model: string | null
  is_generating: boolean
}

export async function fetchWatchlistDigest(userId: string): Promise<WatchlistDigestRow | null> {
  const { data, error } = await supabase
    .from('watchlist_digest')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? (data as WatchlistDigestRow) : null
}

/** Fire-and-forget: invoke the Edge Function to regenerate the digest. */
export async function triggerDigestRegeneration(slugs: string[]): Promise<void> {
  if (slugs.length === 0) return
  await supabase.functions.invoke('generate-watchlist-digest', {
    body: { slugs },
  })
}

/** Returns true if the digest should be regenerated. */
export function isDigestStale(
  row: WatchlistDigestRow | null,
  currentSlugs: string[],
  staleMs = 6 * 60 * 60 * 1000,
): boolean {
  if (!row || !row.digest_text) return true
  if (row.is_generating) return false // already in flight

  // Stale by time
  const age = Date.now() - new Date(row.generated_at).getTime()
  if (age > staleMs) return true

  // Watchlist changed since last generation
  const snap = new Set(row.slugs_snapshot)
  const curr = new Set(currentSlugs)
  if (snap.size !== curr.size) return true
  for (const s of curr) if (!snap.has(s)) return true

  return false
}
