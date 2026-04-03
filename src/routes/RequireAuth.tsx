import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function RequireAuth() {
  const { user, authInitialized } = useAuth()
  const location = useLocation()

  if (!authInitialized) {
    return (
      <div
        className="mesh-bg flex min-h-svh items-center justify-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p className="text-[15px] text-ink-muted">Loading session…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
