import { NavLink, Outlet, Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Logo } from '@/components/marketing/Logo'
import { ReadUpdatesProvider } from '@/contexts/ReadUpdatesProvider'
import { WatchlistProvider } from '@/contexts/WatchlistProvider'
import { useAuth } from '@/hooks/useAuth'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { cn } from '@/lib/cn'

const navBase = [
  { to: '/app/watchlist', label: 'Watchlist' },
  { to: '/app/search', label: 'Search' },
  { to: '/app/settings', label: 'Settings' },
] as const

function initialsFromEmail(email: string | undefined): string {
  if (!email) return '?'
  const base = email.split('@')[0]?.trim() ?? ''
  const parts = base.split(/[._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return base.slice(0, 2).toUpperCase() || '?'
}

export function AppShell() {
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const initials = initialsFromEmail(user?.email)

  return (
    <WatchlistProvider key={user?.id}>
      <ReadUpdatesProvider key={user?.id}>
        <div className="mesh-bg min-h-svh">
          <header className="sticky top-0 z-40 glass-header">
            <Container className="flex h-[4.25rem] items-center justify-between gap-4 sm:gap-6">
              <Logo to="/app/watchlist" />
              <nav
                className="flex flex-1 items-center justify-center gap-0.5 sm:gap-1"
                aria-label="Primary"
              >
                {(isAdmin
                  ? [...navBase, { to: '/app/admin/inventory', label: 'Admin' }]
                  : [...navBase]
                ).map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'rounded-full px-3 py-2 text-[13px] font-medium tracking-tight transition-[background-color,box-shadow,color] duration-200 sm:px-3.5 sm:text-[14px]',
                        isActive
                          ? 'text-ink'
                          : 'text-ink-muted hover:bg-[var(--nav-pill-hover-bg)] hover:text-ink',
                      )
                    }
                    style={({ isActive }) =>
                      isActive
                        ? {
                            background: 'var(--nav-pill-active-bg)',
                            boxShadow: 'var(--nav-pill-active-shadow)',
                          }
                        : undefined
                    }
                    end={item.to === '/app/watchlist'}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <Link
                to="/app/profile"
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full py-1.5 pr-1.5 pl-1 transition-colors',
                  'hover:bg-[var(--nav-pill-hover-bg)]',
                )}
                aria-label="Open profile"
              >
                <span className="hidden max-w-[9rem] truncate text-right text-[12px] text-ink-subtle sm:block">
                  {user?.email}
                </span>
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold tracking-tight text-ink',
                    'border border-stroke bg-accent-soft shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset]',
                  )}
                >
                  {initials}
                </span>
              </Link>
            </Container>
          </header>

          <main className="pb-16 pt-10 sm:pb-24 sm:pt-12">
            <Outlet />
          </main>
        </div>
      </ReadUpdatesProvider>
    </WatchlistProvider>
  )
}
