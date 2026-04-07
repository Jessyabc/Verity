/**
 * Admin-only:
 * - Default: upsert public.companies + one company_sources row.
 * - mode "add_source_only": company must exist; upsert one company_sources row only.
 * Secrets: ADMIN_EMAIL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from '../_shared/cors.ts'
import { requireAdminEmail, requireSession } from '../_shared/requireSession.ts'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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

/** Favicon URL derived from IR base URL (matches web/mobile companyLogo helper). */
function faviconLogoUrlFromHttpUrl(canonical: string): string | null {
  try {
    const u = new URL(canonical)
    const host = u.hostname
    if (!host) return null
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const auth = await requireSession(req)
    if ('response' in auth) return auth.response

    const admin = requireAdminEmail(auth.user)
    if ('response' in admin) return admin.response

    const body = (await req.json()) as {
      mode?: string
      slug?: string
      name?: string
      ticker?: string | null
      exchange?: string | null
      tagline?: string | null
      overview?: string | null
      sourceKey?: string
      sourceLabel?: string
      baseUrl?: string
    }

    const mode = body.mode?.trim()
    const slug = body.slug?.trim().toLowerCase()
    const sourceKey = body.sourceKey?.trim()
    const sourceLabel = body.sourceLabel?.trim()
    const baseUrlRaw = body.baseUrl?.trim()

    if (!slug || !sourceKey || !sourceLabel || !baseUrlRaw) {
      return new Response(
        JSON.stringify({ error: 'slug, sourceKey, sourceLabel, and baseUrl are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!SLUG_RE.test(slug)) {
      return new Response(
        JSON.stringify({
          error: 'slug must be lowercase letters, numbers, and single hyphens (e.g. cik-320193)',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const canonical = normalizeUrl(baseUrlRaw)
    try {
      new URL(canonical)
    } catch {
      return new Response(JSON.stringify({ error: 'baseUrl must be a valid http(s) URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
    if (!supabaseUrl || !serviceKey) {
      return new Response(
        JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    if (mode === 'add_source_only') {
      const { data: existing, error: findErr } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      if (findErr) throw findErr
      if (!existing) {
        return new Response(
          JSON.stringify({
            error: `No company with slug "${slug}". Import SEC or create the company first.`,
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      const companyId = existing.id as string

      const { error: sourceErr } = await supabase.from('company_sources').upsert(
        {
          company_id: companyId,
          source_key: sourceKey,
          label: sourceLabel,
          base_url: canonical,
          last_run_at: new Date().toISOString(),
          last_status: 'running',
        },
        { onConflict: 'company_id,source_key' },
      )

      if (sourceErr) throw sourceErr

      const favicon = faviconLogoUrlFromHttpUrl(canonical)
      if (favicon) {
        const { error: logoErr } = await supabase
          .from('companies')
          .update({ logo_url: favicon })
          .eq('id', companyId)
          .is('logo_url', null)
        if (logoErr) throw logoErr
      }

      return new Response(JSON.stringify({ ok: true, slug, companyId, mode: 'add_source_only' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const name = body.name?.trim()
    if (!name) {
      return new Response(
        JSON.stringify({
          error: 'name is required unless mode is add_source_only',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const logoUrl = faviconLogoUrlFromHttpUrl(canonical)

    const { data: companyRow, error: companyErr } = await supabase
      .from('companies')
      .upsert(
        {
          slug,
          name,
          ticker: body.ticker?.trim() || null,
          exchange: body.exchange?.trim() || null,
          tagline: body.tagline?.trim() || null,
          overview: body.overview?.trim() || null,
          ...(logoUrl ? { logo_url: logoUrl } : {}),
        },
        { onConflict: 'slug' },
      )
      .select('id')
      .single()

    if (companyErr || !companyRow) {
      throw new Error(companyErr?.message ?? 'company upsert failed')
    }

    const companyId = companyRow.id as string

    const { error: sourceErr } = await supabase.from('company_sources').upsert(
      {
        company_id: companyId,
        source_key: sourceKey,
        label: sourceLabel,
        base_url: canonical,
        last_run_at: new Date().toISOString(),
        last_status: 'running',
      },
      { onConflict: 'company_id,source_key' },
    )

    if (sourceErr) throw sourceErr

    return new Response(JSON.stringify({ ok: true, slug, companyId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
