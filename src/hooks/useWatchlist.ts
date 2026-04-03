import { useContext } from 'react'
import { WatchlistContext } from '@/contexts/watchlist-context'

export function useWatchlist() {
  const ctx = useContext(WatchlistContext)
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider')
  return ctx
}
