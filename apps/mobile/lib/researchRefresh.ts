import { messageFromFunctionsInvokeFailure } from '@/lib/edgeFunctionError'
import { supabase } from '@/lib/supabase'

export async function invokeResearchCompany(
  slug: string,
  companyName: string,
  ticker: string | null,
): Promise<void> {
  const { data, error: fnErr, response } = await supabase.functions.invoke<{
    ok?: boolean
    error?: string
  }>('research-company', {
    body: { slug, companyName, ticker },
  })
  if (fnErr) {
    const msg = await messageFromFunctionsInvokeFailure(fnErr, response)
    throw new Error(msg)
  }
  if (data && typeof data === 'object' && data.error) {
    throw new Error(String(data.error))
  }
}
