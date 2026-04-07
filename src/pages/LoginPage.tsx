import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { Field } from '@/components/ui/Field'
import { Logo } from '@/components/marketing/Logo'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from ?? '/app/watchlist'
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email.trim())
      if (isSupabaseConfigured()) {
        setOtpSent(true)
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mesh-bg min-h-svh">
      <header className="glass-header-marketing">
        <Container className="flex h-[4.25rem] items-center justify-between">
          <Logo />
          <Link
            to="/signup"
            className="text-[14px] font-medium text-ink-muted hover:text-ink"
          >
            Create account
          </Link>
        </Container>
      </header>

      <Container className="py-16 sm:py-24">
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-medium tracking-[-0.03em] text-ink">
              Welcome back
            </h1>
            <p className="mt-2 text-[15px] text-ink-muted">
              {isSupabaseConfigured()
                ? 'We’ll email you a magic link to sign in — no password stored here.'
                : 'Development mode: local session only (no Supabase env).'}
            </p>
          </div>

          {otpSent ? (
            <Card>
              <p className="text-[15px] leading-relaxed text-ink-muted">
                Check <span className="font-medium text-ink">{email}</span> for a
                sign-in link. After you click it, you’ll land on your watchlist.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-6 w-full"
                onClick={() => setOtpSent(false)}
              >
                Use a different email
              </Button>
            </Card>
          ) : (
            <Card>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Field
                  label="Work email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@firm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                />
                {error ? (
                  <p className="text-[13px] text-danger" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="submit"
                  className="w-full py-3 text-[16px]"
                  disabled={submitting}
                >
                  {submitting ? 'Sending…' : 'Continue'}
                </Button>
              </form>
            </Card>
          )}

          {!otpSent ? (
            <p className="mt-8 text-center text-[13px] text-ink-subtle">
              {isSupabaseConfigured()
                ? 'Magic link via Supabase Auth — configure templates in the dashboard.'
                : 'No password in mock mode — we only validate a non-empty email.'}
            </p>
          ) : null}
        </div>
      </Container>
    </div>
  )
}
