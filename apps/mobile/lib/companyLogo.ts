/**
 * Logo resolution: DB URL first when trustworthy, then Clearbit by corporate domain,
 * then Google favicons from non-government source hosts. Avoids SEC/edgar favicons
 * that often appear when `logo_url` or the first `company_sources` row is SEC.
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

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '')
}

/** Hosts that usually yield a regulator / generic seal, not the company mark. */
export function isGovernmentOrRegulatorHost(host: string): boolean {
  const h = normalizeHost(host)
  if (!h) return true
  if (h === 'sec.gov' || h.endsWith('.sec.gov')) return true
  if (h.includes('federalregister')) return true
  if (h === 'treasury.gov' || h.endsWith('.treasury.gov')) return true
  if (h === 'irs.gov' || h.endsWith('.irs.gov')) return true
  if (h === 'justice.gov' || h.endsWith('.justice.gov')) return true
  if (h.includes('edgar')) return true
  return false
}

export function hostnameFromHttpUrl(raw: string | null | undefined): string | undefined {
  if (!raw?.trim()) return undefined
  try {
    return normalizeHost(new URL(raw.trim()).hostname)
  } catch {
    return undefined
  }
}

/** True if the resolved image is probably not the company’s brand logo. */
export function isLikelyNonBrandLogoUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (lower.includes('sec.gov')) return true
  if (lower.includes('federalregister')) return true
  try {
    if (lower.includes('google.com/s2/favicons')) {
      const m = url.match(/[?&]domain=([^&]+)/)
      if (m) {
        const d = decodeURIComponent(m[1])
        if (isGovernmentOrRegulatorHost(d)) return true
      }
    }
  } catch {
    /* ignore */
  }
  return false
}

/**
 * Ordered URLs to try in `CompanyLogo` (first good load wins).
 * Clearbit serves many public-company marks from the corporate domain (fair-use style use;
 * replace with a licensed provider if you need guaranteed entitlements).
 */
export function buildCompanyLogoCandidates(opts: {
  explicit?: string | null
  sourceBaseUrls?: (string | null | undefined)[]
}): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const add = (u?: string | null) => {
    const t = u?.trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }

  const explicit = opts.explicit?.trim()
  if (explicit && !isLikelyNonBrandLogoUrl(explicit)) {
    add(explicit)
  }

  const hosts = (opts.sourceBaseUrls ?? [])
    .map((raw) => hostnameFromHttpUrl(raw))
    .filter((h): h is string => Boolean(h))

  const brandHost = hosts.find((h) => !isGovernmentOrRegulatorHost(h))
  if (brandHost) {
    add(`https://logo.clearbit.com/${brandHost}`)
  }

  for (const h of hosts) {
    if (!isGovernmentOrRegulatorHost(h)) {
      const fav = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128`
      if (!isLikelyNonBrandLogoUrl(fav)) add(fav)
    }
  }

  return out
}

/** @deprecated Prefer buildCompanyLogoCandidates + CompanyLogo logoCandidates */
export function resolveCompanyLogoUrl(opts: {
  explicit?: string | null
  fallbackBaseUrls?: (string | null | undefined)[]
}): string | undefined {
  const c = buildCompanyLogoCandidates({
    explicit: opts.explicit,
    sourceBaseUrls: opts.fallbackBaseUrls,
  })
  return c[0]
}
