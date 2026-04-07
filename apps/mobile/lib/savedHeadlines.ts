import { supabase } from '@/lib/supabase'
import type { ResearchNewsItem } from '@/lib/researchCache'

export type SavedHeadlineRow = {
  id: string
  user_id: string
  company_slug: string
  title: string
  url: string
  source: string | null
  snippet: string | null
  published_at: string | null
  saved_at: string
}

/** Fetch every headline saved by the current user, newest first. */
export async function fetchAllSavedHeadlines(): Promise<SavedHeadlineRow[]> {
  const { data, error } = await supabase
    .from('saved_headlines')
    .select('*')
    .order('saved_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SavedHeadlineRow[]
}

export async function fetchSavedHeadlines(companySlug: string): Promise<SavedHeadlineRow[]> {
  const { data, error } = await supabase
    .from('saved_headlines')
    .select('*')
    .eq('company_slug', companySlug)
    .order('saved_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as SavedHeadlineRow[]
}

export async function saveHeadline(
  userId: string,
  companySlug: string,
  item: ResearchNewsItem,
): Promise<void> {
  const { error } = await supabase.from('saved_headlines').upsert(
    {
      user_id: userId,
      company_slug: companySlug,
      title: item.title,
      url: item.url,
      source: item.source ?? null,
      snippet: item.snippet ?? null,
      published_at: item.published_at ?? null,
    },
    { onConflict: 'user_id,company_slug,url' },
  )
  if (error) throw error
}

export async function unsaveHeadline(id: string): Promise<void> {
  const { error } = await supabase.from('saved_headlines').delete().eq('id', id)
  if (error) throw error
}

/** Returns a Set of saved URLs for quick lookup. */
export function savedUrlSet(rows: SavedHeadlineRow[]): Set<string> {
  return new Set(rows.map((r) => r.url))
}
