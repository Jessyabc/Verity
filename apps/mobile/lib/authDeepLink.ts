import * as Linking from 'expo-linking'

import { supabase } from '@/lib/supabase'

function parseTokensFromUrl(url: string): { access_token: string; refresh_token: string } | null {
  const hashPart = url.includes('#') ? url.split('#')[1] : ''
  const hashParams = new URLSearchParams(hashPart)
  let access_token = hashParams.get('access_token')
  let refresh_token = hashParams.get('refresh_token')

  if (!access_token || !refresh_token) {
    const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : ''
    const queryParams = new URLSearchParams(queryPart)
    access_token = access_token ?? queryParams.get('access_token')
    refresh_token = refresh_token ?? queryParams.get('refresh_token')
  }

  if (access_token && refresh_token) return { access_token, refresh_token }
  return null
}

/** Apply Supabase session from a magic-link / OAuth return URL (hash or query). */
export async function applySessionFromUrl(url: string): Promise<void> {
  if (!url) return
  const tokens = parseTokensFromUrl(url)
  if (!tokens) return
  const { error } = await supabase.auth.setSession(tokens)
  if (error) throw error
}

export function getEmailMagicLinkRedirect(): string {
  return Linking.createURL('auth-callback')
}
