/**
 * useAdaptiveBrand — returns Verity brand tokens that respond to the system
 * light/dark preference.
 *
 * Dark mode  → current navy/teal BRAND (identical to the static BRAND constant)
 * Light mode → inverted: light canvas, navy as text, same teal accents
 *
 * Use this hook in any screen that was previously hardcoded to BRAND.*.
 * The static BRAND constant in constants/brand.ts still exists for contexts
 * where a value is needed outside of a component (e.g. StyleSheet.create).
 */

import { useColorScheme } from '@/components/useColorScheme'

export type AdaptiveBrandTokens = {
  /** Screen / page background */
  navy: string
  /** Glass card fill (semi-transparent) */
  glassNavy: string
  /** Teal wash overlay on glass cards */
  glassTealWash: string
  /** Primary body text */
  onNavy: string
  /** Secondary / de-emphasised text */
  onNavyMuted: string
  /** Tertiary / placeholder text */
  onNavySubtle: string
  /** Teal — darker variant (decorative accents, dots) */
  tealDark: string
  /** Teal — lighter variant (icons, links, interactive) */
  tealLight: string
  /** Hairline borders and dividers */
  stroke: string
  /** BlurView tint — drives the frosted-glass direction */
  blurTint: 'dark' | 'light'
}

const brandDark: AdaptiveBrandTokens = {
  navy:          '#0A2540',
  glassNavy:     'rgba(10, 37, 64, 0.72)',
  glassTealWash: 'rgba(92, 154, 154, 0.18)',
  onNavy:        '#F2F6FA',
  onNavyMuted:   'rgba(242, 246, 250, 0.70)',
  onNavySubtle:  'rgba(242, 246, 250, 0.52)',
  tealDark:      '#5C9A9A',
  tealLight:     '#8CC6C0',
  stroke:        'rgba(242, 246, 250, 0.12)',
  blurTint:      'dark',
}

const brandLight: AdaptiveBrandTokens = {
  navy:          '#F2F5F9',
  glassNavy:     'rgba(255, 255, 255, 0.88)',
  glassTealWash: 'rgba(92, 154, 154, 0.10)',
  onNavy:        '#0A2540',
  onNavyMuted:   'rgba(10, 37, 64, 0.62)',
  onNavySubtle:  'rgba(10, 37, 64, 0.42)',
  tealDark:      '#4A8282',
  tealLight:     '#5C9A9A',
  stroke:        'rgba(10, 37, 64, 0.10)',
  blurTint:      'light',
}

export function useAdaptiveBrand(): AdaptiveBrandTokens {
  const scheme = useColorScheme()
  return scheme === 'dark' ? brandDark : brandLight
}
