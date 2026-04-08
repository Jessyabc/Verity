import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Container } from '@/components/ui/Container'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'

function initialsFromEmail(email: string | undefined): string {
  if (!email) return '?'
  const base = email.split('@')[0]?.trim() ?? ''
  const parts = base.split(/[._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return base.slice(0, 2).toUpperCase() || '?'
}

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const email = user?.email ?? ''
  const initials = initialsFromEmail(email)

  return (
    <Container className="max-w-lg">
      <header className="mb-10 text-center sm:mb-12">
        <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-ink-subtle">Account</p>
        <div className="relative mx-auto mt-6 h-[5.5rem] w-[5.5rem]">
          <div
            className="absolute inset-0 rounded-full opacity-90 blur-xl dark:opacity-50"
            style={{
              background:
                'linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 40%, var(--color-accent-spot)))',
            }}
            aria-hidden
          />
          <div
            className={cn(
              'relative flex h-full w-full items-center justify-center rounded-full',
              'border border-stroke bg-canvas text-[1.35rem] font-semibold tracking-tight text-ink',
              'shadow-inset-avatar',
            )}
          >
            {initials}
          </div>
        </div>
        <h1 className="mt-5 text-2xl font-medium tracking-[-0.03em] text-ink sm:text-[1.75rem]">
          {email ? email.split('@')[0] : 'Signed in'}
        </h1>
        <p className="mt-1.5 break-all text-[15px] text-ink-muted">{email || '—'}</p>
      </header>

      <div className="space-y-4">
        <Card padding="sm" className="p-0 overflow-hidden">
          <div className="divide-y divide-stroke">
            <div className="px-5 py-4 sm:px-6">
              <p className="text-[13px] font-medium text-ink-subtle">User ID</p>
              <p className="mt-1 font-mono text-[12px] leading-relaxed text-ink-muted break-all">
                {user?.id ?? '—'}
              </p>
            </div>
            <Link
              to="/app/settings"
              className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] sm:px-6"
            >
              <span className="text-[15px] font-medium text-ink">Settings</span>
              <span className="text-ink-subtle" aria-hidden>
                →
              </span>
            </Link>
          </div>
        </Card>

        <p className="px-1 text-center text-[13px] leading-relaxed text-ink-subtle">
          Profile details stay on this device until you connect billing or team features.
        </p>

        <button
          type="button"
          onClick={() => void signOut()}
          className="glass-panel w-full rounded-2xl px-5 py-3.5 text-[15px] font-medium text-danger transition-[transform,opacity] hover:opacity-90 active:scale-[0.99]"
        >
          Sign out
        </button>

        <p className="text-center">
          <Link
            to="/app/watchlist"
            className="text-[14px] font-medium text-accent underline-offset-2 hover:underline"
          >
            Back to watchlist
          </Link>
        </p>
      </div>
    </Container>
  )
}
