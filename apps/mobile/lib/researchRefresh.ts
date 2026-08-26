import { messageFromFunctionsInvokeFailure } from '@/lib/edgeFunctionError'
import { supabase } from '@/lib/supabase'

const SECTION_LABELS: Record<string, string> = {
  financial_highlights: 'financial highlights',
  company_narrative: 'company narrative',
  media_narrative: 'media coverage',
}

export type ResearchRefreshResult = {
  /** Set when 1 or 2 of the 3 Perplexity calls didn't come back — the refresh still succeeded. */
  partialWarning: string | null
}

function invokeResearchCompanyOnce(
  slug: string,
  companyName: string,
  ticker: string | null,
) {
  // No manual Authorization — Supabase client's fetch injects a fresh Bearer from getSession().
  return supabase.functions.invoke<{
    ok?: boolean
    error?: string
    partial?: boolean
    failed_sections?: string[]
  }>('research-company', {
    body: { slug, companyName, ticker },
  })
}

export async function invokeResearchCompany(
  slug: string,
  companyName: string,
  ticker: string | null,
): Promise<ResearchRefreshResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new Error('Sign in again — your session is missing (research requires a signed-in user).')
  }

  let { data, error: fnErr, response } = await invokeResearchCompanyOnce(slug, companyName, ticker)

  if (fnErr && response?.status === 401) {
    await supabase.auth.refreshSession()
    ;({ data, error: fnErr, response } = await invokeResearchCompanyOnce(slug, companyName, ticker))
  }

  if (fnErr) {
    const msg = await messageFromFunctionsInvokeFailure(fnErr, response)
    throw new Error(msg)
  }
  if (data && typeof data === 'object' && data.error) {
    throw new Error(String(data.error))
  }

  if (data?.partial && data.failed_sections?.length) {
    const names = data.failed_sections.map((s) => SECTION_LABELS[s] ?? s).join(', ')
    return { partialWarning: `Refreshed, but couldn't update: ${names}. Try again in a moment.` }
  }
  return { partialWarning: null }
}
