/** Normalize for stable identity (V1: URL string, not semantic HTML). */
export function normalizeDocumentUrl(raw: string): string {
  try {
    const u = new URL(raw.trim())
    u.hash = ''
    // Drop default ports
    if (
      (u.protocol === 'https:' && u.port === '443') ||
      (u.protocol === 'http:' && u.port === '80')
    ) {
      u.port = ''
    }
    return u.href
  } catch {
    return raw.trim()
  }
}
