/** Narrow types for public.* monitoring tables (keep in sync with migrations). */

export type DbCompany = {
  id: string
  slug: string
  name: string
  ticker: string | null
  exchange: string | null
  tagline: string | null
  overview: string | null
  /** SEC CIK when imported from SEC ticker file */
  cik?: string | null
  /** manual | sec | pilot_import */
  universe_source?: string | null
  created_at: string
}

export type DbCompanySource = {
  id: string
  company_id: string
  source_key: string
  label: string
  base_url: string
  last_run_at: string | null
  last_status: string | null
  created_at: string
}

export type DbTrackedDocument = {
  id: string
  company_id: string
  company_source_id: string | null
  canonical_url: string
  content_hash: string | null
  title: string | null
  first_seen_at: string
  last_checked_at: string | null
  /** Phase 4 — OpenAI enrichment (scripts/enrich-documents-once.ts) */
  summary_text?: string | null
  lenses_json?: string[] | null
  enrichment_status?: string | null
  enrichment_detail?: string | null
  enrichment_model?: string | null
  enrichment_method?: string | null
  enriched_at?: string | null
  enrichment_input_hash?: string | null
}

export type DbFetchLog = {
  id: string
  company_source_id: string | null
  requested_url: string
  ran_at: string
  status: string
  http_status: number | null
  robots_allowed: boolean | null
  detail: string | null
  content_hash: string | null
}
