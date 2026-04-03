import { createContext } from 'react'

export type WatchlistState = {
  slugs: string[]
  watchedSet: Set<string>
  add: (slug: string) => void
  remove: (slug: string) => void
  isWatched: (slug: string) => boolean
  toggle: (slug: string) => void
}

export const WatchlistContext = createContext<WatchlistState | null>(null)
