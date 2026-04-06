import { useColorScheme } from '@/components/useColorScheme'
import { palette, paletteDark } from '@/constants/theme'

export function useVerityPalette() {
  const scheme = useColorScheme()
  return scheme === 'dark' ? paletteDark : palette
}
