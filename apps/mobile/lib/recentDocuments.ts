import type { DbTrackedDocument } from '@/lib/monitoringTypes'
import { supabase } from '@/lib/supabase'

export type RecentDbDoc = {
  document: DbTrackedDocument
  companySlug: string
  companyName: string
}

function docRecencyMs(d: DbTrackedDocument): number {
  const t = d.last_checked_at ?? d.first_seen_at
  const ms = Date.parse(t)
  return Number.isFinite(ms) ? ms : 0
}

/**
 * A single global `order(last_checked)` query often returns only the newest company’s rows, so other
 * watchlist names never appear. Cap per company then merge by recency.
 */
function diversifyRecentByCompany(rows: RecentDbDoc[], limit: number, companyCount: number): RecentDbDoc[] {
  if (rows.length === 0 || companyCount <= 0) return []
  const perCompany = Math.max(1, Math.ceil(limit / companyCount))
  const counts = new Map<string, number>()
  const sorted = [...rows].sort((a, b) => docRecencyMs(b.document) - docRecencyMs(a.document))
  const out: RecentDbDoc[] = []
  for (const row of sorted) {
    const id = row.document.company_id
    const n = counts.get(id) ?? 0
    if (n >= perCompany) continue
    counts.set(id, n + 1)
    out.push(row)
    if (out.length >= limit) break
  }
  return out
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

  const fetchCap = Math.min(150, Math.max(limit * 3, limit * slugs.length))

  const { data: docs, error: dErr } = await supabase
    .from('tracked_documents')
    .select(
      'id, company_id, company_source_id, canonical_url, content_hash, title, first_seen_at, last_checked_at, summary_text',
    )
    .in('company_id', companyIds)
    .order('last_checked_at', { ascending: false, nullsFirst: false })
    .order('first_seen_at', { ascending: false, nullsFirst: false })
    .limit(fetchCap)

  if (dErr) throw dErr

  const asRows: RecentDbDoc[] = []
  for (const d of (docs ?? []) as DbTrackedDocument[]) {
    const meta = metaByCompanyId.get(d.company_id)
    if (!meta) continue
    asRows.push({
      document: d,
      companySlug: meta.slug,
      companyName: meta.name,
    })
  }

  return diversifyRecentByCompany(asRows, limit, companies.length)
}
