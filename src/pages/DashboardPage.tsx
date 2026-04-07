import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CompanyLogo } from '@/components/CompanyLogo'
import { OrbIcon } from '@/components/icons/OrbIcon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { getPilotCompanyBySlug } from '@/data/pilot-universe'
import { getRecentUpdatesForSlugs } from '@/data/queries'
import { useReadUpdates } from '@/hooks/useReadUpdates'
import { useRecentDbDocuments } from '@/hooks/useRecentDbDocuments'
import { useWatchlist } from '@/hooks/useWatchlist'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { messageFromFunctionsInvokeFailure } from '@/lib/supabase/edgeFunctionError'
import type { DbCompany } from '@/lib/supabase/monitoringTypes'
import {
  fetchCompaniesBySlugs,
  fetchCompanyRowBySlug,
  formatAgo,
  shortDocumentTitle,
} from '@/lib/supabase/monitoringQueries'
import {
  fetchResearchCacheRowsForSlugs,
  flattenWatchlistResearchHighlights,
  type WatchlistResearchHighlight,
} from '@/lib/supabase/researchQueries'
import { invokeWatchlistBrief } from '@/lib/supabase/watchlistBrief'

export function DashboardPage() {
  const { slugs } = useWatchlist()
  const [researchBusy, setResearchBusy] = useState(false)
  const [researchErr, setResearchErr] = useState<string | null>(null)
  const [researchDigest, setResearchDigest] = useState<WatchlistResearchHighlight[]>([])
  const [researchDigestLoading, setResearchDigestLoading] = useState(false)
  const [researchDigestTick, setResearchDigestTick] = useState(0)
  const [watchlistBrief, setWatchlistBrief] = useState<string | null>(null)
  const [watchlistBriefMeta, setWatchlistBriefMeta] = useState<{
    model: string | null
    generated_at: string
  } | null>(null)
  const [watchlistBriefBusy, setWatchlistBriefBusy] = useState(false)
  const [watchlistBriefErr, setWatchlistBriefErr] = useState<string | null>(null)
  const { isRead } = useReadUpdates()
  const pilotUpdates = getRecentUpdatesForSlugs(slugs, 8)
  const {
    loading: dbLoading,
    error: dbError,
    rows: dbRows,
  } = useRecentDbDocuments(slugs, 12)

  // Fetch inventory (non-pilot) company rows from Supabase so they show in the grid
  const inventorySlugs = useMemo(
    () => slugs.filter((s) => !getPilotCompanyBySlug(s)),
    [slugs],
  )
  const [inventoryCompanies, setInventoryCompanies] = useState<DbCompany[]>([])
  useEffect(() => {
    if (!isSupabaseConfigured() || inventorySlugs.length === 0) {
      setInventoryCompanies([])
      return
    }
    void fetchCompaniesBySlugs(inventorySlugs).then(setInventoryCompanies).catch(() => {
      setInventoryCompanies([])
    })
  }, [inventorySlugs])

  useEffect(() => {
    if (!isSupabaseConfigured() || slugs.length === 0) {
      setResearchDigest([])
      return
    }
    setResearchDigestLoading(true)
    void fetchResearchCacheRowsForSlugs(slugs)
      .then((rows) => setResearchDigest(flattenWatchlistResearchHighlights(rows)))
      .catch(() => setResearchDigest([]))
      .finally(() => setResearchDigestLoading(false))
  }, [slugs, researchDigestTick])

  const hasWatchlist = slugs.length > 0

  async function refreshWatchlistResearch() {
    if (!isSupabaseConfigured()) return
    setResearchBusy(true)
    setResearchErr(null)
    try {
      const sb = getSupabaseBrowserClient()
      for (const slug of slugs) {
        const pilot = getPilotCompanyBySlug(slug)
        let companyName: string
        let ticker: string | null
        if (pilot) {
          companyName = pilot.name
          ticker = pilot.ticker
        } else {
          const row = await fetchCompanyRowBySlug(slug)
          if (!row) continue
          companyName = row.name
          ticker = row.ticker
        }
        const { data, error, response } = await sb.functions.invoke<{ error?: string }>(
          'research-company',
          { body: { slug, companyName, ticker } },
        )
        if (error) {
          const msg = await messageFromFunctionsInvokeFailure(error, response)
          throw new Error(msg)
        }
        if (data && typeof data === 'object' && 'error' in data && data.error) {
          throw new Error(String(data.error))
        }
      }
      setResearchDigestTick((t) => t + 1)
    } catch (e: unknown) {
      setResearchErr(e instanceof Error ? e.message : String(e))
    } finally {
      setResearchBusy(false)
    }
  }

  async function generateWatchlistBrief() {
    if (!isSupabaseConfigured()) return
    setWatchlistBriefBusy(true)
    setWatchlistBriefErr(null)
    try {
      const r = await invokeWatchlistBrief()
      setWatchlistBrief(r.brief)
      setWatchlistBriefMeta({ model: r.model, generated_at: r.generated_at })
    } catch (e: unknown) {
      setWatchlistBriefErr(e instanceof Error ? e.message : String(e))
    } finally {
      setWatchlistBriefBusy(false)
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
            What's new across your companies
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-muted">
            {hasWatchlist
              ? 'Latest filings, press releases, and IR documents — linked directly to the source.'
              : 'Add companies from search, then track their latest documents here.'}
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
              Search the universe and tap <span className="text-ink">Watch</span> on a profile.
              New documents will surface here with direct source links.
            </p>
            <Button className="mt-8" variant="primary" asChild>
              <Link to="/app/search">Browse companies</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <section className="space-y-10">
          {isSupabaseConfigured() ? (
            <div>
              <h2 className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
                Watchlist summary
              </h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-subtle">
                Factual overview from your cached research snippets and monitored page summaries only
                — no recommendations. Generated on demand via OpenAI on the server.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={watchlistBriefBusy}
                  onClick={() => void generateWatchlistBrief()}
                >
                  {watchlistBriefBusy
                    ? 'Generating…'
                    : watchlistBrief
                      ? 'Regenerate summary'
                      : 'Generate watchlist summary'}
                </Button>
              </div>
              {watchlistBriefErr ? (
                <p className="mt-2 text-[13px] text-danger" role="alert">
                  {watchlistBriefErr}
                </p>
              ) : null}
              {watchlistBrief ? (
                <Card className="mt-4 border-black/[0.08] bg-white/70 shadow-[0_8px_32px_rgba(12,13,17,0.06)]">
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-muted">
                    {watchlistBrief}
                  </p>
                  {watchlistBriefMeta?.generated_at ? (
                    <p className="mt-3 text-[11px] text-ink-subtle">
                      Generated {formatAgo(watchlistBriefMeta.generated_at)}
                      {watchlistBriefMeta.model ? ` · ${watchlistBriefMeta.model}` : null}
                    </p>
                  ) : null}
                </Card>
              ) : null}
            </div>
          ) : null}

          {/* ── Your companies grid ── */}
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
                  {researchBusy ? 'Refreshing…' : 'Refresh research'}
                </Button>
              ) : null}
            </div>
            {researchErr ? (
              <p className="mt-2 text-[13px] text-danger" role="alert">
                {researchErr}
              </p>
            ) : null}
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Pilot companies */}
              {slugs
                .map((slug) => {
                  const c = getPilotCompanyBySlug(slug)
                  return c ? { slug, name: c.name, ticker: c.ticker, tagline: c.tagline, logoUrl: c.logoUrl, exchange: c.exchange, lastCheckedLabel: c.companyLastCheckedLabel } : null
                })
                .filter((r): r is NonNullable<typeof r> => r !== null)
                .map(({ slug, name, ticker, tagline, logoUrl, exchange, lastCheckedLabel }) => (
                  <li key={slug}>
                    <Link to={`/app/company/${slug}`}>
                      <Card
                        padding="sm"
                        className="h-full transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_12px_40px_rgba(12,13,17,0.08)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <CompanyLogo name={name} ticker={ticker} logoUrl={logoUrl} size="sm" />
                            <div className="min-w-0">
                              <p className="font-medium tracking-tight text-ink">{name}</p>
                              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
                                {tagline}
                              </p>
                            </div>
                          </div>
                          {ticker ? (
                            <span className="shrink-0 rounded-md border border-black/[0.06] bg-white/80 px-2 py-1 font-mono text-[11px] font-medium tabular-nums text-ink">
                              {ticker}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-2">
                          <p className="text-[12px] text-ink-subtle">
                            Last check:{' '}
                            <span className="text-ink-muted">{lastCheckedLabel}</span>
                          </p>
                          {exchange ? (
                            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                              {exchange}
                            </span>
                          ) : null}
                        </div>
                      </Card>
                    </Link>
                  </li>
                ))}
              {/* Inventory (non-pilot) companies fetched from Supabase */}
              {inventoryCompanies.map((c) => (
                <li key={c.slug}>
                  <Link to={`/app/company/${c.slug}`}>
                    <Card
                      padding="sm"
                      className="h-full transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_12px_40px_rgba(12,13,17,0.08)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <CompanyLogo name={c.name} ticker={c.ticker} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium tracking-tight text-ink">{c.name}</p>
                            {c.tagline ? (
                              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
                                {c.tagline}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {c.ticker ? (
                          <span className="shrink-0 rounded-md border border-black/[0.06] bg-white/80 px-2 py-1 font-mono text-[11px] font-medium tabular-nums text-ink">
                            {c.ticker}
                          </span>
                        ) : null}
                      </div>
                      {c.exchange ? (
                        <p className="mt-4 text-right text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                          {c.exchange}
                        </p>
                      ) : null}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── AI research digest (Perplexity cache) ── */}
          {isSupabaseConfigured() ? (
            <div>
              <h2 className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
                Research snapshot (AI)
              </h2>
              <p className="mt-1 text-[13px] text-ink-subtle">
                Top items from cached Perplexity runs per watchlist company — not the same as monitored
                pages below. Use <span className="font-medium text-ink-muted">Refresh research</span>{' '}
                above to refill.
              </p>
              {researchDigestLoading ? (
                <p className="mt-4 text-[14px] text-ink-muted" role="status">
                  Loading research cache…
                </p>
              ) : null}
              {!researchDigestLoading && researchDigest.length === 0 ? (
                <Card className="mt-4 border-dashed border-black/[0.1] bg-white/45 shadow-none">
                  <p className="text-[14px] leading-relaxed text-ink-muted">
                    No research cache yet — open a company and refresh research, or use{' '}
                    <span className="font-mono text-[12px]">Refresh research</span> here.
                  </p>
                </Card>
              ) : null}
              {researchDigest.length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {researchDigest.map((h, i) => (
                    <li key={`${h.slug}-${h.item.url}-${i}`}>
                      <Card
                        padding="sm"
                        className="transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_12px_40px_rgba(12,13,17,0.08)]"
                      >
                        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                          <Link
                            to={`/app/company/${h.slug}`}
                            className="text-accent hover:underline underline-offset-2"
                          >
                            {h.companyName}
                          </Link>
                          {' · '}
                          {formatAgo(h.fetchedAt)}
                          {h.item.source ? ` · ${h.item.source}` : null}
                        </p>
                        <a
                          href={h.item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block text-[15px] font-medium tracking-tight text-ink hover:text-accent"
                        >
                          {h.item.title}
                        </a>
                        {h.item.snippet?.trim() ? (
                          <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-ink-muted">
                            {h.item.snippet}
                          </p>
                        ) : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {/* ── Monitored pages (tracked_documents) ── */}
          <div>
            <h2 className="text-[13px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
              Monitored pages
            </h2>
            <p className="mt-1 text-[13px] text-ink-subtle">
              {isSupabaseConfigured()
                ? 'Live URLs from your sources (EDGAR, IR, …). Summaries appear after enrich runs on each tracked page.'
                : 'Bundled pilot data — connect Supabase to see live documents.'}
            </p>

            {/* Live DB documents */}
            {isSupabaseConfigured() ? (
              <>
                {dbLoading ? (
                  <p className="mt-4 text-[14px] text-ink-muted" role="status">
                    Loading documents…
                  </p>
                ) : null}
                {dbError ? (
                  <p className="mt-4 text-[14px] text-danger" role="alert">
                    {dbError}
                  </p>
                ) : null}
                {!dbLoading && !dbError && dbRows.length === 0 ? (
                  <Card className="mt-4 border-dashed border-black/[0.1] bg-white/45 shadow-none">
                    <p className="text-[14px] leading-relaxed text-ink-muted">
                      No documents yet — apply migrations, add company sources, then run{' '}
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
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                              <Link
                                to={`/app/company/${companySlug}`}
                                className="text-accent hover:underline underline-offset-2"
                              >
                                {companyName}
                              </Link>
                              {' · '}
                              {formatAgo(d.last_checked_at)}
                            </p>
                            {!isRead(d.id) ? (
                              <span
                                className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                                aria-label="Unread"
                              />
                            ) : null}
                          </div>
                          {/* Title links directly to source document on company site */}
                          <a
                            href={d.canonical_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 block text-[15px] font-medium tracking-tight text-ink hover:text-accent"
                          >
                            {shortDocumentTitle(d)}
                          </a>
                          {d.summary_text?.trim() ? (
                            <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-ink-muted">
                              {d.summary_text}
                            </p>
                          ) : null}
                          <div className="mt-3 flex items-center gap-4">
                            <p className="truncate font-mono text-[11px] text-ink-subtle">
                              {d.canonical_url}
                            </p>
                            <Link
                              to={`/app/updates/${d.id}`}
                              className="shrink-0 text-[12px] font-medium text-accent underline-offset-2 hover:underline"
                            >
                              Details →
                            </Link>
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : null}

            {/* Pilot demo updates — shown as fallback when no live data */}
            {(!isSupabaseConfigured() || (!dbLoading && dbRows.length === 0 && !dbError)) && pilotUpdates.length > 0 ? (
              <ul className={`space-y-3 ${isSupabaseConfigured() ? 'mt-6' : 'mt-4'}`}>
                {isSupabaseConfigured() ? (
                  <li>
                    <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-subtle">
                      Pilot demo data
                    </p>
                  </li>
                ) : null}
                {pilotUpdates.map(({ company, update }) => (
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
            ) : null}

            {!isSupabaseConfigured() && pilotUpdates.length === 0 ? (
              <Card className="mt-4 border-dashed border-black/[0.1] bg-white/45 shadow-none">
                <p className="text-[14px] leading-relaxed text-ink-muted">
                  No sample documents for your current watchlist — try adding Microsoft or Apple to
                  see pilot entries.
                </p>
              </Card>
            ) : null}
          </div>

        </section>
      )}
    </Container>
  )
}
