import type { DbTrackedDocument } from '@/lib/monitoringTypes'
import { supabase } from '@/lib/supabase'

export async function fetchTrackedDocumentsForCompany(
  companyId: string,
  limit = 25,
): Promise<DbTrackedDocument[]> {
  const { data, error } = await supabase
    .from('tracked_documents')
    .select(
      'id, company_id, company_source_id, canonical_url, content_hash, title, first_seen_at, last_checked_at, summary_text',
    )
    .eq('company_id', companyId)
    .order('last_checked_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as DbTrackedDocument[]
}
