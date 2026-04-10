import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useCompanyResearch } from '@/hooks/useCompanyResearch'
import { classifyItem } from '@/lib/headlineGrouping'
import type { ResearchNewsItem } from '@/lib/research/types'
import type { FinancialHighlights } from '@/lib/supabase/researchQueries'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatAgo } from '@/lib/supabase/monitoringQueries'
import { cn } from '@/lib/cn'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gapText(g: unknown): string {
  if (typeof g === 'string') return g
  if (g && typeof g === 'object' && 'text' in g && typeof (g as { text: string }).text === 'string') {
    return (g as { text: string }).text
  }
  return ''
}

function gapCategory(g: unknown): string | null {
  if (g && typeof g === 'object' && 'category' in g) {
    const cat = (g as { category?: string }).category
    return typeof cat === 'string' ? cat : null
  }
  return null
}

const GAP_CATEGORY_LABELS: Record<string, string> = {
  numeric: 'Numeric',
  disclosure: 'Disclosure',
  timing: 'Timing',
  definition: 'Definition',
  coverage: 'Coverage',
}

function parseFinancialHighlights(raw: unknown): FinancialHighlights | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  const period = typeof obj.period === 'string' ? obj.period.trim() : ''
  if (!period) return null
  const period_end = typeof obj.period_end === 'string' ? obj.period_end.trim() || null : null
  const metrics: FinancialHighlights['metrics'] = []
  if (Array.isArray(obj.metrics)) {
    for (const m of obj.metrics) {
      if (!m || typeof m !== 'object') continue
      const mo = m as Record<string, unknown>
      const label = typeof mo.label === 'string' ? mo.label.trim() : ''
      const value = typeof mo.value === 'string' ? mo.value.trim() : ''
      if (!label || !value) continue
      const yoy = typeof mo.yoy === 'string' ? mo.yoy.trim() || null : null
      metrics.push({ label, value, yoy })
    }
  }
  return { period, period_end, metrics }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompanyResearchSection({
  slug,
  companyName,
  ticker,
}: {
  slug: string
  companyName: string
  ticker: string | null
}) {
  const { row, loading, refreshing, error, refresh } = useCompanyResearch(
    slug,
    companyName,
    ticker,
  )

  const [headlinesOpen, setHeadlinesOpen] = useState(false)

  const companyItems = useMemo(
    () => (row?.items ?? []).filter((i) => classifyItem(i) === 'official'),
    [row?.items],
  )
  const mediaItems = useMemo(
    () => (row?.items ?? []).filter((i) => classifyItem(i) === 'external'),
    [row?.items],
  )

  const gaps = useMemo(() => {
    const raw = row?.factual_gaps
    if (!Array.isArray(raw)) return []
    return raw.filter((g) => Boolean(gapText(g))).slice(0, 5)
  }, [row?.factual_gaps])

  const financialHighlights = useMemo(
    () => parseFinancialHighlights(row?.financial_highlights),
    [row?.financial_highlights],
  )

  if (!isSupabaseConfigured()) {
    return (
      <section className="mt-10 rounded-2xl border border-dashed border-stroke bg-surface px-6 py-8 shadow-none dark:bg-white/[0.04]">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Research</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
          Connect Supabase to load cached research, or run{' '}
          <span className="font-mono text-[12px]">npm run research:company</span> locally.
        </p>
      </section>
    )
  }

  const hasNarratives =
    Boolean(row?.company_narrative?.trim()) || Boolean(row?.media_narrative?.trim())
  const hasHighlights =
    financialHighlights !== null && financialHighlights.metrics.length > 0
  const hasHeadlines = (row?.items?.length ?? 0) > 0

  return (
    <section className="mt-10 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">The story</h2>
          <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            Official disclosures versus independent coverage — gaps surfaced automatically.
          </p>
          {row?.fetched_at ? (
            <p className="mt-3 text-[13px] text-ink-subtle">
              Updated {formatAgo(row.fetched_at)}
              {row.model ? (
                <span className="ml-1.5 font-mono text-[11px] text-ink-muted">· {row.model}</span>
              ) : null}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 self-start rounded-full px-5"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? 'Refreshing…' : 'Refresh research'}
        </Button>
      </div>

      {loading ? (
        <p className="text-[15px] text-ink-muted" role="status">
          Loading research…
        </p>
      ) : null}

      {error ? (
        <p className="text-[15px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {row?.error ? (
        <p className="text-[15px] text-danger" role="alert">
          Last fetch error: {row.error}
        </p>
      ) : null}

      {!loading && !hasNarratives && !hasHeadlines && !error ? (
        <p className="rounded-2xl border border-divider bg-surface px-6 py-8 text-[15px] leading-relaxed text-ink-muted dark:bg-white/[0.04]">
          No research yet. Deploy the{' '}
          <span className="font-mono text-[12px]">research-company</span> Edge Function and tap{' '}
          <span className="font-medium text-ink">Refresh research</span>, or run{' '}
          <span className="font-mono text-[12px]">npm run research:company -- {slug}</span>.
        </p>
      ) : null}

      {/* ── Factual Gaps — hero feature, surfaced first ─────────────────────── */}
      {gaps.length > 0 ? (
        <div className="rounded-2xl border border-accent/25 bg-accent-soft/40 px-6 py-6 dark:bg-accent-soft/20">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">
              Factual gaps · this quarter
            </p>
          </div>
          <ul className="mt-4 space-y-3">
            {gaps.map((g, i) => {
              const text = gapText(g)
              const cat = gapCategory(g)
              return (
                <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink">
                  {cat ? (
                    <span className="mt-0.5 shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                      {GAP_CATEGORY_LABELS[cat] ?? cat}
                    </span>
                  ) : (
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  )}
                  <span>{text}</span>
                </li>
              )
            })}
          </ul>
          <div className="mt-5 space-y-0.5">
            <p className="text-[12px] text-ink-subtle">Objective mismatches only · no interpretation</p>
            <p className="text-[11px] text-ink-subtle">
              Limited independent coverage—gaps may reflect disclosure depth rather than disagreement.
            </p>
          </div>
        </div>
      ) : null}

      {/* ── Key Financial Highlights ─────────────────────────────────────────── */}
      {hasHighlights ? (
        <div className="rounded-2xl border border-divider bg-surface px-6 py-5 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Key financial highlights
            </p>
            <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-[11px] font-medium text-ink-subtle ring-1 ring-inset ring-divider dark:bg-white/[0.06]">
              {financialHighlights!.period}
              {financialHighlights!.period_end ? ` · Ended ${financialHighlights!.period_end}` : ''}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {financialHighlights!.metrics.map((m, i) => (
              <div key={i} className="min-w-0">
                <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                  {m.label}
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[18px] font-semibold tabular-nums tracking-tight text-ink">
                    {m.value}
                  </span>
                  {m.yoy ? (
                    <span
                      className={cn(
                        'text-[12px] font-medium tabular-nums',
                        m.yoy.startsWith('+')
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : m.yoy.startsWith('-')
                            ? 'text-red-500 dark:text-red-400'
                            : 'text-ink-muted',
                      )}
                    >
                      {m.yoy}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[11px] text-ink-subtle">From official IR &amp; SEC filings only</p>
        </div>
      ) : null}

      {/* ── Narratives — distinct visual treatments ──────────────────────────── */}
      {hasNarratives ? (
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Company Narrative */}
          <article className="flex flex-col rounded-xl border border-divider bg-surface p-6 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold tracking-tight text-ink">
                  Company Narrative
                </p>
                <p className="mt-0.5 text-[12px] text-ink-subtle">
                  From IR, filings, and earnings materials
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-600/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-400">
                Official IR &amp; Filings
              </span>
            </div>
            <div className="mt-1 h-px w-full bg-emerald-600/15 dark:bg-emerald-400/15" />
            {row?.company_narrative?.trim() ? (
              <p className="mt-4 flex-1 text-[15px] leading-[1.75] text-ink">
                {row.company_narrative}
              </p>
            ) : (
              <p className="mt-4 text-[14px] italic leading-relaxed text-ink-muted">
                No official narrative yet — tap Refresh research.
              </p>
            )}
          </article>

          {/* Media & Analyst Narrative */}
          <article className="flex flex-col rounded-xl border border-divider bg-surface p-6 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold tracking-tight text-ink">
                  Media &amp; Analyst Narrative
                </p>
                <p className="mt-0.5 text-[12px] text-ink-subtle">
                  From third-party news and analyst coverage
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-slate-400/40 bg-slate-100/60 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-400">
                Independent Sources
              </span>
            </div>
            <div className="mt-1 h-px w-full bg-slate-400/15" />
            {row?.media_narrative?.trim() ? (
              <p className="mt-4 flex-1 text-[15px] leading-[1.75] text-ink">
                {row.media_narrative}
              </p>
            ) : (
              <p className="mt-4 text-[14px] italic leading-relaxed text-ink-muted">
                No independent coverage found — gaps may reflect limited third-party analysis.
              </p>
            )}
          </article>
        </div>
      ) : null}

      {/* ── Headlines — supporting detail, collapsible ───────────────────────── */}
      {hasHeadlines ? (
        <div className="border-t border-divider pt-8">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 text-left"
            onClick={() => setHeadlinesOpen((o) => !o)}
          >
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Headlines &amp; sources</h3>
              <p className="mt-0.5 text-[13px] text-ink-subtle">
                {row?.items?.length ?? 0} items in cache
                {companyItems.length || mediaItems.length
                  ? ` · ${companyItems.length} company · ${mediaItems.length} media`
                  : ''}
              </p>
            </div>
            <span className="text-[13px] font-medium text-accent">
              {headlinesOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          {headlinesOpen && row ? (
            <ul className="mt-6 space-y-5">
              {row.items.map((item: ResearchNewsItem, i: number) => (
                <li
                  key={`${item.url}-${i}`}
                  className="border-b border-divider pb-5 last:border-0 last:pb-0"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[15px] font-medium text-accent underline decoration-accent/35 underline-offset-2"
                  >
                    {item.title}
                  </a>
                  {item.source ? (
                    <p className="mt-1 text-[12px] text-ink-subtle">{item.source}</p>
                  ) : null}
                  {item.published_at ? (
                    <p className="mt-0.5 text-[11px] text-ink-subtle">{item.published_at}</p>
                  ) : null}
                  {item.snippet ? (
                    <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{item.snippet}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
