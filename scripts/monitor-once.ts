/**
 * Phase 3 — one-shot monitor: robots.txt gate + GET + content hash + Supabase upsert.
 * 1) Pilot entries from pilot-urls.json (upserts company + source, then checks URL).
 * 2) All other company_sources rows (SEC, admin-added, …) not already handled as pilot (slug+source_key).
 *
 * Run: npm run monitor:once
 * Requires: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY in .env
 */
import './load-env.ts'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import robotsParser from 'robots-parser'

const __dirname = dirname(fileURLToPath(import.meta.url))

function sha256Node(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim())
    u.hash = ''
    if (
      (u.protocol === 'https:' && u.port === '443') ||
      (u.protocol === 'http:' && u.port === '80')
    ) {
      u.port = ''
    }
    return u.href
  } catch {
    return raw.trim()
  }
}

type PilotEntry = {
  slug: string
  name: string
  ticker: string
  exchange: string
  tagline: string
  overview: string
  sourceKey: string
  sourceLabel: string
  url: string
}

type PilotFile = {
  userAgent: string
  entries: PilotEntry[]
}

async function fetchText(url: string, userAgent: string, signal?: AbortSignal) {
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent },
    redirect: 'follow',
    signal,
  })
  const text = await res.text()
  return { res, text }
}

function pilotPairKey(slug: string, sourceKey: string): string {
  return `${slug}\0${sourceKey}`
}

