import { messageFromFunctionsInvokeFailure } from '@/lib/edgeFunctionError'
import { supabase } from '@/lib/supabase'

function invokeResearchCompanyOnce(
  slug: string,
  companyName: string,
  ticker: string | null,
) {
  // No manual Authorization — Supabase client's fetch injects a fresh Bearer from getSession().
  return supabase.functions.invoke<{ ok?: boolean; error?: string }>('research-company', {
    body: { slug, companyName, ticker },
  })
}

export async function invokeResearchCompany(
  slug: string,
  companyName: string,
  ticker: string | null,
): Promise<void> {
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
}
