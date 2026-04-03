/**
 * Fetch Perplexity research for one pilot slug and upsert company_research_cache.
 * Run: npx tsx scripts/research-company-once.ts microsoft
 */
import './load-env.ts'
import { createClient } from '@supabase/supabase-js'
import { getPilotCompanyBySlug } from '../src/data/pilot-universe.ts'
import { fetchCompanyResearchFromPerplexity } from './lib/research-perplexity.ts'

async function main() {
  const slugArg = process.argv[2]?.trim()
  if (!slugArg) {
    console.error('Usage: npx tsx scripts/research-company-once.ts <slug>')
    process.exit(1)
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const company = getPilotCompanyBySlug(slugArg)
  if (!company) {
    console.error('Unknown pilot slug:', slugArg)
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl.trim(), serviceKey.trim())

  console.log('Fetching Perplexity…', company.name)
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

  if (error) {
    console.error(error)
    process.exit(1)
  }

  console.log('OK', items.length, 'items', model)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
