import type { PilotCompany } from '@/data/types'
import type { DbCompany } from '@/lib/supabase/monitoringTypes'

/** Normalized header + narrative fields for company profile (pilot bundle or DB-only). */
export type ProfileCompanyView = {
  slug: string
  name: string
  ticker: string | null
  exchange: string | null
  tagline: string
  overview: string
  logoUrl?: string
  pilotSources: PilotCompany['sources']
  pilotUpdates: PilotCompany['updates']
  companyLastCheckedLabel: string
  /** True when there is no bundled pilot row — profile is driven by Supabase `companies`. */
  isDbOnly: boolean
}

export function resolveProfileCompany(
  pilot: PilotCompany | undefined,
  db: DbCompany | null | undefined,
): ProfileCompanyView | null {
  if (pilot) {
    return {
      slug: pilot.slug,
      name: pilot.name,
      ticker: pilot.ticker,
      exchange: pilot.exchange,
      tagline: pilot.tagline,
      overview: pilot.overview,
      logoUrl: pilot.logoUrl,
      pilotSources: pilot.sources,
      pilotUpdates: pilot.updates,
      companyLastCheckedLabel: pilot.companyLastCheckedLabel,
      isDbOnly: false,
    }
  }
  if (db) {
    return {
      slug: db.slug,
      name: db.name,
      ticker: db.ticker,
      exchange: db.exchange,
      tagline: db.tagline ?? '',
      overview: db.overview ?? '',
      pilotSources: [],
      pilotUpdates: [],
      companyLastCheckedLabel: '—',
      isDbOnly: true,
    }
  }
  return null
}
