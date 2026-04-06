/** Match web `shortDocumentTitle` for list rows. */
export function shortDocumentTitle(doc: {
  title: string | null
  canonical_url: string
}): string {
  if (doc.title?.trim()) return doc.title.trim()
  try {
    const u = new URL(doc.canonical_url)
    const path = u.pathname.length > 40 ? `${u.pathname.slice(0, 40)}…` : u.pathname
    return `${u.hostname}${path}`
  } catch {
    return 'Tracked document'
  }
}
