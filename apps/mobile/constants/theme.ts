/** Aligned with web `src/index.css` @theme. */
export const palette = {
  canvas: '#eef1f6',
  surface: 'rgba(255, 255, 255, 0.92)',
  surfaceSolid: '#ffffff',
  ink: '#0c0d11',
  inkMuted: '#5c6370',
  inkSubtle: '#8b919c',
  stroke: 'rgba(12, 13, 17, 0.12)',
  accent: '#2f4ad8',
  accentSoft: 'rgba(47, 74, 216, 0.12)',
  success: '#15803d',
  danger: '#b91c1c',
  amber: '#b45309',
} as const

export const paletteDark = {
  canvas: '#060708',
  surface: 'rgba(32, 34, 44, 0.55)',
  surfaceSolid: '#14151c',
  ink: '#f4f5f7',
  inkMuted: '#a8adb8',
  inkSubtle: '#8b919c',
  stroke: 'rgba(255, 255, 255, 0.08)',
  accent: '#6b8cff',
  accentSoft: 'rgba(107, 140, 255, 0.15)',
  success: '#4ade80',
  danger: '#f87171',
  amber: '#fbbf24',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { sm: 8, md: 12, lg: 16 } as const

/** Font names from `@expo-google-fonts/dm-sans` after `useFonts` loads. */
export const font = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semi: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
} as const
