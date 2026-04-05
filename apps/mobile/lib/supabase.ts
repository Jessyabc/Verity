import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getAuthStorage(),
    autoRefreshToken: Platform.OS === 'web' ? typeof window !== 'undefined' : true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
