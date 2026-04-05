import { useAuth } from '@/hooks/useAuth'

/** Matches signed-in user email to `VITE_ADMIN_EMAIL` (must match Edge Function `ADMIN_EMAIL`). */
export function useIsAdmin(): boolean {
  const { user } = useAuth()
  const admin = import.meta.env.VITE_ADMIN_EMAIL?.trim().toLowerCase()
  if (!admin || !user?.email) return false
  return user.email.trim().toLowerCase() === admin
}
