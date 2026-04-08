import { fetchCompanyBySlug, type CompanyRow } from '@/lib/companyBySlug'
import { fetchTrackedDocumentsForCompany } from '@/lib/companyDocuments'
import type { DbTrackedDocument } from '@/lib/monitoringTypes'
import { supabase } from '@/lib/supabase'

export async function fetchCompanyBundleBySlug(slug: string): Promise<{
  company: CompanyRow | null
  documents: DbTrackedDocument[]
  /** IR / filing base URLs for logo fallbacks (Clearbit + favicons; skips SEC-first bias). */
  logoFallbackBaseUrls: string[]
}> {
  const company = await fetchCompanyBySlug(slug)
  if (!company) return { company: null, documents: [], logoFallbackBaseUrls: [] }
  const [documents, sourceRes] = await Promise.all([
    fetchTrackedDocumentsForCompany(company.id, 25),
    supabase
      .from('company_sources')
      .select('base_url')
      .eq('company_id', company.id)
      .order('source_key', { ascending: true }),
  ])
  const logoFallbackBaseUrls = sourceRes.error
    ? []
    : ((sourceRes.data ?? []) as { base_url: string }[]).map((r) => r.base_url)
  return { company, documents, logoFallbackBaseUrls }
}
