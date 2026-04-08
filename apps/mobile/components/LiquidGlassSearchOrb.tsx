/**
 * Icon-first liquid-glass search trigger — tap opens search immediately (no motion or delay).
 */

import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Pressable, StyleSheet, useColorScheme, View } from 'react-native'

const ORB = 52
const R = ORB / 2
const ICON = 30

type Props = {
  onOpen: () => void
  disabled?: boolean
  iconColor: string
  accessibilityLabel?: string
  /** Use on `BRAND.navy` screens — stronger dark material + frost tuned for teal/navy. */
  variant?: 'default' | 'onNavy'
}

export function LiquidGlassSearchOrb({
  onOpen,
  disabled = false,
  iconColor,
  accessibilityLabel = 'Search companies to add to watchlist',
  variant = 'default',
}: Props) {
  const scheme = useColorScheme()
  const dark = variant === 'onNavy' ? true : scheme === 'dark'
  const blurTint = dark ? ('systemChromeMaterialDark' as const) : ('systemChromeMaterialLight' as const)

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        disabled={disabled}
        onPress={onOpen}
        accessibilityRole="search"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        hitSlop={12}
        style={({ pressed }) => ({
          opacity: disabled ? 0.48 : pressed ? 0.92 : 1,
        })}
      >
        <View style={[styles.dropShadow, dark ? styles.shadowDark : styles.shadowLight]}>
          <View style={styles.orbClip}>
            <BlurView intensity={variant === 'onNavy' ? 88 : dark ? 100 : 96} tint={blurTint} style={styles.blur}>
              <LinearGradient
                pointerEvents="none"
                colors={
                  variant === 'onNavy' || dark
                    ? ['rgba(140,198,192,0.18)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.12)']
                    : ['rgba(255,255,255,0.82)', 'rgba(255,255,255,0.28)', 'rgba(255,255,255,0.08)']
                }
                start={{ x: 0.12, y: 0 }}
                end={{ x: 0.88, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  styles.inner,
                  {
                    backgroundColor:
                      variant === 'onNavy'
                        ? 'rgba(10,37,64,0.35)'
                        : dark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(255,255,255,0.22)',
                  },
                ]}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={
                    variant === 'onNavy'
                      ? ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'transparent']
                      : ['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)', 'transparent']
                  }
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 0.55 }}
                  style={styles.topGlow}
                />
                <View
                  pointerEvents="none"
                  style={[styles.rimLine, variant === 'onNavy' && styles.rimLineOnNavy]}
                />
                <View pointerEvents="none" style={styles.bottomFrost} />
                <Ionicons name="search" size={ICON} color={iconColor} style={styles.icon} />
              </View>
            </BlurView>
          </View>
        </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropShadow: {
    width: ORB,
    height: ORB,
    borderRadius: R,
  },
  orbClip: {
    width: ORB,
    height: ORB,
    borderRadius: R,
    overflow: 'hidden',
  },
  shadowLight: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
  },
  shadowDark: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 16,
  },
  blur: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.42)',
    overflow: 'hidden',
    borderRadius: R,
  },
  inner: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: R,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  topGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '58%',
    borderTopLeftRadius: R,
    borderTopRightRadius: R,
  },
  rimLine: {
    position: 'absolute',
    top: 1,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  rimLineOnNavy: {
    backgroundColor: 'rgba(140,198,192,0.35)',
  },
  bottomFrost: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
    borderBottomLeftRadius: R,
    borderBottomRightRadius: R,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  icon: { marginTop: 1 },
})
