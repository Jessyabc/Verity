import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useCompanyResearch } from '@/hooks/useCompanyResearch'
import { classifyItem } from '@/lib/headlineGrouping'
import type { ResearchNewsItem } from '@/lib/research/types'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatAgo } from '@/lib/supabase/monitoringQueries'
import { cn } from '@/lib/cn'

function gapText(g: unknown): string {
  if (typeof g === 'string') return g
  if (g && typeof g === 'object' && 'text' in g && typeof (g as { text: string }).text === 'string') {
    return (g as { text: string }).text
  }
  return ''
}

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
    return raw.map(gapText).filter(Boolean).slice(0, 5)
  }, [row?.factual_gaps])

  if (!isSupabaseConfigured()) {
    return (
      <section className="mt-10 rounded-2xl border border-dashed border-black/[0.1] bg-white/40 px-6 py-8 shadow-none dark:border-white/[0.12] dark:bg-white/[0.04]">
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
  const hasHeadlines = (row?.items?.length ?? 0) > 0

  return (
    <section className="mt-10 space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">The story</h2>
          <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            How the company frames itself versus how media and analysts see it — refreshed from your
            research cache.
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
        <p className="rounded-2xl border border-black/[0.06] bg-white/50 px-6 py-8 text-[15px] leading-relaxed text-ink-muted dark:bg-white/[0.04]">
          No research yet. Deploy the <span className="font-mono text-[12px]">research-company</span>{' '}
          Edge Function and tap <span className="font-medium text-ink">Refresh research</span>, or
          run{' '}
          <span className="font-mono text-[12px]">npm run research:company -- {slug}</span>.
        </p>
      ) : null}

      {/* Narratives — editorial, front and center */}
      {hasNarratives ? (
        <div className="grid gap-10 lg:grid-cols-2">
          <article
            className={cn(
              'border-l-[3px] pl-6',
              'border-emerald-700/70 dark:border-emerald-400/60',
            )}
          >
            <p className="text-[13px] font-semibold tracking-tight text-ink">Company narrative</p>
            <p className="mt-1 text-[13px] text-ink-subtle">From filings, IR, and official channels</p>
            {row?.company_narrative?.trim() ? (
              <p className="mt-4 text-[17px] leading-[1.65] text-ink">{row.company_narrative}</p>
            ) : (
              <p className="mt-4 text-[15px] italic leading-relaxed text-ink-muted">
                Run refresh to generate this narrative.
              </p>
            )}
          </article>
          <article
            className={cn(
              'border-l-[3px] pl-6',
              'border-slate-500/80 dark:border-slate-400/60',
            )}
          >
            <p className="text-[13px] font-semibold tracking-tight text-ink">
              Media &amp; analyst narrative
            </p>
            <p className="mt-1 text-[13px] text-ink-subtle">News, research, and the wider conversation</p>
            {row?.media_narrative?.trim() ? (
              <p className="mt-4 text-[17px] leading-[1.65] text-ink">{row.media_narrative}</p>
            ) : (
              <p className="mt-4 text-[15px] italic leading-relaxed text-ink-muted">
                Run refresh to generate this narrative.
              </p>
            )}
          </article>
        </div>
      ) : null}

      {/* Factual gaps */}
      {gaps.length > 0 ? (
        <div className="rounded-2xl border border-accent/25 bg-accent-soft/40 px-6 py-6 dark:bg-accent-soft/20">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-accent">
            Biggest factual gaps
          </p>
          <ul className="mt-4 space-y-3">
            {gaps.map((g, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{g}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-ink-subtle">
            Objective mismatches only — not investment advice.
          </p>
        </div>
      ) : null}

      {/* Headlines — supporting detail */}
      {hasHeadlines ? (
        <div className="border-t border-black/[0.06] pt-8 dark:border-white/[0.08]">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 text-left"
            onClick={() => setHeadlinesOpen((o) => !o)}
          >
            <div>
              <h3 className="text-[15px] font-semibold text-ink">Headlines &amp; sources</h3>
              <p className="mt-0.5 text-[13px] text-ink-subtle">
                {(row?.items?.length ?? 0)} items in cache
                {companyItems.length || mediaItems.length
                  ? ` · ${companyItems.length} company · ${mediaItems.length} media`
                  : ''}
              </p>
            </div>
            <span className="text-[13px] font-medium text-accent">{headlinesOpen ? 'Hide' : 'Show'}</span>
          </button>

          {headlinesOpen && row ? (
            <ul className="mt-6 space-y-5">
              {row.items.map((item: ResearchNewsItem, i: number) => (
                <li
                  key={`${item.url}-${i}`}
                  className="border-b border-black/[0.05] pb-5 last:border-0 last:pb-0 dark:border-white/[0.06]"
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
