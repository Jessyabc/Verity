import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { Field } from '@/components/ui/Field'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { messageFromFunctionsInvokeFailure } from '@/lib/supabase/edgeFunctionError'

export function AdminInventoryPage() {
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [exchange, setExchange] = useState('')
  const [tagline, setTagline] = useState('')
  const [overview, setOverview] = useState('')
  const [sourceKey, setSourceKey] = useState('primary')
  const [sourceLabel, setSourceLabel] = useState('Primary URL')
  const [baseUrl, setBaseUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [exSlug, setExSlug] = useState('')
  const [exSourceKey, setExSourceKey] = useState('ir')
  const [exSourceLabel, setExSourceLabel] = useState('Investor relations')
  const [exBaseUrl, setExBaseUrl] = useState('')
  const [exBusy, setExBusy] = useState(false)
  const [exMessage, setExMessage] = useState<string | null>(null)
  const [exError, setExError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured()) {
      setError('Supabase is not configured.')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const sb = getSupabaseBrowserClient()
      const { data, error: fnErr, response } = await sb.functions.invoke<{
        ok?: boolean
        slug?: string
        error?: string
      }>('admin-upsert-company', {
        body: {
          slug: slug.trim().toLowerCase(),
          name: name.trim(),
          ticker: ticker.trim() || null,
          exchange: exchange.trim() || null,
          tagline: tagline.trim() || null,
          overview: overview.trim() || null,
          sourceKey: sourceKey.trim(),
          sourceLabel: sourceLabel.trim(),
          baseUrl: baseUrl.trim(),
        },
      })
      if (fnErr) {
        const msg = await messageFromFunctionsInvokeFailure(fnErr, response)
        throw new Error(msg)
      }
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String(data.error))
      }
      setMessage(`Saved “${data?.slug ?? slug}”. Run monitor (local or GitHub) to fetch the URL.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onAddSourceOnly(e: React.FormEvent) {
    e.preventDefault()
    if (!isSupabaseConfigured()) {
      setExError('Supabase is not configured.')
      return
    }
    setExBusy(true)
    setExError(null)
    setExMessage(null)
    try {
      const sb = getSupabaseBrowserClient()
      const { data, error: fnErr, response } = await sb.functions.invoke<{
        ok?: boolean
        slug?: string
        error?: string
      }>('admin-upsert-company', {
        body: {
          mode: 'add_source_only',
          slug: exSlug.trim().toLowerCase(),
          sourceKey: exSourceKey.trim(),
          sourceLabel: exSourceLabel.trim(),
          baseUrl: exBaseUrl.trim(),
        },
      })
      if (fnErr) {
        const msg = await messageFromFunctionsInvokeFailure(fnErr, response)
        throw new Error(msg)
      }
      if (data && typeof data === 'object' && 'error' in data && data.error) {
        throw new Error(String(data.error))
      }
      setExMessage(
        `Attached source to “${data?.slug ?? exSlug}”. Schedule or run monitor:once to pull the page.`,
      )
    } catch (err) {
      setExError(err instanceof Error ? err.message : String(err))
    } finally {
      setExBusy(false)
    }
  }

  return (
    <Container className="max-w-xl space-y-10">
      <header>
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          Admin
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.03em] text-ink sm:text-[2rem]">
          Inventory
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
          New companies need a monitor URL. SEC imports (<span className="font-mono text-[12px]">cik-*</span>)
          already exist — use the second form to attach IR without re-entering the legal name.
        </p>
      </header>

      <Card className="p-6 sm:p-8">
        <h2 className="text-[16px] font-medium text-ink">New company + source</h2>
        <p className="mt-1 text-[13px] text-ink-subtle">
          Creates or updates <span className="font-mono text-[12px]">companies</span> and one source row.
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-5">
          <Field
            label="Slug"
            hint="Lowercase, hyphens only (e.g. acme-corp)."
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="acme-corp"
            required
            className="border-divider bg-surface-solid/80"
          />
          <Field
            label="Legal / display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border-divider bg-surface-solid/80"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="ACME"
              className="border-divider bg-surface-solid/80"
            />
            <Field
              label="Exchange"
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              placeholder="NYSE"
              className="border-divider bg-surface-solid/80"
            />
          </div>
          <Field
            label="Tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="border-divider bg-surface-solid/80"
          />
          <div className="space-y-2">
            <label
              htmlFor="admin-overview"
              className="block text-[13px] font-medium tracking-tight text-ink-muted"
            >
              Overview
            </label>
            <textarea
              id="admin-overview"
              value={overview}
              onChange={(e) => setOverview(e.target.value)}
              rows={4}
              placeholder="Longer description for the profile card."
              className="input-field border-divider bg-surface-solid/90"
            />
          </div>
          <div className="border-t border-divider pt-5">
            <p className="mb-3 text-[13px] font-medium text-ink">Monitor source</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Source key"
                value={sourceKey}
                onChange={(e) => setSourceKey(e.target.value)}
                hint="Stable id, e.g. ir, sec"
                className="border-divider bg-surface-solid/80"
              />
              <Field
                label="Source label"
                value={sourceLabel}
                onChange={(e) => setSourceLabel(e.target.value)}
                className="border-divider bg-surface-solid/80"
              />
            </div>
            <Field
              label="Base URL"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://investor.example.com/"
              required
              className="mt-4 border-divider bg-surface-solid/80"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-danger-hairline bg-danger-soft px-3 py-2 text-[14px] text-danger">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-[14px] text-emerald-950">
              {message}{' '}
              <Link
                className="font-medium underline underline-offset-2"
                to={slug.trim() ? `/app/company/${slug.trim().toLowerCase()}` : '/app/search'}
              >
                View profile
              </Link>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save to inventory'}
            </Button>
            <Button type="button" variant="secondary" asChild>
              <Link to="/app/search">Back to search</Link>
            </Button>
          </div>
        </form>
      </Card>

      <Card className="border-dashed border-stroke bg-surface p-6 sm:p-8 dark:bg-white/[0.04]">
        <h2 className="text-[16px] font-medium text-ink">Add monitor URL to existing slug</h2>
        <p className="mt-1 text-[13px] text-ink-subtle">
          For <span className="font-mono text-[12px]">cik-*</span> SEC rows (or any company already in{' '}
          <span className="font-mono text-[12px]">companies</span>). Redeploy{' '}
          <span className="font-mono text-[12px]">admin-upsert-company</span> after pulling latest code.
        </p>
        <form onSubmit={(e) => void onAddSourceOnly(e)} className="mt-6 space-y-5">
          <Field
            label="Existing slug"
            value={exSlug}
            onChange={(e) => setExSlug(e.target.value)}
            placeholder="cik-320193"
            required
            className="border-divider bg-surface-solid/80"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Source key"
              value={exSourceKey}
              onChange={(e) => setExSourceKey(e.target.value)}
              className="border-divider bg-surface-solid/80"
            />
            <Field
              label="Source label"
              value={exSourceLabel}
              onChange={(e) => setExSourceLabel(e.target.value)}
              className="border-divider bg-surface-solid/80"
            />
          </div>
          <Field
            label="Base URL"
            value={exBaseUrl}
            onChange={(e) => setExBaseUrl(e.target.value)}
            placeholder="https://investor.apple.com/"
            required
            className="border-divider bg-surface-solid/80"
          />

          {exError ? (
            <p className="rounded-xl border border-danger-hairline bg-danger-soft px-3 py-2 text-[14px] text-danger">
              {exError}
            </p>
          ) : null}
          {exMessage ? (
            <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-[14px] text-emerald-950">
              {exMessage}{' '}
              <Link
                className="font-medium underline underline-offset-2"
                to={exSlug.trim() ? `/app/company/${exSlug.trim().toLowerCase()}` : '/app/search'}
              >
                Open profile
              </Link>
            </p>
          ) : null}

          <Button type="submit" variant="secondary" disabled={exBusy}>
            {exBusy ? 'Saving…' : 'Attach source only'}
          </Button>
        </form>
      </Card>
    </Container>
  )
}
