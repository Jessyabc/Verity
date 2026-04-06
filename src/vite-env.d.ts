/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Supabase publishable (anon) key — safe to expose in the browser bundle */
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string
  /** Admin UI gate — must match Edge Function secret ADMIN_EMAIL */
  readonly VITE_ADMIN_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
