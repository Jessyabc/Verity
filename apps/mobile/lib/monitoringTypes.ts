/** Narrow types for public monitoring tables (keep in sync with migrations). */

export type DbTrackedDocument = {
  id: string
  company_id: string
  company_source_id: string | null
  canonical_url: string
  content_hash: string | null
  title: string | null
  first_seen_at: string
  last_checked_at: string | null
  summary_text?: string | null
}
