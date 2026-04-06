import { NavLink, Outlet } from 'react-router-dom'
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

export function AppShell() {
  const { signOut, user } = useAuth()
  const isAdmin = useIsAdmin()

  return (
    <WatchlistProvider key={user?.id}>
    <ReadUpdatesProvider key={user?.id}>
    <div className="mesh-bg min-h-svh">
      <header className="sticky top-0 z-40 glass-header">
        <Container className="flex h-[4.25rem] items-center justify-between gap-6">
          <Logo to="/app/watchlist" />
          <nav
            className="flex flex-1 items-center justify-center gap-1 sm:gap-2"
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
                    'rounded-full px-3.5 py-2 text-[14px] font-medium tracking-tight transition-colors duration-200',
                    isActive
                      ? 'bg-white/95 text-ink shadow-[0_1px_3px_rgba(12,13,17,0.08)]'
                      : 'text-ink-muted hover:bg-white/50 hover:text-ink',
                  )
                }
                end={item.to === '/app/watchlist'}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden max-w-[10rem] truncate text-right text-[13px] text-ink-subtle sm:block">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-full px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-black/[0.04] hover:text-ink"
            >
              Sign out
            </button>
          </div>
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