async function monitorSingleUrl(
  supabase: SupabaseClient,
  ua: string,
  params: {
    sourceId: string
    companyId: string
    canonical: string
    logLabel: string
  },
): Promise<void> {
  const { sourceId, companyId, canonical, logLabel } = params
  const origin = new URL(canonical).origin

  const robotsUrl = `${origin}/robots.txt`
  let robotsAllowed = true
  let robotsDetail: string | null = null

  try {
    const { res: robotsRes, text: robotsTxt } = await fetchText(robotsUrl, ua)
    if (!robotsRes.ok) {
      robotsAllowed = true
      robotsDetail = `robots.txt HTTP ${robotsRes.status} — proceeding (no parser block)`
    } else {
      const checker = robotsParser(robotsUrl, robotsTxt)
      robotsAllowed = checker.isAllowed(canonical, ua)
      if (!robotsAllowed) {
        robotsDetail = 'robots.txt disallows this URL for our user-agent'
      }
    }
  } catch (e) {
    robotsDetail = e instanceof Error ? e.message : String(e)
    robotsAllowed = false
  }

  if (!robotsAllowed) {
    await supabase.from('fetch_logs').insert({
      company_source_id: sourceId,
      requested_url: canonical,
      status: 'blocked_robots',
      http_status: null,
      robots_allowed: false,
      detail: robotsDetail,
      content_hash: null,
    })
    await supabase
      .from('company_sources')
      .update({
        last_status: 'blocked_robots',
        last_run_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
    console.log('blocked by robots', logLabel, canonical, robotsDetail)
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const { res, text } = await fetchText(canonical, ua, controller.signal)
    clearTimeout(timeout)
    const buf = Buffer.from(text, 'utf8')
    const hash = sha256Node(buf)

    await supabase.from('fetch_logs').insert({
      company_source_id: sourceId,
      requested_url: canonical,
      status: res.ok ? 'ok' : 'http_error',
      http_status: res.status,
      robots_allowed: true,
      detail: robotsDetail,
      content_hash: hash,
    })

    const { data: existing } = await supabase
      .from('tracked_documents')
      .select('id')
      .eq('company_id', companyId)
      .eq('canonical_url', canonical)
      .maybeSingle()

    const now = new Date().toISOString()
    if (existing?.id) {
      await supabase
        .from('tracked_documents')
        .update({
          content_hash: hash,
          last_checked_at: now,
          company_source_id: sourceId,
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('tracked_documents').insert({
        company_id: companyId,
        company_source_id: sourceId,
        canonical_url: canonical,
        content_hash: hash,
        title: null,
        first_seen_at: now,
        last_checked_at: now,
      })
    }

    await supabase
      .from('company_sources')
      .update({
        last_status: res.ok ? 'ok' : `http_${res.status}`,
        last_run_at: now,
      })
      .eq('id', sourceId)

    console.log('ok', logLabel, canonical, hash.slice(0, 12))
  } catch (e) {
    clearTimeout(timeout)
    const msg = e instanceof Error ? e.message : String(e)
    await supabase.from('fetch_logs').insert({
      company_source_id: sourceId,
      requested_url: canonical,
      status: 'error',
      http_status: null,
      robots_allowed: true,
      detail: msg,
      content_hash: null,
    })
    await supabase
      .from('company_sources')
      .update({
        last_status: 'error',
        last_run_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
    console.error('fetch error', logLabel, msg)
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    console.error(
      'Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in .env',
    )
    process.exit(1)
  }

  const raw = await readFile(join(__dirname, 'pilot-urls.json'), 'utf-8')
  const pilot = JSON.parse(raw) as PilotFile
  const ua = pilot.userAgent

  const supabase = createClient(supabaseUrl.trim(), serviceKey.trim())

  const pilotKeys = new Set(
    pilot.entries.map((e) => pilotPairKey(e.slug, e.sourceKey)),
  )

  console.log('— Pilot JSON entries:', pilot.entries.length)
  for (const entry of pilot.entries) {
    const canonical = normalizeUrl(entry.url)

    const { data: companyRow, error: companyErr } = await supabase
      .from('companies')
      .upsert(
        {
          slug: entry.slug,
          name: entry.name,
          ticker: entry.ticker,
          exchange: entry.exchange,
          tagline: entry.tagline,
          overview: entry.overview,
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single()

    if (companyErr || !companyRow) {
      console.error('company upsert', entry.slug, companyErr)
      continue
    }
    const companyId = companyRow.id as string

    const { data: sourceRow, error: sourceErr } = await supabase
      .from('company_sources')
      .upsert(
        {
          company_id: companyId,
          source_key: entry.sourceKey,
          label: entry.sourceLabel,
          base_url: canonical,
          last_run_at: new Date().toISOString(),
          last_status: 'running',
        },
        { onConflict: 'company_id,source_key' },
      )
      .select('id')
      .single()

    if (sourceErr || !sourceRow) {
      console.error('source upsert', entry.slug, sourceErr)
      continue
    }
    const sourceId = sourceRow.id as string

    await monitorSingleUrl(supabase, ua, {
      sourceId,
      companyId,
      canonical,
      logLabel: entry.slug,
    })
  }

  const { data: allSources, error: srcListErr } = await supabase
    .from('company_sources')
    .select('id, source_key, base_url, company_id')

  if (srcListErr) {
    console.error('list company_sources', srcListErr)
    process.exit(1)
  }

  const rows = allSources ?? []
  const companyIds = [...new Set(rows.map((r) => r.company_id as string))]
  const slugByCompanyId = new Map<string, string>()

  if (companyIds.length > 0) {
    const { data: cos, error: cErr } = await supabase
      .from('companies')
      .select('id, slug')
      .in('id', companyIds)

    if (cErr) {
      console.error('list companies for sources', cErr)
      process.exit(1)
    }
    for (const c of cos ?? []) {
      slugByCompanyId.set(c.id as string, c.slug as string)
    }
  }

  let extra = 0
  for (const s of rows) {
    const slug = slugByCompanyId.get(s.company_id as string)
    if (!slug) continue
    const key = pilotPairKey(slug, s.source_key as string)
    if (pilotKeys.has(key)) continue

    const canonical = normalizeUrl(s.base_url as string)
    extra++
    console.log('— DB source', slug, s.source_key, canonical)
    await monitorSingleUrl(supabase, ua, {
      sourceId: s.id as string,
      companyId: s.company_id as string,
      canonical,
      logLabel: `${slug}/${s.source_key}`,
    })
  }

  console.log('Done. Pilot:', pilot.entries.length, '· Extra DB sources checked:', extra)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
