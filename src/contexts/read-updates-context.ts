import { createContext } from 'react'

export type ReadUpdatesState = {
  markRead: (updateId: string) => void
  isRead: (updateId: string) => boolean
}

export const ReadUpdatesContext = createContext<ReadUpdatesState | null>(null)
