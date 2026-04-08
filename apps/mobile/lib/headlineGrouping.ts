import type { ResearchNewsItem } from '@/lib/researchCache'

export type HeadlineCluster = {
  primary: ResearchNewsItem
  extras: ResearchNewsItem[]
  sourceCount: number
}

/** Tokenise a title into a set of meaningful words (length > 3). */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 3),
  )
}

/** Jaccard similarity between two token sets. */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersect = 0
  for (const t of a) if (b.has(t)) intersect++
  return intersect / (a.size + b.size - intersect)
}

/**
 * Groups headlines that are likely the same story (Jaccard ≥ threshold).
 * Preserves the item with the longest snippet as the primary headline.
 * Default threshold 0.35 — same story if 35 %+ of title tokens overlap.
 */
export function groupHeadlines(
  items: ResearchNewsItem[],
  threshold = 0.35,
): HeadlineCluster[] {
  const clusters: HeadlineCluster[] = []
  const assigned = new Set<number>()
  const tokenSets = items.map((item) => tokenize(item.title))

  for (let i = 0; i < items.length; i++) {
    if (assigned.has(i)) continue
    assigned.add(i)
    const group: ResearchNewsItem[] = [items[i]]

    for (let j = i + 1; j < items.length; j++) {
      if (assigned.has(j)) continue
      if (jaccard(tokenSets[i], tokenSets[j]) >= threshold) {
        group.push(items[j])
        assigned.add(j)
      }
    }

    // Pick item with longest snippet as primary for best preview
    group.sort(
      (a, b) => (b.snippet?.length ?? 0) - (a.snippet?.length ?? 0),
    )

    clusters.push({
      primary: group[0],
      extras: group.slice(1),
      sourceCount: group.length,
    })
  }

  return clusters
}

/** Classify a research item as official (IR/SEC) or external. */
export function classifyItem(item: ResearchNewsItem): 'official' | 'external' {
  const src = (item.source ?? '').toLowerCase()
  const rawUrl = item.url
  let host = ''
  let path = ''
  try {
    const u = new URL(rawUrl)
    host = u.hostname.toLowerCase()
    path = u.pathname.toLowerCase()
  } catch {
    const lower = rawUrl.toLowerCase()
    host = lower
    path = lower
  }

  // Treat syndicated PR wires as company messaging (not independent media).
  if (
    host.includes('prnewswire.com') ||
    host.includes('globenewswire.com') ||
    host.includes('businesswire.com') ||
    host.includes('newsfilecorp.com') ||
    host.includes('newsfile.com')
  ) {
    return 'official'
  }

  if (
    host.includes('sec.gov') ||
    path.includes('edgar') ||
    host.startsWith('ir.') ||
    host.includes('investors.') ||
    path.includes('/ir/') ||
    path.includes('investor-relations') ||
    path.includes('/investor') ||
    src.includes('sec') ||
    src.includes('form 4') ||
    src.includes('10-k') ||
    src.includes('10-q') ||
    src.includes('8-k') ||
    src.includes('press release') ||
    src.includes('earnings release')
  ) {
    return 'official'
  }
  return 'external'
}

/** Strict source separation: prefer `narrative_scope` from Edge cache; else heuristics. */
export function itemIsCompanySource(item: ResearchNewsItem): boolean {
  if (item.narrative_scope === 'company') return true
  if (item.narrative_scope === 'media') return false
  return classifyItem(item) === 'official'
}

export function itemIsMediaSource(item: ResearchNewsItem): boolean {
  if (item.narrative_scope === 'media') return true
  if (item.narrative_scope === 'company') return false
  return classifyItem(item) === 'external'
}
