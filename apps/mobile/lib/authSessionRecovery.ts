/**
 * Detect Supabase auth errors that mean the persisted session is unusable and should be dropped
 * (stale refresh token after reinstall, project reset, revoked sessions, etc.).
 */
export function isInvalidStoredSessionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { message?: string; code?: string; name?: string }
  const code = String(e.code ?? '').toLowerCase()
  const msg = String(e.message ?? '').toLowerCase()
  return (
    code === 'refresh_token_not_found' ||
    code === 'invalid_grant' ||
    msg.includes('invalid refresh token') ||
    msg.includes('refresh token not found')
  )
}
