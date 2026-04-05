import type { DbTrackedDocument } from '@/lib/monitoringTypes'
import { supabase } from '@/lib/supabase'

export type RecentDbDoc = {
  document: DbTrackedDocument
  companySlug: string
  companyName: string
}

/** Same logic as web `fetchRecentDocumentsForSlugs` — dashboard-style feed from watchlist. */
export async function fetchRecentDocumentsForSlugs(
  slugs: string[],
  limit = 12,
): Promise<RecentDbDoc[]> {
  if (slugs.length === 0) return []

  const { data: companies, error: cErr } = await supabase
    .from('companies')
    .select('id, slug, name')
    .in('slug', slugs)

  if (cErr) throw cErr
  if (!companies?.length) return []

  const metaByCompanyId = new Map(
    companies.map((c) => [
      c.id as string,
      { slug: c.slug as string, name: c.name as string },
    ]),
  )
  const companyIds = [...metaByCompanyId.keys()]

  const { data: docs, error: dErr } = await supabase
    .from('tracked_documents')
    .select(
      'id, company_id, company_source_id, canonical_url, content_hash, title, first_seen_at, last_checked_at, summary_text',
    )
    .in('company_id', companyIds)
    .order('last_checked_at', { ascending: false })
    .limit(limit * 2)

  if (dErr) throw dErr

  const out: RecentDbDoc[] = []
  for (const d of (docs ?? []) as DbTrackedDocument[]) {
    const meta = metaByCompanyId.get(d.company_id)
    if (!meta) continue
    out.push({
      document: d,
      companySlug: meta.slug,
      companyName: meta.name,
    })
    if (out.length >= limit) break
  }
  return out
}
