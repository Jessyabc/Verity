import { palette, paletteDark } from '@/constants/theme'

const tintColorLight = palette.accent
const tintColorDark = paletteDark.accent

export default {
  light: {
    text: palette.ink,
    background: palette.canvas,
    tint: tintColorLight,
    tabIconDefault: palette.inkSubtle,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: paletteDark.ink,
    background: paletteDark.canvas,
    tint: tintColorDark,
    tabIconDefault: paletteDark.inkSubtle,
    tabIconSelected: tintColorDark,
  },
}
