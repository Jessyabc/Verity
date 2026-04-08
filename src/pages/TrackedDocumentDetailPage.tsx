import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { useReadUpdates } from '@/hooks/useReadUpdates'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import {
  fetchTrackedDocumentWithCompany,
  formatAgo,
  shortDocumentTitle,
} from '@/lib/supabase/monitoringQueries'
import type { DbCompany, DbTrackedDocument } from '@/lib/supabase/monitoringTypes'

function asLenses(v: DbTrackedDocument['lenses_json']): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

export function TrackedDocumentDetailPage({ id }: { id: string }) {
  const { markRead } = useReadUpdates()
  const configured = isSupabaseConfigured()
  const [loading, setLoading] = useState(configured)
  const [error, setError] = useState<string | null>(null)
  const [doc, setDoc] = useState<DbTrackedDocument | null>(null)
  const [company, setCompany] = useState<DbCompany | null>(null)

  useEffect(() => {
    if (!configured) return

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setDoc(null)
      setCompany(null)
      setLoading(true)
      setError(null)

      void fetchTrackedDocumentWithCompany(id)
        .then((row) => {
          if (cancelled) return
          if (!row) {
            setDoc(null)
            setCompany(null)
            setLoading(false)
            return
          }
          setDoc(row.document)
          setCompany(row.company)
          setLoading(false)
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : String(e))
            setLoading(false)
          }
        })
    })

    return () => {
      cancelled = true
    }
  }, [id, configured])

  useEffect(() => {
    if (doc?.id) markRead(doc.id)
  }, [doc?.id, markRead])

  if (!configured) {
    return (
      <Container className="max-w-3xl">
        <p className="text-[13px] text-ink-subtle">
          <Link to="/app/watchlist" className="text-ink-muted hover:text-ink">
            Watchlist
          </Link>
        </p>
        <header className="mt-6">
          <h1 className="text-2xl font-medium tracking-[-0.03em] text-ink">
            Supabase not configured
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            Add <span className="font-mono text-[13px]">VITE_SUPABASE_*</span> keys to load live
            tracked documents.
          </p>
        </header>
      </Container>
    )
  }

  if (loading) {
    return (
      <Container className="max-w-3xl py-16">
        <p className="text-[15px] text-ink-muted" role="status">
          Loading document…
        </p>
      </Container>
    )
  }

  if (error) {
    return (
      <Container className="max-w-3xl">
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      </Container>
    )
  }

  if (!doc || !company) {
    return (
      <Container className="max-w-3xl">
        <p className="text-[13px] text-ink-subtle">
          <Link to="/app/watchlist" className="text-ink-muted hover:text-ink">
            Watchlist
          </Link>
        </p>
        <header className="mt-6">
          <h1 className="text-2xl font-medium tracking-[-0.03em] text-ink">
            Document not found
          </h1>
          <p className="mt-2 text-[15px] text-ink-muted">
            No row in <span className="font-mono text-[13px]">tracked_documents</span> for this
            id. Run <span className="font-mono text-[13px]">npm run monitor:once</span> after
            applying migrations.
          </p>
        </header>
      </Container>
    )
  }

  const title = shortDocumentTitle(doc)
  const lenses = asLenses(doc.lenses_json)
  const hasEnrichment = Boolean(doc.summary_text?.trim()) || lenses.length > 0

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
        <span className="text-ink">Live document</span>
      </nav>

      <header className="mt-6">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          Tracked URL · content hash
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-ink sm:text-[2rem]">
          {title}
        </h1>
        <p className="mt-2 text-[14px] text-ink-subtle">
          First seen {formatAgo(doc.first_seen_at)} · Last checked{' '}
          {formatAgo(doc.last_checked_at)}
        </p>
        {doc.enrichment_model ? (
          <p className="mt-1 text-[12px] text-ink-subtle">
            Enrichment: {doc.enrichment_model}
            {doc.enrichment_method ? ` · ${doc.enrichment_method}` : null}
            {doc.enriched_at ? ` · ${formatAgo(doc.enriched_at)}` : null}
          </p>
        ) : null}
      </header>

      <div className="mt-8 space-y-6">
        {doc.enrichment_status === 'error' && doc.enrichment_detail ? (
          <Card className="border-danger-hairline bg-danger-soft">
            <h2 className="text-[15px] font-medium text-danger">Enrichment error</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-danger">{doc.enrichment_detail}</p>
          </Card>
        ) : null}

        {hasEnrichment ? (
          <>
            <Card>
              <h2 className="text-[15px] font-medium text-ink">Summary</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                {doc.summary_text?.trim() || '—'}
              </p>
            </Card>
            <Card>
              <h2 className="text-[15px] font-medium text-ink">Possible lenses</h2>
              <p className="mt-1 text-[13px] text-ink-subtle">
                Research questions — not trading advice.
              </p>
              {lenses.length > 0 ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-muted">
                  {lenses.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-[14px] text-ink-muted">No lenses returned.</p>
              )}
            </Card>
          </>
        ) : null}

        <Card>
          <h2 className="text-[15px] font-medium text-ink">What we detected</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
            New or updated URL in the monitored set (V1: URL identity + optional SHA-256 of
            fetched body — not semantic HTML diff).
          </p>
          {doc.content_hash ? (
            <p className="mt-3 font-mono text-[12px] text-ink-subtle">
              SHA-256: {doc.content_hash}
            </p>
          ) : null}
        </Card>

        {!hasEnrichment ? (
          <Card>
            <h2 className="text-[15px] font-medium text-ink">Enrichment</h2>
            <p className="mt-1 text-[13px] text-ink-subtle">
              Run <span className="font-mono text-[12px]">npm run enrich:once</span> with{' '}
              <span className="font-mono text-[12px]">OPENAI_API_KEY</span> after applying the latest
              migration — PDFs use OpenAI Responses + native PDF (no LlamaParse).
            </p>
          </Card>
        ) : null}

        <Card className="bg-surface">
          <h2 className="text-[15px] font-medium text-ink">Source</h2>
          <a
            className="mt-3 inline-block font-medium text-accent underline decoration-accent/35 underline-offset-2"
            href={doc.canonical_url}
            target="_blank"
            rel="noreferrer"
          >
            Open primary URL
          </a>
        </Card>

        <p className="text-[12px] leading-relaxed text-ink-subtle">
          Informational only. Verify against the original page or PDF.
        </p>
      </div>
    </Container>
  )
}
