import type { PostgrestError } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

import { syncSessionForApi } from '@/lib/syncSessionForApi'

function isDuplicateWatchlistKey(err: PostgrestError): boolean {
  return err.code === '23505'
}

export async function fetchWatchlistSlugs(sb: SupabaseClient): Promise<string[]> {
  await syncSessionForApi()
  const { data, error } = await sb.from('user_watchlist').select('company_slug')
  if (error) throw error
  return (data ?? []).map((r) => r.company_slug as string)
}

export async function insertWatchlistSlug(
  sb: SupabaseClient,
  userId: string,
  slug: string,
): Promise<void> {
  await syncSessionForApi()
  const { error } = await sb.from('user_watchlist').insert({
    user_id: userId,
    company_slug: slug,
  })
  // Already on watchlist — treat as success (e.g. race or UI double-tap).
  if (error && !isDuplicateWatchlistKey(error)) throw error
}

export async function deleteWatchlistSlug(sb: SupabaseClient, slug: string): Promise<void> {
  await syncSessionForApi()
  const { error } = await sb.from('user_watchlist').delete().eq('company_slug', slug)
  if (error) throw error
}

export type WatchlistCompanyRow = {
  id: string
  slug: string
  name: string
  ticker: string | null
  exchange: string | null
  logo_url?: string | null
}

/** Resolve display rows for watchlist slugs (skips missing companies). */
export async function fetchCompaniesForSlugs(
  sb: SupabaseClient,
  slugs: string[],
): Promise<WatchlistCompanyRow[]> {
  if (slugs.length === 0) return []
  await syncSessionForApi()
  const { data, error } = await sb
    .from('companies')
    .select('id,slug,name,ticker,exchange,logo_url')
    .in('slug', slugs)
  if (error) throw error
  const rows = (data ?? []) as WatchlistCompanyRow[]
  const order = new Map(slugs.map((s, i) => [s, i]))
  return rows.sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0))
}

/** All `company_sources.base_url` per slug (ordered by `source_key`), for logo fallbacks. */
export async function fetchSourceBaseUrlsBySlugs(
  sb: SupabaseClient,
  slugs: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (slugs.length === 0) return map
  for (const s of slugs) map.set(s, [])
  await syncSessionForApi()
  const { data: companies, error: e1 } = await sb.from('companies').select('id,slug').in('slug', slugs)
  if (e1) throw e1
  const idToSlug = new Map<string, string>()
  for (const c of companies ?? []) {
    idToSlug.set((c as { id: string }).id, (c as { slug: string }).slug)
  }
  const ids = [...idToSlug.keys()]
  if (ids.length === 0) return map
  const { data: sources, error: e2 } = await sb
    .from('company_sources')
    .select('company_id, base_url, source_key')
    .in('company_id', ids)
  if (e2) throw e2
  const sorted = [...(sources ?? [])].sort((a, b) => {
    const ac = (a as { company_id: string }).company_id
    const bc = (b as { company_id: string }).company_id
    if (ac !== bc) return ac.localeCompare(bc)
    return String((a as { source_key: string }).source_key).localeCompare(
      String((b as { source_key: string }).source_key),
    )
  })
  for (const row of sorted) {
    const slug = idToSlug.get((row as { company_id: string }).company_id)
    if (!slug) continue
    const url = (row as { base_url: string }).base_url
    const arr = map.get(slug) ?? []
    arr.push(url)
    map.set(slug, arr)
  }
  return map
}
