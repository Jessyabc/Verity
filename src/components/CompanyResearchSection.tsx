import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useCompanyResearch } from '@/hooks/useCompanyResearch'
import type { ResearchNewsItem } from '@/lib/research/types'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatAgo } from '@/lib/supabase/monitoringQueries'

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

  if (!isSupabaseConfigured()) {
    return (
      <Card className="mt-8 border-dashed border-black/[0.1] bg-white/45 shadow-none">
        <h2 className="text-[15px] font-medium text-ink">Research & news</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          Connect Supabase to load cached Perplexity research, or run{' '}
          <span className="font-mono text-[12px]">npm run research:company</span> locally.
        </p>
      </Card>
    )
  }

  const items = row?.items ?? []

  return (
    <Card className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[15px] font-medium text-ink">Research & news</h2>
          <p className="mt-1 text-[13px] text-ink-subtle">
            Web-grounded headlines via Perplexity (Sonar). Verify links before relying on them.
          </p>
          {row?.fetched_at ? (
            <p className="mt-2 text-[12px] text-ink-subtle">
              Last updated {formatAgo(row.fetched_at)}
              {row.model ? (
                <span className="ml-1.5 font-mono text-[11px] text-ink-muted">
                  · {row.model}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 self-start"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </Button>
      </div>

      {loading ? (
        <p className="mt-6 text-[14px] text-ink-muted" role="status">
          Loading research cache…
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-[14px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {row?.error ? (
        <p className="mt-4 text-[14px] text-danger" role="alert">
          Last fetch error: {row.error}
        </p>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <p className="mt-6 text-[14px] leading-relaxed text-ink-muted">
          No cached items yet. Deploy the{' '}
          <span className="font-mono text-[12px]">research-company</span> Edge Function and tap
          Refresh, or run{' '}
          <span className="font-mono text-[12px]">npm run research:company -- {slug}</span>.
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-6 space-y-4">
          {items.map((item: ResearchNewsItem, i: number) => (
            <li
              key={`${item.url}-${i}`}
              className="border-b border-black/[0.05] pb-4 last:border-0 last:pb-0"
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
    </Card>
  )
}
