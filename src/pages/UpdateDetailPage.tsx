import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { getUpdateById } from '@/data/queries'
import { useReadUpdates } from '@/hooks/useReadUpdates'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { isUuidParam } from '@/lib/supabase/monitoringQueries'
import { TrackedDocumentDetailPage } from '@/pages/TrackedDocumentDetailPage'

export function UpdateDetailPage() {
  const { id } = useParams()
  const { markRead } = useReadUpdates()
  const found = getUpdateById(id)

  useEffect(() => {
    if (!id || !found) return
    if (isUuidParam(id) && isSupabaseConfigured()) return
    markRead(id)
  }, [found, id, markRead])

  if (id && isUuidParam(id) && isSupabaseConfigured()) {
    return <TrackedDocumentDetailPage id={id} />
  }

  if (id && isUuidParam(id) && !isSupabaseConfigured()) {
    return (
      <Container className="max-w-3xl">
        <p className="text-[13px] text-ink-subtle">
          <Link to="/app/watchlist" className="text-ink-muted hover:text-ink">
            Watchlist
          </Link>
        </p>
        <header className="mt-6">
          <h1 className="text-2xl font-medium tracking-[-0.03em] text-ink">
            Live document link
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            This URL looks like a database id. Add Supabase env keys to open live{' '}
            <span className="font-mono text-[13px]">tracked_documents</span>, or use a pilot
            demo id from search.
          </p>
        </header>
      </Container>
    )
  }

  if (!found) {
    return (
      <Container className="max-w-3xl">
        <p className="text-[13px] text-ink-subtle">
          <Link to="/app/watchlist" className="text-ink-muted hover:text-ink">
            Watchlist
          </Link>
        </p>
        <header className="mt-6">
          <h1 className="text-2xl font-medium tracking-[-0.03em] text-ink">
            Update not found
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            This id isn’t in the bundled pilot updates. Check the URL or pick a document from a
            company profile.
          </p>
        </header>
        <Card className="mt-8">
          <Link
            to="/app/search"
            className="text-[14px] font-medium text-accent underline decoration-accent/35 underline-offset-2"
          >
            Search pilot companies
          </Link>
        </Card>
      </Container>
    )
  }

  const { company, update } = found

  return (
    <Container className="max-w-3xl">
      <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-subtle">
        <Link to="/app/watchlist" className="text-ink-muted hover:text-ink">
          Watchlist
        </Link>
        <span aria-hidden>/</span>
        <Link
          to={`/app/company/${company.slug}`}
          className="text-ink-muted hover:text-ink"
        >
          {company.name}
        </Link>
        <span aria-hidden>/</span>
        <span className="text-ink">Update</span>
      </nav>

      <header className="mt-6">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          {update.sourceCategoryLabel} · {update.detectedLabel}
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-ink sm:text-[2rem]">
          {update.title}
        </h1>
        <p className="mt-2 text-[14px] text-ink-subtle">
          Id <span className="font-mono text-[13px] text-ink-muted">{update.id}</span>
        </p>
      </header>

      <div className="mt-8 space-y-6">
        <Card>
          <h2 className="text-[15px] font-medium text-ink">Summary</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            {update.summary}
          </p>
        </Card>

        <Card>
          <h2 className="text-[15px] font-medium text-ink">Possible lenses</h2>
          <p className="mt-1 text-[13px] text-ink-subtle">
            Questions a researcher might explore — not causes of stock moves.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-muted">
            {update.lenses.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Card>

        <Card className="bg-white/60">
          <h2 className="text-[15px] font-medium text-ink">Sources</h2>
          <ul className="mt-3 space-y-2.5 text-[14px]">
            {update.sources.map((s) => (
              <li key={s.url}>
                <a
                  className="font-medium text-accent underline decoration-accent/35 underline-offset-2"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <p className="text-[12px] leading-relaxed text-ink-subtle">
          Informational only. AI output may be incomplete; verify against the original filing.
        </p>
      </div>
    </Container>
  )
}
