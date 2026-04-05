import { fetchCompanyBySlug, type CompanyRow } from '@/lib/companyBySlug'
import { fetchTrackedDocumentsForCompany } from '@/lib/companyDocuments'
import type { DbTrackedDocument } from '@/lib/monitoringTypes'

export async function fetchCompanyBundleBySlug(slug: string): Promise<{
  company: CompanyRow | null
  documents: DbTrackedDocument[]
}> {
  const company = await fetchCompanyBySlug(slug)
  if (!company) return { company: null, documents: [] }
  const documents = await fetchTrackedDocumentsForCompany(company.id, 25)
  return { company, documents }
}
