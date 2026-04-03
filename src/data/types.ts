export type SourceStatus = 'active' | 'blocked' | 'error'

export type MonitoredSource = {
  id: string
  label: string
  status: SourceStatus
  /** Human-readable; later replaced by real timestamps */
  lastCheckedLabel: string
  /** Shown when blocked — builds trust */
  detail?: string
}

export type SourceLink = {
  label: string
  url: string
}

export type DocumentUpdate = {
  id: string
  title: string
  sourceCategoryLabel: string
  detectedLabel: string
  summary: string
  lenses: string[]
  sources: SourceLink[]
}

export type PilotCompany = {
  slug: string
  name: string
  ticker: string | null
  exchange: string | null
  /**
   * Optional logo URL (e.g. Clearbit `logo.clearbit.com/{domain}` or a file in `public/`).
   * If missing or load fails, UI shows initials from the ticker.
   */
  logoUrl?: string
  /** Single-line positioning for search */
  tagline: string
  overview: string
  companyLastCheckedLabel: string
  sources: MonitoredSource[]
  updates: DocumentUpdate[]
}
