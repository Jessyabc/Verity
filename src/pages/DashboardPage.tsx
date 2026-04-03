import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CompanyLogo } from '@/components/CompanyLogo'
import { OrbIcon } from '@/components/icons/OrbIcon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { getPilotCompanyBySlug } from '@/data/pilot-universe'
import { getRecentUpdatesForSlugs } from '@/data/queries'
import type { PilotCompany } from '@/data/types'
import { useReadUpdates } from '@/hooks/useReadUpdates'
import { useRecentDbDocuments } from '@/hooks/useRecentDbDocuments'
import { useWatchlist } from '@/hooks/useWatchlist'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { formatAgo, shortDocumentTitle } from '@/lib/supabase/monitoringQueries'

export function DashboardPage() {
  const { slugs } = useWatchlist()
  const [researchBusy, setResearchBusy] = useState(false)
  const [researchErr, setResearchErr] = useState<string | null>(null)
  const { isRead } = useReadUpdates()
  const recent = getRecentUpdatesForSlugs(slugs, 8)
  const {
    loading: dbLoading,
    error: dbError,
    rows: dbRows,
  } = useRecentDbDocuments(slugs, 8)

  const hasWatchlist = slugs.length > 0

  async function refreshWatchlistResearch() {
    if (!isSupabaseConfigured()) return
    setResearchBusy(true)
    setResearchErr(null)
    try {
      const sb = getSupabaseBrowserClient()
      for (const slug of slugs) {
        const c = getPilotCompanyBySlug(slug)
        if (!c) continue
        const { error } = await sb.functions.invoke('research-company', {
          body: { slug: c.slug, companyName: c.name, ticker: c.ticker },
        })
        if (error) throw new Error(error.message)
      }
    } catch (e: unknown) {
      setResearchErr(e instanceof Error ? e.message : String(e))
    } finally {
      setResearchBusy(false)
    }
  }

  return (
    <Container>
      <header className="mb-10 flex flex-col gap-4 sm:mb-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
            Watchlist
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-ink sm:text-[2rem]">
            What’s new across your companies
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            {hasWatchlist
              ? 'Pilot data and watchlist both live locally in this build — swap for an API when you’re ready.'
              : 'Add companies from search. Watchlists save in your browser for this signed-in session.'}
          </p>
        </div>
        <Button variant="secondary" className="shrink-0 self-start sm:self-auto" asChild>
          <Link to="/app/search">Find a company</Link>
        </Button>
      </header>

      {!hasWatchlist ? (
        <Card className="border-dashed border-black/[0.12] bg-white/55 shadow-none">
          <div className="flex flex-col items-center py-12 text-center sm:py-16">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft">
              <OrbIcon />
            </div>
            <h2 className="text-lg font-medium tracking-tight text-ink">
              No companies on your watchlist
            </h2>
            <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-muted">
              Search the pilot universe and tap <span className="text-ink">Watch</span> on a
              profile. Updates will aggregate here with source links.
            </p>
            <Button className="mt-8" variant="primary" asChild>
              <Link to="/app/search">Browse pilot companies</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <section className="space-y-10">
          <div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
                Your companies
              </h2>
              {isSupabaseConfigured() ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start sm:self-auto"
                  disabled={researchBusy}
                  onClick={() => void refreshWatchlistResearch()}
                >
                  {researchBusy ? 'Refreshing research…' : 'Refresh research (watchlist)'}
                </Button>
              ) : null}
            </div>
            {researchErr ? (
              <p className="mt-2 text-[13px] text-rose-800" role="alert">
                {researchErr}
              </p>
            ) : null}
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slugs
                .map((slug) => {
                  const company = getPilotCompanyBySlug(slug)
                  return company ? { slug, company } : null
                })
                .filter(
                  (row): row is { slug: string; company: PilotCompany } =>
                    row !== null,
                )
                .map(({ slug, company: c }) => (
                  <li key={slug}>
                    <Link to={`/app/company/${slug}`}>
                      <Card
                        padding="sm"
                        className="h-full transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_12px_40px_rgba(12,13,17,0.08)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <CompanyLogo
                              name={c.name}
                              ticker={c.ticker}
                              logoUrl={c.logoUrl}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="font-medium tracking-tight text-ink">{c.name}</p>
                              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
                                {c.tagline}
                              </p>
                            </div>
                          </div>
                          {c.ticker ? (
                            <span className="shrink-0 rounded-md border border-black/[0.06] bg-white/80 px-2 py-1 font-mono text-[11px] font-medium tabular-nums text-ink">
                              {c.ticker}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-4 text-[12px] text-ink-subtle">
                          Last check:{' '}
                          <span className="text-ink-muted">{c.companyLastCheckedLabel}</span>
                        </p>
                      </Card>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          {isSupabaseConfigured() ? (
            <div>
              <h2 className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
                Live tracked URLs
              </h2>
              <p className="mt-1 text-[13px] text-ink-subtle">
                From Supabase <span className="font-mono text-[12px]">tracked_documents</span> for
                companies on your watchlist.
              </p>
              {dbLoading ? (
                <p className="mt-4 text-[14px] text-ink-muted" role="status">
                  Loading live rows…
                </p>
              ) : null}
              {dbError ? (
                <p className="mt-4 text-[14px] text-rose-800" role="alert">
                  {dbError}
                </p>
              ) : null}
              {!dbLoading && !dbError && dbRows.length === 0 ? (
                <Card className="mt-4 border-dashed border-black/[0.1] bg-white/45 shadow-none">
                  <p className="text-[14px] leading-relaxed text-ink-muted">
                    No live rows yet — apply migrations, seed companies/sources, then run{' '}
                    <span className="font-mono text-[12px]">npm run monitor:once</span>.
                  </p>
                </Card>
              ) : null}
              {dbRows.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {dbRows.map(({ document: d, companyName, companySlug }) => (
                    <li key={d.id}>
                      <Card
                        padding="sm"
                        className="transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_12px_40px_rgba(12,13,17,0.08)]"
                      >
                        <Link to={`/app/updates/${d.id}`} className="block">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                            {companyName} · {formatAgo(d.last_checked_at)}
                          </p>
                          <div className="mt-2 flex items-start justify-between gap-3">
                            <p className="text-[15px] font-medium tracking-tight text-ink">
                              {shortDocumentTitle(d)}
                            </p>
                            {!isRead(d.id) ? (
                              <span
                                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                                aria-label="Unread"
                              />
                            ) : null}
                          </div>
                          <p className="mt-2 line-clamp-2 font-mono text-[12px] leading-relaxed text-ink-muted">
                            {d.canonical_url}
                          </p>
                          {d.summary_text?.trim() ? (
                            <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink-muted">
                              {d.summary_text}
                            </p>
                          ) : null}
                        </Link>
                        <p className="mt-3 text-[12px] text-ink-subtle">
                          <Link
                            to={`/app/company/${companySlug}`}
                            className="text-accent underline decoration-accent/35 underline-offset-2"
                          >
                            Company profile
                          </Link>
                        </p>
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div>
            <h2 className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
              Pilot demo updates
            </h2>
            <p className="mt-1 text-[13px] text-ink-subtle">
              Bundled narratives — works without Supabase.
            </p>
            {recent.length === 0 ? (
              <Card className="mt-4 border-dashed border-black/[0.1] bg-white/45 shadow-none">
                <p className="text-[14px] leading-relaxed text-ink-muted">
                  No sample documents yet for your watchlist — JPMorgan is a pilot with
                  zero fixtures on purpose. Add Microsoft or Apple to see entries.
                </p>
              </Card>
            ) : (
              <ul className="mt-4 space-y-3">
                {recent.map(({ company, update }) => (
                  <li key={update.id}>
                    <Link to={`/app/updates/${update.id}`}>
                      <Card
                        padding="sm"
                        className="transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_12px_40px_rgba(12,13,17,0.08)]"
                      >
                        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                          {company.name} · {update.sourceCategoryLabel}
                        </p>
                        <div className="mt-2 flex items-start justify-between gap-3">
                          <p className="text-[15px] font-medium tracking-tight text-ink">
                            {update.title}
                          </p>
                          {!isRead(update.id) ? (
                            <span
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                              aria-label="Unread"
                            />
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink-muted">
                          {update.summary}
                        </p>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </Container>
  )
}
