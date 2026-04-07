/**
 * Resolve a logo URL for a company row: explicit DB URL first, then favicon from IR base URLs.
 * Mirrors src/lib/companyLogo.ts (Expo app does not import from the Vite tree).
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
  explicit?: string | null
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
