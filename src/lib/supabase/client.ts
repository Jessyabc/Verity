import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isSupabaseConfigured } from '@/lib/supabase/config'

/**
 * Browser-only Supabase client for a Vite SPA.
 * Session refresh is handled by the client (`autoRefreshToken`); there is no Next.js middleware.
 */
let browserClient: SupabaseClient | null = null

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY in .env.local',
    )
  }

  if (!browserClient) {
    const url = import.meta.env.VITE_SUPABASE_URL!.trim()
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY!.trim()

    browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  }

  return browserClient
}
