/**
 * Refresh research for:
 * - ALL_PILOT=1: all pilot companies
 * - WATCHLIST_FROM_DB=true: distinct slugs from `user_watchlist` (falls back to WATCHLIST_SLUGS if empty)
 * - else: WATCHLIST_SLUGS (comma-separated)
 *
 * Respects weekend skip unless WEEKEND_RESEARCH=true (for Sat/Sun cron jobs).
 *
 * Run: npm run research:watchlist
 */
import './load-env.ts'
import { createClient } from '@supabase/supabase-js'
import { getPilotCompanyBySlug, PILOT_COMPANIES } from '../src/data/pilot-universe.ts'
import { fetchCompanyResearchFromPerplexity } from './lib/research-perplexity.ts'

function parseCommaSlugs(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const day = new Date().getUTCDay()
  const isWeekend = day === 0 || day === 6
  const allowWeekend = process.env.WEEKEND_RESEARCH === 'true'
  if (isWeekend && !allowWeekend) {
    console.log('Skipping: weekend (set WEEKEND_RESEARCH=true for weekend cron).')
    return
  }

  const supabase = createClient(supabaseUrl.trim(), serviceKey.trim())

  let slugs: string[]

  if (process.env.ALL_PILOT === '1') {
    slugs = PILOT_COMPANIES.map((c) => c.slug)
  } else if (
    process.env.WATCHLIST_FROM_DB === '1' ||
    process.env.WATCHLIST_FROM_DB === 'true'
  ) {
    const { data, error } = await supabase
      .from('user_watchlist')
      .select('company_slug')
    if (error) throw error
    slugs = [
      ...new Set((data ?? []).map((r) => r.company_slug as string)),
    ]
    if (slugs.length === 0) {
      slugs = parseCommaSlugs(process.env.WATCHLIST_SLUGS ?? '')
    }
  } else {
    slugs = parseCommaSlugs(process.env.WATCHLIST_SLUGS ?? '')
  }

  if (slugs.length === 0) {
    console.error(
      'Set WATCHLIST_SLUGS=slug1,slug2, ALL_PILOT=1, or WATCHLIST_FROM_DB=true (with rows in user_watchlist or WATCHLIST_SLUGS fallback).',
    )
    process.exit(1)
  }

  for (const slug of slugs) {
    const pilot = getPilotCompanyBySlug(slug)
    let slugOut: string
    let companyName: string
    let ticker: string | null

    if (pilot) {
      slugOut = pilot.slug
      companyName = pilot.name
      ticker = pilot.ticker
    } else {
      const { data: row, error: rowErr } = await supabase
        .from('companies')
        .select('slug,name,ticker')
        .eq('slug', slug)
        .maybeSingle()
      if (rowErr || !row) {
        console.warn('Unknown slug (not in pilot or companies), skip:', slug)
        continue
      }
      slugOut = row.slug as string
      companyName = row.name as string
      ticker = (row.ticker as string | null) ?? null
    }

    try {
      console.log('—', slugOut, companyName)
      const { items, model } = await fetchCompanyResearchFromPerplexity(
        companyName,
        ticker,
      )
      const { error } = await supabase.from('company_research_cache').upsert(
        {
          slug: slugOut,
          company_name: companyName,
          ticker,
          items,
          fetched_at: new Date().toISOString(),
          error: null,
          model,
        },
        { onConflict: 'slug' },
      )
      if (error) throw error
      console.log('  ok', items.length, 'items')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('  error', msg)
      await supabase.from('company_research_cache').upsert(
        {
          slug: slugOut,
          company_name: companyName,
          ticker,
          items: [],
          fetched_at: new Date().toISOString(),
          error: msg.slice(0, 2000),
          model: null,
        },
        { onConflict: 'slug' },
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
