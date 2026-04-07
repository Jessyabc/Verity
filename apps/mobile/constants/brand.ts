/** Verity company profile / research — brand tokens (exact hex). */
export const BRAND = {
  navy: '#0A2540',
  tealDark: '#5C9A9A',
  tealLight: '#8CC6C0',
  /** Primary copy on navy / glass */
  onNavy: '#F2F6FA',
  onNavyMuted: 'rgba(242, 246, 250, 0.7)',
  onNavySubtle: 'rgba(242, 246, 250, 0.52)',
  /** Navy-tinted glass fill */
  glassNavy: 'rgba(10, 37, 64, 0.72)',
  /** Teal wash over dark glass */
  glassTealWash: 'rgba(92, 154, 154, 0.18)',
  stroke: 'rgba(242, 246, 250, 0.12)',
} as const

export const BRAND_GRADIENT_TEAL = [BRAND.tealDark, BRAND.tealLight] as const
