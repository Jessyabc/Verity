import { createContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

export type ThemeContextValue = {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  /** Resolved appearance after applying system preference. */
  resolved: 'light' | 'dark'
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
