import { useThemePreference } from '@/contexts/ThemePreferenceContext'

/** Resolved light/dark for navigation, palette, and legacy call sites. */
export function useColorScheme(): 'light' | 'dark' {
  return useThemePreference().resolvedScheme
}
