/**
 * Returns a time-of-day greeting, optionally personalised with the user's first name
 * derived from their email address (e.g. "alex@..." → "Good morning, Alex").
 * Falls back to a plain greeting if the local-part looks like a UUID or random string.
 */
export function getGreeting(email: string | null | undefined): string {
  const hour = new Date().getHours()
  const timeGreeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (!email) return timeGreeting

  const local = email.split('@')[0] ?? ''
  // Skip derivation for UUIDs, numeric strings, or suspiciously long identifiers
  if (local.length > 20 || !/^[a-zA-Z]/.test(local)) return timeGreeting

  // Take segment before the first separator (.  _  -)
  const first = local.split(/[._-]/)[0] ?? local
  const name = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
  return `${timeGreeting}, ${name}`
}

/**
 * Supabase `PostgrestError` and some API errors are plain objects, not `Error` instances.
 * Using `String(e)` shows "[object Object]" in UI — use this for user-visible messages.
 */
export function formatUnknownError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    if (typeof o.message === 'string') {
      const parts: string[] = [o.message]
      if (typeof o.code === 'string' && o.code) parts.push(`[${o.code}]`)
      if (typeof o.details === 'string' && o.details) parts.push(o.details)
      if (typeof o.hint === 'string' && o.hint) parts.push(`Hint: ${o.hint}`)
      return parts.join(' ')
    }
  }
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

/** Relative label for ISO timestamps (matches web `formatAgo`). */
export function formatAgo(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

/** Company profile research strip — “Updated just now” when fresh. */
export function formatResearchUpdated(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return 'Not yet updated'
  const diff = Date.now() - d.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Updated just now'
  return `Updated ${formatAgo(iso)}`
}
