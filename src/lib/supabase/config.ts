/** True when Vite env has URL + publishable key (browser-safe). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL?.trim() &&
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim(),
  )
}
