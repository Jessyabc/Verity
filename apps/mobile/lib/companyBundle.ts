import { fetchCompanyBySlug, type CompanyRow } from '@/lib/companyBySlug'
import { fetchTrackedDocumentsForCompany } from '@/lib/companyDocuments'
import type { DbTrackedDocument } from '@/lib/monitoringTypes'
import { supabase } from '@/lib/supabase'

export async function fetchCompanyBundleBySlug(slug: string): Promise<{
  company: CompanyRow | null
  documents: DbTrackedDocument[]
  /** First IR base_url for favicon fallback when logo_url is null */
  logoFallbackBaseUrl: string | null
}> {
  const company = await fetchCompanyBySlug(slug)
  if (!company) return { company: null, documents: [], logoFallbackBaseUrl: null }
  const [documents, sourceRes] = await Promise.all([
    fetchTrackedDocumentsForCompany(company.id, 25),
    supabase
      .from('company_sources')
      .select('base_url')
      .eq('company_id', company.id)
      .order('source_key')
      .limit(1)
      .maybeSingle(),
  ])
  const logoFallbackBaseUrl = sourceRes.error ? null : (sourceRes.data?.base_url ?? null)
  return { company, documents, logoFallbackBaseUrl }
}
