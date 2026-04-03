/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Supabase publishable (anon) key — safe to expose in the browser bundle */
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
