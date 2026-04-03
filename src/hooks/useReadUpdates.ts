import { useContext } from 'react'
import { ReadUpdatesContext } from '@/contexts/read-updates-context'

export function useReadUpdates() {
  const ctx = useContext(ReadUpdatesContext)
  if (!ctx) {
    throw new Error('useReadUpdates must be used within ReadUpdatesProvider')
  }
  return ctx
}
