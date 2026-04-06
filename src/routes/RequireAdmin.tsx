import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/**
 * Client-side gate for admin UI. Edge Functions enforce `ADMIN_EMAIL` — this only hides routes.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const admin = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase()
  if (!admin) {
    return <Navigate to="/app/watchlist" replace />
  }
  if (!user?.email || user.email.trim().toLowerCase() !== admin) {
    return <Navigate to="/app/watchlist" replace />
  }
  return children
}
