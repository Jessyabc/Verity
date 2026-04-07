import type { ResearchNewsItem } from '@/lib/research/types'

/** Classify a research item as official (IR/SEC) or external — aligned with mobile. */
export function classifyItem(item: ResearchNewsItem): 'official' | 'external' {
  const url = item.url.toLowerCase()
  const src = (item.source ?? '').toLowerCase()
  if (
    url.includes('sec.gov') ||
    url.includes('edgar') ||
    url.includes('/ir/') ||
    url.includes('investor-relations') ||
    url.includes('investors.') ||
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
