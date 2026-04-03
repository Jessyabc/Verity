import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchWatchlistSlugs(
  sb: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await sb.from('user_watchlist').select('company_slug')
  if (error) throw error
  return (data ?? []).map((r) => r.company_slug as string)
}

export async function insertWatchlistSlug(
  sb: SupabaseClient,
  userId: string,
  slug: string,
): Promise<void> {
  const { error } = await sb.from('user_watchlist').insert({
    user_id: userId,
    company_slug: slug,
  })
  if (error) throw error
}

export async function deleteWatchlistSlug(
  sb: SupabaseClient,
  slug: string,
): Promise<void> {
  const { error } = await sb.from('user_watchlist').delete().eq('company_slug', slug)
  if (error) throw error
}
