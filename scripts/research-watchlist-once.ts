/**
 * Refresh research for slugs in WATCHLIST_SLUGS (comma-separated) or all pilot companies if ALL_PILOT=1.
 * Respects weekend skip unless WEEKEND_RESEARCH=true (for Sat/Sun cron jobs).
 *
 * Run: npm run research:watchlist
 */
import './load-env.ts'
import { createClient } from '@supabase/supabase-js'
import { getPilotCompanyBySlug, PILOT_COMPANIES } from '../src/data/pilot-universe.ts'
import { fetchCompanyResearchFromPerplexity } from './lib/research-perplexity.ts'

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

  let slugs: string[]
  if (process.env.ALL_PILOT === '1') {
    slugs = PILOT_COMPANIES.map((c) => c.slug)
  } else {
    const raw = process.env.WATCHLIST_SLUGS ?? ''
    slugs = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  if (slugs.length === 0) {
    console.error(
      'Set WATCHLIST_SLUGS=slug1,slug2 or ALL_PILOT=1 in .env / GitHub secrets.',
    )
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl.trim(), serviceKey.trim())

  for (const slug of slugs) {
    const company = getPilotCompanyBySlug(slug)
    if (!company) {
      console.warn('Unknown slug, skip:', slug)
      continue
    }

    try {
      console.log('—', company.slug, company.name)
      const { items, model } = await fetchCompanyResearchFromPerplexity(
        company.name,
        company.ticker,
      )
      const { error } = await supabase.from('company_research_cache').upsert(
        {
          slug: company.slug,
          company_name: company.name,
          ticker: company.ticker,
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
          slug: company.slug,
          company_name: company.name,
          ticker: company.ticker,
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
