import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CompanyLogo } from '@/components/CompanyLogo'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { Field } from '@/components/ui/Field'
import { PILOT_COMPANIES } from '@/data/pilot-universe'
import { searchPilotCompanies } from '@/data/queries'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import type { DbCompany } from '@/lib/supabase/monitoringTypes'
import { fetchCompaniesForSearch } from '@/lib/supabase/monitoringQueries'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export function SearchPage() {
  const [q, setQ] = useState('')
  const [dbCompanies, setDbCompanies] = useState<DbCompany[]>([])
  const [dbLoading, setDbLoading] = useState(false)
  const [dbError, setDbError] = useState<string | null>(null)
  const isAdmin = useIsAdmin()

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!isSupabaseConfigured()) {
        setDbCompanies([])
        setDbError(null)
        setDbLoading(false)
        return
      }
      setDbLoading(true)
      setDbError(null)
      void fetchCompaniesForSearch(q)
        .then((rows) => {
          if (!cancelled) setDbCompanies(rows)
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setDbCompanies([])
            setDbError(e instanceof Error ? e.message : String(e))
          }
        })
        .finally(() => {
          if (!cancelled) setDbLoading(false)
        })
    })
    return () => {
      cancelled = true
    }
  }, [q])

  const { pilotRows, inventoryRows } = useMemo(() => {
    const pilot = searchPilotCompanies(q)
    const pilotSlugs = new Set(pilot.map((c) => c.slug))
    const inventory = dbCompanies.filter((c) => !pilotSlugs.has(c.slug))
    return { pilotRows: pilot, inventoryRows: inventory }
  }, [q, dbCompanies])

  const totalCount = pilotRows.length + inventoryRows.length

  return (
    <Container>
      <header className="mb-10 sm:mb-12">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          Search
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-ink sm:text-[2rem]">
          Companies
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          {PILOT_COMPANIES.length} bundled pilot issuers
          {isSupabaseConfigured()
            ? ' plus your Supabase directory (pilot + admin + optional SEC import). Search by name, ticker, CIK slug, or browse the latest rows when the box is empty.'
            : ' — connect Supabase to search the database directory.'}
        </p>
        {isAdmin ? (
          <p className="mt-3 text-[14px] text-ink-muted">
            <Link
              to="/app/admin/inventory"
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              Add a company (admin)
            </Link>
          </p>
        ) : null}
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
        <Card className="overflow-hidden p-0 sm:p-0">
          <div className="border-b border-black/[0.06] p-6 sm:p-8 sm:pb-6">
            <Field
              label="Company or ticker"
              placeholder="Try Microsoft, MSFT, Apple…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="border-black/[0.06] bg-white/80"
              hint="Pilot list filters locally; inventory uses server search (apply latest SQL migration + npm run import:sec-tickers for US SEC names)."
            />
            {isSupabaseConfigured() && dbLoading ? (
              <p className="mt-2 text-[12px] text-ink-subtle">Loading inventory…</p>
            ) : null}
            {dbError ? (
              <p className="mt-2 text-[12px] text-danger" role="alert">
                Inventory search failed: {dbError}
              </p>
            ) : null}
          </div>
          <ul className="divide-y divide-black/[0.05]" aria-label="Search results">
            {pilotRows.map((c) => (
              <li key={`pilot-${c.slug}`}>
                <Link
                  to={`/app/company/${c.slug}`}
                  className="group flex items-start gap-4 px-6 py-5 transition-colors hover:bg-white/60 sm:px-8"
                >
                  <CompanyLogo
                    name={c.name}
                    ticker={c.ticker}
                    logoUrl={c.logoUrl}
                    size="md"
                    className="shadow-[0_6px_20px_rgba(12,13,17,0.05)]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium tracking-tight text-ink group-hover:text-accent">
                      {c.name}
                    </span>
                    <span className="text-[14px] leading-relaxed text-ink-muted">
                      {c.tagline}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                    {c.ticker ? (
                      <span className="rounded-lg border border-black/[0.06] bg-white/80 px-2.5 py-1 font-mono text-[12px] font-medium tabular-nums text-ink">
                        {c.ticker}
                      </span>
                    ) : (
                      <span className="text-[12px] text-ink-subtle">—</span>
                    )}
                    {c.exchange ? (
                      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                        {c.exchange}
                      </span>
                    ) : null}
                    <span className="text-[10px] font-medium uppercase text-ink-subtle">Pilot</span>
                  </div>
                </Link>
              </li>
            ))}
            {inventoryRows.map((c) => (
              <li key={`inv-${c.slug}`}>
                <Link
                  to={`/app/company/${c.slug}`}
                  className="group flex items-start gap-4 px-6 py-5 transition-colors hover:bg-white/60 sm:px-8"
                >
                  <CompanyLogo
                    name={c.name}
                    ticker={c.ticker}
                    size="md"
                    className="shadow-[0_6px_20px_rgba(12,13,17,0.05)]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium tracking-tight text-ink group-hover:text-accent">
                      {c.name}
                    </span>
                    <span className="text-[14px] leading-relaxed text-ink-muted">
                      {c.tagline ?? '—'}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                    {c.ticker ? (
                      <span className="rounded-lg border border-black/[0.06] bg-white/80 px-2.5 py-1 font-mono text-[12px] font-medium tabular-nums text-ink">
                        {c.ticker}
                      </span>
                    ) : (
                      <span className="text-[12px] text-ink-subtle">—</span>
                    )}
                    {c.exchange ? (
                      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">
                        {c.exchange}
                      </span>
                    ) : null}
                    <span className="text-[10px] font-medium uppercase text-accent">
                      {c.universe_source === 'sec' ? 'SEC' : 'Inventory'}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
            {totalCount === 0 ? (
              <li className="px-6 py-14 text-center sm:px-8">
                <p className="text-[15px] font-medium text-ink">No matches</p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
                  Try another query, or add an issuer to inventory (admin) / pilot dataset.
                </p>
              </li>
            ) : null}
          </ul>
        </Card>

        <aside className="space-y-4">
          <Card padding="sm" className="bg-white/55">
            <h2 className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
              Coverage
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              Pilot issuers ship in the bundle. Load thousands of US SEC filers with{' '}
              <span className="font-mono text-[12px]">npm run import:sec-tickers</span> (service role
              + <span className="font-mono text-[12px]">SEC_USER_AGENT</span> in{' '}
              <span className="font-mono text-[12px]">.env.local</span>).
            </p>
          </Card>
          <Card padding="sm" className="border-dashed border-black/[0.1] bg-white/40 shadow-none">
            <p className="text-[13px] leading-relaxed text-ink-subtle">
              Monitoring runs via <span className="font-mono text-[12px]">monitor:once</span> and
              GitHub Actions once sources exist.
            </p>
          </Card>
        </aside>
      </div>
    </Container>
  )
}
