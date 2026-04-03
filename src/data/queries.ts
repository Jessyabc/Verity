import { PILOT_COMPANIES, getPilotCompanyBySlug } from '@/data/pilot-universe'
import type { DocumentUpdate, PilotCompany } from '@/data/types'

export function searchPilotCompanies(query: string): PilotCompany[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...PILOT_COMPANIES]

  return PILOT_COMPANIES.filter((c) => {
    const nameMatch = c.name.toLowerCase().includes(q)
    const tickerMatch = c.ticker?.toLowerCase().includes(q)
    const slugMatch = c.slug.replace(/-/g, ' ').includes(q)
    return nameMatch || Boolean(tickerMatch) || slugMatch
  })
}

export function getUpdateById(updateIdP: string | undefined): {
  company: PilotCompany
  update: DocumentUpdate
} | undefined {
  if (!updateIdP) return undefined
  for (const company of PILOT_COMPANIES) {
    const update = company.updates.find((u) => u.id === updateIdP)
    if (update) return { company, update }
  }
  return undefined
}

export function getRecentUpdatesForSlugs(
  slugs: string[],
  limit = 12,
): Array<{ company: PilotCompany; update: DocumentUpdate }> {
  const rows: Array<{ company: PilotCompany; update: DocumentUpdate }> = []
  for (const slug of slugs) {
    const company = getPilotCompanyBySlug(slug)
    if (!company) continue
    for (const update of company.updates) {
      rows.push({ company, update })
    }
  }
  return rows.slice(0, limit)
}

export { getPilotCompanyBySlug, PILOT_COMPANIES }
