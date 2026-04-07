import { useThemePreference } from '@/contexts/ThemePreferenceContext'

export function useColorScheme(): 'light' | 'dark' {
  return useThemePreference().resolvedScheme
}
