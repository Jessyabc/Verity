import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { corsHeaders } from './cors.ts'

export async function requireSession(
  req: Request,
): Promise<{ user: { id: string; email?: string } } | { response: Response }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      response: new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  const url = Deno.env.get('SUPABASE_URL')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  if (!url || !anonKey) {
    return {
      response: new Response(
        JSON.stringify({ error: 'SUPABASE_URL or SUPABASE_ANON_KEY missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    }
  }

  const supabase = createClient(url, anonKey)
  const jwt = authHeader.slice('Bearer '.length).trim()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(jwt)

  if (error || !user?.email) {
    return {
      response: new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }

  return { user }
}

export function requireAdminEmail(user: { email?: string }): { ok: true } | { response: Response } {
  const allowed = Deno.env.get('ADMIN_EMAIL')?.trim().toLowerCase()
  if (!allowed) {
    return {
      response: new Response(JSON.stringify({ error: 'ADMIN_EMAIL not configured on function' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }
  if (user.email.trim().toLowerCase() !== allowed) {
    return {
      response: new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    }
  }
  return { ok: true }
}
