import type { SupabaseClient } from '@supabase/supabase-js'

export async function fetchWatchlistSlugs(sb: SupabaseClient): Promise<string[]> {
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

export async function deleteWatchlistSlug(sb: SupabaseClient, slug: string): Promise<void> {
  const { error } = await sb.from('user_watchlist').delete().eq('company_slug', slug)
  if (error) throw error
}

export type WatchlistCompanyRow = {
  slug: string
  name: string
  ticker: string | null
}

/** Resolve display rows for watchlist slugs (skips missing companies). */
export async function fetchCompaniesForSlugs(
  sb: SupabaseClient,
  slugs: string[],
): Promise<WatchlistCompanyRow[]> {
  if (slugs.length === 0) return []
  const { data, error } = await sb
    .from('companies')
    .select('slug,name,ticker')
    .in('slug', slugs)
  if (error) throw error
  const rows = (data ?? []) as WatchlistCompanyRow[]
  const order = new Map(slugs.map((s, i) => [s, i]))
  return rows.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0))
}
