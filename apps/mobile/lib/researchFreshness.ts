/**
 * Research cache freshness / confidence helpers for mobile UI.
 * Thresholds must stay aligned with `supabase/functions/afaqi-chat` (48h fresh, 7d very stale).
 */

export const RESEARCH_FRESH_MS = 48 * 60 * 60 * 1000
export const RESEARCH_VERY_STALE_MS = 7 * 24 * 60 * 60 * 1000

export type ResearchFreshnessLevel = 'missing' | 'fresh' | 'stale' | 'very_stale'

export type ResearchConfidence = 'high' | 'medium' | 'low'

export type ResearchFreshness = {
  level: ResearchFreshnessLevel
  ageMs: number | null
  /** Short pill label, e.g. "Fresh · 3h ago" */
  pillLabel: string
  /** One-line user guidance when refresh is useful */
  refreshHint: string | null
  needsRefresh: boolean
}

function ageLabel(ageMs: number): string {
  const m = Math.floor(ageMs / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}d ago`
}

export function getResearchFreshness(
  fetchedAt: string | null | undefined,
  opts?: { freshMs?: number; veryStaleMs?: number },
): ResearchFreshness {
  const freshMs = opts?.freshMs ?? RESEARCH_FRESH_MS
  const veryStaleMs = opts?.veryStaleMs ?? RESEARCH_VERY_STALE_MS

  if (!fetchedAt) {
    return {
      level: 'missing',
      ageMs: null,
      pillLabel: 'No research yet',
      refreshHint: 'Run Refresh on the company profile before chatting.',
      needsRefresh: true,
    }
  }

  const t = new Date(fetchedAt).getTime()
  if (Number.isNaN(t)) {
    return {
      level: 'missing',
      ageMs: null,
      pillLabel: 'No research yet',
      refreshHint: 'Run Refresh on the company profile before chatting.',
      needsRefresh: true,
    }
  }

  const ageMs = Math.max(0, Date.now() - t)
  const ago = ageLabel(ageMs)

  if (ageMs < freshMs) {
    return {
      level: 'fresh',
      ageMs,
      pillLabel: `Fresh · ${ago}`,
      refreshHint: null,
      needsRefresh: false,
    }
  }

  if (ageMs < veryStaleMs) {
    return {
      level: 'stale',
      ageMs,
      pillLabel: `Stale · ${ago}`,
      refreshHint: 'Research may be outdated — Refresh on the company profile for a current card.',
      needsRefresh: true,
    }
  }

  return {
    level: 'very_stale',
    ageMs,
    pillLabel: `Very stale · ${ago}`,
    refreshHint: 'Research is over a week old — Refresh recommended before relying on this card.',
    needsRefresh: true,
  }
}

/** Evidence confidence from freshness + whether structured card fields exist. */
export function getResearchConfidence(opts: {
  fetchedAt: string | null | undefined
  hasNarratives: boolean
  hasFinancials: boolean
  hasGaps: boolean
}): ResearchConfidence {
  const freshness = getResearchFreshness(opts.fetchedAt)
  if (freshness.level === 'missing') return 'low'
  if (freshness.level === 'very_stale') return 'low'

  const depth =
    (opts.hasNarratives ? 1 : 0) + (opts.hasFinancials ? 1 : 0) + (opts.hasGaps ? 1 : 0)

  if (freshness.level === 'fresh' && depth >= 2) return 'high'
  if (freshness.level === 'fresh') return 'medium'
  // stale
  return depth >= 2 ? 'medium' : 'low'
}

/** 0–1 fill for the confidence meter UI. */
export function confidenceMeterValue(c: ResearchConfidence): number {
  if (c === 'high') return 0.92
  if (c === 'medium') return 0.55
  return 0.22
}

/** Fill color for the meter (low → amber, high → teal). */
export function confidenceMeterColor(c: ResearchConfidence): string {
  if (c === 'high') return '#2FB4B0'
  if (c === 'medium') return '#D97706'
  return '#B45309'
}

/** Accessibility / tooltip wording only — prefer the meter in UI. */
export function confidenceLabel(c: ResearchConfidence): string {
  if (c === 'high') return 'High confidence'
  if (c === 'medium') return 'Medium confidence'
  return 'Low confidence'
}
