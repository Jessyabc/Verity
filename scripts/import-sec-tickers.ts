/**
 * Import US SEC registrants from company_tickers.json into public.companies.
 * Stable slug: cik-{cik} (e.g. cik-320193). Run after migration 20260407140000.
 *
 * SEC fair access: set SEC_USER_AGENT to identify your app + contact (required).
 * https://www.sec.gov/os/accessing-edgar-data
 *
 * Run: npm run import:sec-tickers
 * Optional:
 *   SEC_IMPORT_LIMIT=500 — cap rows
 *   SEC_IMPORT_OFFSET=6250 — skip first N raw SEC rows after a failed run (idempotent upsert)
 *   SEC_IMPORT_BATCH_SIZE=80 — smaller batches if Supabase closes long requests
 *   SEC_IMPORT_PAUSE_MS=200 — pause between batches
 */
import './load-env.ts'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SEC_URL = 'https://www.sec.gov/files/company_tickers.json'

type SecRow = { cik_str: number; ticker: string; title: string }

type CompanyUpsertRow = Record<string, unknown>

/** SEC file can list the same CIK twice; one upsert must not contain duplicate slug/cik. */
function dedupeBatchByCik(batch: SecRow[]): SecRow[] {
  const m = new Map<string, SecRow>()
  for (const e of batch) {
    m.set(String(e.cik_str), e)
  }
  return [...m.values()]
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name]?.trim()
  if (!v) return fallback
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

async function upsertBatchWithRetry(
  supabase: SupabaseClient,
  rows: CompanyUpsertRow[],
  maxAttempts = 6,
): Promise<void> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { error } = await supabase.from('companies').upsert(rows, { onConflict: 'slug' })
    if (!error) return

    lastErr = error
    const isNetwork =
      String(error.message ?? '').includes('fetch failed') ||
      String((error as { details?: string }).details ?? '').includes('fetch failed') ||
      String((error as { details?: string }).details ?? '').includes('Socket')

    if (attempt === maxAttempts || !isNetwork) {
      throw error
    }

    const backoff = Math.min(8000, 500 * 2 ** (attempt - 1))
    await sleep(backoff)
  }
  throw lastErr
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const ua = process.env.SEC_USER_AGENT?.trim()
  if (!ua) {
    console.error(
      'Set SEC_USER_AGENT in .env (e.g. "VerityMonitor/1.0 (you@example.com)") per SEC policy.',
    )
    process.exit(1)
  }

  const maxRows = envInt('SEC_IMPORT_LIMIT', 0)
  const skip = envInt('SEC_IMPORT_OFFSET', 0)
  const batchSize = Math.max(20, Math.min(300, envInt('SEC_IMPORT_BATCH_SIZE', 80)))
  const pauseMs = envInt('SEC_IMPORT_PAUSE_MS', 200)

  const res = await fetch(SEC_URL, {
    headers: { 'User-Agent': ua, Accept: 'application/json' },
  })
  if (!res.ok) {
    console.error('SEC fetch failed', res.status, await res.text())
    process.exit(1)
  }

  const json = (await res.json()) as Record<string, SecRow>
  const entries = Object.values(json).filter(
    (e) => e && typeof e.cik_str === 'number' && e.ticker && e.title,
  )

  let slice = Number.isFinite(maxRows) && maxRows > 0 ? entries.slice(0, maxRows) : entries
  if (skip > 0) {
    console.log('Skipping first', skip, 'rows (SEC_IMPORT_OFFSET).')
    slice = slice.slice(skip)
  }

  console.log(
    'Upserting',
    slice.length,
    'rows into companies (batch',
    batchSize,
    ', pause',
    pauseMs,
    'ms)…',
  )

  const supabase = createClient(supabaseUrl.trim(), serviceKey.trim())

  for (let i = 0; i < slice.length; i += batchSize) {
    const rawBatch = slice.slice(i, i + batchSize)
    const batch = dedupeBatchByCik(rawBatch)
    const rows: CompanyUpsertRow[] = batch.map((e) => {
      const cik = String(e.cik_str)
      return {
        slug: `cik-${cik}`,
        name: e.title.trim(),
        ticker: e.ticker.trim().toUpperCase(),
        exchange: null,
        tagline: 'SEC registrant — add IR/monitoring sources when ready.',
        overview:
          'Imported from SEC company tickers. Use Admin inventory to attach a primary URL, then run monitor:once for this issuer.',
        cik,
        universe_source: 'sec',
      }
    })

    try {
      await upsertBatchWithRetry(supabase, rows)
    } catch (err) {
      console.error('\nUpsert failed at slice offset', i, '(absolute file row ~', skip + i, ')')
      console.error(err)
      console.error(
        '\nRe-run with: SEC_IMPORT_OFFSET=' +
          (skip + i) +
          ' npm run import:sec-tickers\n(or lower SEC_IMPORT_BATCH_SIZE / raise SEC_IMPORT_PAUSE_MS)',
      )
      process.exit(1)
    }

    const progressed = Math.min(i + rawBatch.length, slice.length)
    process.stdout.write(`\r  ${progressed}/${slice.length}`)
    if (i + batchSize < slice.length && pauseMs > 0) {
      await sleep(pauseMs)
    }
  }
  console.log('\nDone. Apply search_companies migration if you have not, then search the app by name or ticker.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
