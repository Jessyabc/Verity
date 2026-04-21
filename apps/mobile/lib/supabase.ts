import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

export function isSupabaseConfigured(): boolean {
  return hasSupabaseConfig
}

/** SSR / Node (Expo Router web static render): no `window`, no AsyncStorage session reads. */
const webSsrNoopStorage = {
  getItem: async (_key: string) => null as string | null,
  setItem: async (_key: string, _value: string) => {},
  removeItem: async (_key: string) => {},
}

const webLocalStorage = {
  getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
  setItem: (key: string, value: string) => {
    window.localStorage.setItem(key, value)
    return Promise.resolve()
  },
  removeItem: (key: string) => {
    window.localStorage.removeItem(key)
    return Promise.resolve()
  },
}

function getAuthStorage() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return webSsrNoopStorage
    return webLocalStorage
  }
  return AsyncStorage
}

const REFRESH_SKEW_MS = 120_000

/**
 * Only rewrite JWT for data plane — never `/auth/v1` (refresh/token calls use this fetch too).
 */
function isSupabaseDataPlaneUrl(requestUrl: string, projectUrl: string): boolean {
  const base = projectUrl.replace(/\/$/, '')
  if (!base || !requestUrl.startsWith(base)) return false
  let pathname: string
  try {
    pathname = new URL(requestUrl).pathname
  } catch {
    return false
  }
  return (
    pathname.startsWith('/rest/v1') ||
    pathname.startsWith('/functions/v1') ||
    pathname.startsWith('/storage/v1') ||
    pathname.startsWith('/graphql/v1')
  )
}

function requestUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return String(input)
}

/**
 * `fetchWithAuth` resolves the Bearer token *before* calling `global.fetch`. On React Native that
 * token is often already expired; the inner fetch cannot fix headers. We intercept data-plane
 * requests, refresh if needed, and replace `Authorization` with the latest access token (or anon key).
 */
function createNativeFetchWithFreshJwt(clientRef: { current: SupabaseClient | null }): typeof fetch {
  return async (input, init) => {
    const url = requestUrlString(input as RequestInfo | URL)
    if (
      !clientRef.current ||
      !supabaseUrl ||
      !isSupabaseDataPlaneUrl(url, supabaseUrl)
    ) {
      return globalThis.fetch(input as RequestInfo | URL, init as RequestInit)
    }

    const client = clientRef.current
    try {
      const {
        data: { session },
      } = await client.auth.getSession()

      let bearer = session?.access_token ?? supabaseAnonKey
      if (session?.expires_at) {
        const exp = session.expires_at * 1000
        if (exp < Date.now() + REFRESH_SKEW_MS) {
          await client.auth.refreshSession()
          const {
            data: { session: next },
          } = await client.auth.getSession()
          bearer = next?.access_token ?? supabaseAnonKey
        }
      }

      const headers = new Headers((init as RequestInit | undefined)?.headers)
      if (!headers.has('apikey')) headers.set('apikey', supabaseAnonKey)
      headers.set('Authorization', `Bearer ${bearer}`)

      return globalThis.fetch(input as RequestInfo | URL, { ...(init as RequestInit), headers })
    } catch {
      return globalThis.fetch(input as RequestInfo | URL, init as RequestInit)
    }
  }
}

function createMobileClient(): SupabaseClient {
  const clientRef: { current: SupabaseClient | null } = { current: null }
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: getAuthStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: createNativeFetchWithFreshJwt(clientRef),
    },
  })
  clientRef.current = client
  return client
}

function createWebClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: getAuthStorage(),
      autoRefreshToken: typeof window !== 'undefined',
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}

function createFallbackClient(): SupabaseClient {
  // Prevent launch-time crashes when EXPO_PUBLIC_SUPABASE_* is missing in release builds.
  return createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
    auth: {
      storage: getAuthStorage(),
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

export const supabase: SupabaseClient = hasSupabaseConfig
  ? Platform.OS === 'web'
    ? createWebClient()
    : createMobileClient()
  : createFallbackClient()
