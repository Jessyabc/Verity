import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CompanyLogo } from '@/components/CompanyLogo'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { Field } from '@/components/ui/Field'
import { PILOT_COMPANIES } from '@/data/pilot-universe'
import { searchPilotCompanies } from '@/data/queries'

export function SearchPage() {
  const [q, setQ] = useState('')

  const results = useMemo(() => searchPilotCompanies(q), [q])

  return (
    <Container>
      <header className="mb-10 sm:mb-12">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          Search
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-ink sm:text-[2rem]">
          Pilot universe
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          {PILOT_COMPANIES.length} hand-curated companies ship in this build —
          no hosted database. Results outside this list stay empty on purpose.
        </p>
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
              hint="Matching is local only — name, ticker, or slug keywords."
            />
          </div>
          <ul className="divide-y divide-black/[0.05]" aria-label="Search results">
            {results.map((c) => (
              <li key={c.slug}>
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
                  </div>
                </Link>
              </li>
            ))}
            {results.length === 0 ? (
              <li className="px-6 py-14 text-center sm:px-8">
                <p className="text-[15px] font-medium text-ink">No match in pilot universe</p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
                  Clear the query to browse all pilot companies, or add this issuer to
                  the dataset when you expand coverage.
                </p>
              </li>
            ) : null}
          </ul>
        </Card>

        <aside className="space-y-4">
          <Card padding="sm" className="bg-white/55">
            <h2 className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
              Storage
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              Watchlists persist in <span className="text-ink">your browser</span> per
              signed-in session — no Supabase project required for this phase.
            </p>
          </Card>
          <Card padding="sm" className="border-dashed border-black/[0.1] bg-white/40 shadow-none">
            <p className="text-[13px] leading-relaxed text-ink-subtle">
              Later: swap the data layer for Postgres, SQLite, or a hosted API —
              keep these screens.
            </p>
          </Card>
        </aside>
      </div>
    </Container>
  )
}
