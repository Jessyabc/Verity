import { Link, useParams } from 'react-router-dom'
import { CompanyResearchSection } from '@/components/CompanyResearchSection'
import { CompanyLogo } from '@/components/CompanyLogo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { getPilotCompanyBySlug } from '@/data/pilot-universe'
import type { MonitoredSource } from '@/data/types'
import { useCompanyMonitoring } from '@/hooks/useCompanyMonitoring'
import { useReadUpdates } from '@/hooks/useReadUpdates'
import { useWatchlist } from '@/hooks/useWatchlist'
import { resolveProfileCompany } from '@/lib/companyProfileView'
import { cn } from '@/lib/cn'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import {
  formatAgo,
  mapDbStatusToUi,
  shortDocumentTitle,
} from '@/lib/supabase/monitoringQueries'

function sourceBadgeClasses(status: MonitoredSource['status']) {
  if (status === 'active') return 'bg-emerald-500/10 text-emerald-900'
  if (status === 'blocked') return 'bg-amber-500/12 text-amber-950'
  return 'bg-rose-500/10 text-rose-950'
}

function sourceBadgeLabel(status: MonitoredSource['status']) {
  if (status === 'active') return 'Active'
  if (status === 'blocked') return 'Blocked'
  return 'Issue'
}

export function CompanyProfilePage() {
  const { slug } = useParams()
  const pilot = slug ? getPilotCompanyBySlug(slug) : undefined
  const { isWatched, toggle } = useWatchlist()
  const { isRead } = useReadUpdates()
  const { loading: dbLoading, error: dbError, bundle } = useCompanyMonitoring(slug)

  const view = resolveProfileCompany(pilot, bundle?.company ?? undefined)

  const waitingForDb =
    Boolean(slug) &&
    !pilot &&
    isSupabaseConfigured() &&
    dbLoading

  if (!slug) {
    return (
      <Container className="max-w-xl">
        <p className="text-[15px] text-ink-muted">Missing company slug.</p>
      </Container>
    )
  }

  if (waitingForDb) {
    return (
      <Container>
        <p className="text-[15px] text-ink-muted">Loading company…</p>
      </Container>
    )
  }

  if (!view) {
    return (
      <Container className="max-w-xl">
        <header className="mb-8">
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
            Company
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.03em] text-ink">
            Company not found
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            This slug isn’t in the pilot bundle or your Supabase inventory yet. Ask an admin to add
            it, or extend <code className="rounded-md bg-black/[0.04] px-1.5 py-0.5 font-mono text-[13px] text-ink">pilot-universe.ts</code>.
          </p>
        </header>
        <Card>
          <Button variant="secondary" className="w-full sm:w-auto" asChild>
            <Link to="/app/search">Back to search</Link>
          </Button>
        </Card>
      </Container>
    )
  }

  const watched = isWatched(view.slug)

  const dbSourceByKey = new Map(
    (bundle?.sources ?? []).map((s) => [s.source_key, s] as const),
  )
  const pilotSourceKeys = new Set(view.pilotSources.map((s) => s.id))
  const extraDbSources = (bundle?.sources ?? []).filter((s) => !pilotSourceKeys.has(s.source_key))

  const latestCompanyCheckIso = (bundle?.sources ?? []).reduce<string | null>((best, s) => {
    if (!s.last_run_at) return best
    if (!best || s.last_run_at > best) return s.last_run_at
    return best
  }, null)
  const companyLastCheckLabel =
    latestCompanyCheckIso != null
      ? formatAgo(latestCompanyCheckIso)
      : view.companyLastCheckedLabel

  const dbDocuments = bundle?.documents ?? []
  const fetchLogs = (bundle?.fetchLogs ?? []).slice(0, 5)

  return (
    <Container>
      <header className="mb-10 flex flex-col gap-6 sm:mb-12 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4 sm:gap-5">
          <CompanyLogo
            name={view.name}
            ticker={view.ticker}
            logoUrl={view.logoUrl}
            size="lg"
            className="shadow-[0_8px_28px_rgba(12,13,17,0.06)]"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
              Company
              {view.isDbOnly ? (
                <span className="ml-2 rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-muted">
                  Inventory
                </span>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-3xl font-medium tracking-[-0.03em] text-ink sm:text-[2rem]">
                {view.name}
              </h1>
              {view.ticker ? (
                <span className="rounded-lg border border-black/[0.08] bg-white/90 px-2.5 py-1 font-mono text-[13px] font-medium tabular-nums text-ink">
                  {view.ticker}
                  {view.exchange ? (
                    <span className="ml-1.5 text-ink-subtle">· {view.exchange}</span>
                  ) : null}
                </span>
              ) : null}
            </div>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
              {view.tagline}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Button
            type="button"
            variant={watched ? 'secondary' : 'primary'}
            className="min-w-[11rem] px-5 py-2.5"
            onClick={() => toggle(view.slug)}
          >
            {watched ? 'On watchlist' : 'Watch'}
          </Button>
          {watched ? (
            <span className="text-center text-[12px] text-ink-subtle sm:text-right">
              Synced to your account when Supabase is connected.
            </span>
          ) : null}
        </div>
      </header>

      {isSupabaseConfigured() && dbError ? (
        <p
          className="mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3 text-[14px] text-rose-950"
          role="alert"
        >
          Live monitoring data couldn’t load: {dbError}. Showing profile fields only.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <h2 className="text-[15px] font-medium text-ink">Overview</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            {view.overview}
          </p>
          <p className="mt-5 rounded-xl bg-black/[0.03] px-4 py-3 text-[13px] leading-relaxed text-ink-subtle">
            AI-generated profiles will be labeled when wired to the model stack.
            Informational only — not investment advice.
          </p>
        </Card>

        <Card>
          <h2 className="text-[15px] font-medium text-ink">Monitoring</h2>
          <p className="mt-1 text-[13px] text-ink-subtle">
            Last checked (company):{' '}
            <span className="font-medium text-ink-muted">{companyLastCheckLabel}</span>
            {isSupabaseConfigured() && dbLoading ? (
              <span className="ml-2 text-[12px] text-ink-subtle">· refreshing live…</span>
            ) : null}
          </p>
          <ul className="mt-6 space-y-4">
            {view.pilotSources.map((s) => {
              const db = dbSourceByKey.get(s.id)
              const lastCheck = db ? formatAgo(db.last_run_at) : s.lastCheckedLabel
              const status = db ? mapDbStatusToUi(db.last_status) : s.status
              return (
                <li
                  key={s.id}
                  className="border-b border-black/[0.05] pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink">{s.label}</p>
                      <p className="mt-0.5 text-[12px] text-ink-subtle">
                        Last check: {lastCheck}
                        {db ? (
                          <span className="ml-1.5 text-[11px] text-ink-subtle">(live)</span>
                        ) : null}
                      </p>
                      {s.detail && !db ? (
                        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                          {s.detail}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        'mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide',
                        sourceBadgeClasses(status),
                      )}
                    >
                      {sourceBadgeLabel(status)}
                    </span>
                  </div>
                </li>
              )
            })}
            {extraDbSources.map((db) => {
              const status = mapDbStatusToUi(db.last_status)
              return (
                <li
                  key={db.id}
                  className="border-b border-black/[0.05] pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-ink">{db.label}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-subtle">
                        {db.base_url}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-subtle">
                        Last check: {formatAgo(db.last_run_at)}{' '}
                        <span className="text-[11px] text-ink-subtle">(live only)</span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        'mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide',
                        sourceBadgeClasses(status),
                      )}
                    >
                      {sourceBadgeLabel(status)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
          {view.pilotSources.length === 0 && extraDbSources.length === 0 ? (
            <p className="mt-4 text-[14px] leading-relaxed text-ink-muted">
              No sources yet. Run <span className="font-mono text-[12px]">npm run monitor:once</span>{' '}
              after adding URLs, or add a source from admin inventory.
            </p>
          ) : null}
          {fetchLogs.length > 0 ? (
            <div className="mt-6 rounded-xl bg-black/[0.03] px-3 py-3">
              <p className="text-[12px] font-medium text-ink-muted">Recent fetch attempts</p>
              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-ink-subtle">
                {fetchLogs.map((l) => (
                  <li key={l.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>{formatAgo(l.ran_at)}</span>
                    <span className="font-medium text-ink-muted">{l.status}</span>
                    <span className="min-w-0 break-all font-mono text-[10px] text-ink-subtle">
                      {l.requested_url}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-5 text-[12px] leading-relaxed text-ink-subtle">
            Blocked and errored sources stay visible — coverage should never be implied
            where we aren’t fetching.
          </p>
        </Card>
      </div>

      <CompanyResearchSection
        slug={view.slug}
        companyName={view.name}
        ticker={view.ticker}
      />

      <div className="mt-10 space-y-8">
        {isSupabaseConfigured() && dbDocuments.length > 0 ? (
          <div>
            <h2 className="text-[15px] font-medium text-ink">Live tracked URLs</h2>
            <p className="mt-1 text-[13px] text-ink-subtle">
              Rows from <span className="font-mono text-[12px]">tracked_documents</span> — open for
              hash and source link.
            </p>
            <ul className="mt-4 space-y-3">
              {dbDocuments.map((d) => (
                <li key={d.id}>
                  <Link to={`/app/updates/${d.id}`}>
                    <Card
                      padding="sm"
                      className="transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_12px_40px_rgba(12,13,17,0.08)]"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                        Tracked URL · {formatAgo(d.last_checked_at)}
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
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <h2 className="text-[15px] font-medium text-ink">
            {view.isDbOnly ? 'Bundled demo updates' : 'Pilot demo updates'}
          </h2>
          <p className="mt-1 text-[13px] text-ink-subtle">
            {view.isDbOnly
              ? 'Sample narratives exist only for bundled pilot issuers — use live tracked URLs above.'
              : 'Bundled sample narratives — distinct from live hash rows above.'}
          </p>
          {view.pilotUpdates.length === 0 ? (
            <Card className="mt-4 border-dashed border-black/[0.1] bg-white/45 shadow-none">
              <p className="text-[14px] leading-relaxed text-ink-muted">
                {view.isDbOnly
                  ? 'No bundled demos for inventory-only companies.'
                  : 'No sample documents for this issuer yet — monitoring will populate this list when new URLs appear.'}
              </p>
            </Card>
          ) : (
            <ul className="mt-4 space-y-3">
              {view.pilotUpdates.map((u) => (
                <li key={u.id}>
                  <Link to={`/app/updates/${u.id}`}>
                    <Card
                      padding="sm"
                      className="transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_12px_40px_rgba(12,13,17,0.08)]"
                    >
                      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                        {u.sourceCategoryLabel} · {u.detectedLabel}
                      </p>
                      <div className="mt-2 flex items-start justify-between gap-3">
                        <p className="text-[15px] font-medium tracking-tight text-ink">
                          {u.title}
                        </p>
                        {!isRead(u.id) ? (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent"
                            aria-label="Unread"
                          />
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink-muted">
                        {u.summary}
                      </p>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Container>
  )
}
