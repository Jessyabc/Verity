/**
 * Resolve a logo URL for a company row: explicit DB/pilot URL first, then favicon from IR base URLs.
 * Uses Google's favicon endpoint (no API key) so subdomains like investor.apple.com resolve.
 */
export function faviconLogoUrlFromHttpUrl(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  try {
    const u = new URL(raw.trim())
    const host = u.hostname
    if (!host) return undefined
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
  } catch {
    return undefined
  }
}

export function resolveCompanyLogoUrl(opts: {
  /** Pilot logoUrl or companies.logo_url */
  explicit?: string | null
  /** company_sources.base_url values — first usable favicon wins */
  fallbackBaseUrls?: (string | null | undefined)[]
}): string | undefined {
  const e = opts.explicit?.trim()
  if (e) return e
  for (const raw of opts.fallbackBaseUrls ?? []) {
    const u = faviconLogoUrlFromHttpUrl(raw)
    if (u) return u
  }
  return undefined
}
