import {
  DarkTheme,
  DefaultTheme,
  type Theme,
} from '@react-navigation/native'

import { font, palette, paletteDark } from '@/constants/theme'

export function verityNavigationTheme(colorScheme: 'light' | 'dark' | null | undefined): Theme {
  const dark = colorScheme === 'dark'
  const p = dark ? paletteDark : palette
  const base = dark ? DarkTheme : DefaultTheme

  return {
    ...base,
    colors: {
      ...base.colors,
      primary: p.accent,
      background: p.canvas,
      card: dark ? p.surfaceSolid : p.surfaceSolid,
      text: p.ink,
      border: p.stroke,
      notification: p.accent,
    },
    fonts: {
      regular: { fontFamily: font.regular, fontWeight: '400' as const },
      medium: { fontFamily: font.medium, fontWeight: '500' as const },
      bold: { fontFamily: font.bold, fontWeight: '700' as const },
      heavy: { fontFamily: font.bold, fontWeight: '700' as const },
    },
  }
}
