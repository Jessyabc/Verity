/**
 * Phase 3 — one-shot monitor: robots.txt gate + GET + content hash + Supabase upsert.
 * Run: npm run monitor:once
 * Requires: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY in .env
 */
import './load-env.ts'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'
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

async function main() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
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

  for (const entry of pilot.entries) {
    const canonical = normalizeUrl(entry.url)
    const origin = new URL(canonical).origin

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
    const companyId = companyRow.id

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
    const sourceId = sourceRow.id

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
      console.log('blocked by robots', canonical, robotsDetail)
      continue
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

      console.log('ok', entry.slug, canonical, hash.slice(0, 12))
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
      console.error('fetch error', entry.slug, msg)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
