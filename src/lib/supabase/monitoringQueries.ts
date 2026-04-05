import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import type {
  DbCompany,
  DbCompanySource,
  DbFetchLog,
  DbTrackedDocument,
} from '@/lib/supabase/monitoringTypes'

export function isUuidParam(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/** Relative-ish label for ISO timestamps (no new deps). */
export function shortDocumentTitle(doc: Pick<DbTrackedDocument, 'title' | 'canonical_url'>): string {
  if (doc.title?.trim()) return doc.title.trim()
  try {
    const u = new URL(doc.canonical_url)
    const path = u.pathname.length > 40 ? `${u.pathname.slice(0, 40)}…` : u.pathname
    return `${u.hostname}${path}`
  } catch {
    return 'Tracked document'
  }
}

export function formatAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

export function mapDbStatusToUi(
  lastStatus: string | null | undefined,
): 'active' | 'blocked' | 'error' {
  if (!lastStatus) return 'active'
  if (lastStatus === 'blocked_robots') return 'blocked'
  if (lastStatus === 'ok' || lastStatus === 'running') return 'active'
  return 'error'
}

export async function fetchCompanyRowBySlug(
  slug: string,
): Promise<DbCompany | null> {
  if (!isSupabaseConfigured()) return null

  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('companies')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data ? (data as DbCompany) : null
}

/**
 * Server-side search via `search_companies` RPC (scales to large SEC universes).
 * Empty query returns the newest rows (browse).
 */
export async function fetchCompaniesForSearch(query: string): Promise<DbCompany[]> {
  if (!isSupabaseConfigured()) return []

  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb.rpc('search_companies', {
    p_query: query.trim(),
    p_limit: 60,
  })

  if (error) throw error
  return (data ?? []) as DbCompany[]
}

export async function fetchCompanyBundleBySlug(
  slug: string,
): Promise<{
  company: DbCompany | null
  sources: DbCompanySource[]
  documents: DbTrackedDocument[]
  fetchLogs: DbFetchLog[]
} | null> {
  if (!isSupabaseConfigured()) return null

  const sb = getSupabaseBrowserClient()

  const { data: company, error: cErr } = await sb
    .from('companies')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (cErr) throw cErr
  if (!company) return { company: null, sources: [], documents: [], fetchLogs: [] }

  const co = company as DbCompany

  const { data: sources, error: sErr } = await sb
    .from('company_sources')
    .select('*')
    .eq('company_id', co.id)
    .order('source_key')

  if (sErr) throw sErr

  const { data: documents, error: dErr } = await sb
    .from('tracked_documents')
    .select('*')
    .eq('company_id', co.id)
    .order('last_checked_at', { ascending: false, nullsFirst: false })
    .order('first_seen_at', { ascending: false, nullsFirst: false })
    .limit(25)

  if (dErr) throw dErr

  const sourceIds = (sources as DbCompanySource[]).map((s) => s.id)
  let fetchLogs: DbFetchLog[] = []
  if (sourceIds.length > 0) {
    const { data: logs, error: lErr } = await sb
      .from('fetch_logs')
      .select('*')
      .in('company_source_id', sourceIds)
      .order('ran_at', { ascending: false })
      .limit(30)

    if (lErr) throw lErr
    fetchLogs = (logs ?? []) as DbFetchLog[]
  }

  return {
    company: co,
    sources: (sources ?? []) as DbCompanySource[],
    documents: (documents ?? []) as DbTrackedDocument[],
    fetchLogs,
  }
}

export async function fetchTrackedDocumentWithCompany(docId: string): Promise<{
  document: DbTrackedDocument
  company: DbCompany
} | null> {
  if (!isSupabaseConfigured()) return null

  const sb = getSupabaseBrowserClient()

  const { data: document, error: dErr } = await sb
    .from('tracked_documents')
    .select('*')
    .eq('id', docId)
    .maybeSingle()

  if (dErr) throw dErr
  if (!document) return null

  const { data: company, error: cErr } = await sb
    .from('companies')
    .select('*')
    .eq('id', (document as DbTrackedDocument).company_id)
    .maybeSingle()

  if (cErr) throw cErr
  if (!company) return null

  return {
    document: document as DbTrackedDocument,
    company: company as DbCompany,
  }
}

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

export async function fetchRecentDocumentsForSlugs(
  slugs: string[],
  limit = 12,
): Promise<RecentDbDoc[]> {
  if (!isSupabaseConfigured() || slugs.length === 0) return []

  const sb = getSupabaseBrowserClient()

  const { data: companies, error: cErr } = await sb
    .from('companies')
    .select('id, slug, name')
    .in('slug', slugs)

  if (cErr) throw cErr
  if (!companies?.length) return []

  const companyIds = companies.map((c) => c.id as string)
  const fetchCap = Math.min(150, Math.max(limit * 3, limit * slugs.length))

  const { data: docs, error: dErr } = await sb
    .from('tracked_documents')
    .select('*')
    .in('company_id', companyIds)
    .order('last_checked_at', { ascending: false, nullsFirst: false })
    .order('first_seen_at', { ascending: false, nullsFirst: false })
    .limit(fetchCap)

  if (dErr) throw dErr

  const metaByCompanyId = new Map(
    companies.map((c) => [
      c.id as string,
      { slug: c.slug as string, name: c.name as string },
    ]),
  )
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
