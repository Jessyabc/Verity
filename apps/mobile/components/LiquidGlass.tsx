/**
 * Liquid Glass — native iOS 26-style material for React Native / Expo.
 *
 * Uses expo-blur's BlurView with systemUltraThinMaterial tint as the
 * base material, layered with a specular gradient border and inner fill
 * to simulate Apple's Liquid Glass refractive appearance.
 *
 * Architecture:
 *   outer View      — carries drop shadow (can't coexist with overflow:hidden)
 *   └ BlurView      — blur + clip + specular border
 *     └ inner View  — semi-transparent fill + content
 *       └ specular  — 1px top-edge highlight (absolute, non-interactive)
 *       └ children
 */

import { BlurView } from 'expo-blur'
import React from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

// ─── Shared constants ──────────────────────────────────────────────────────

const BLUR_INTENSITY_LIGHT = 72
const BLUR_INTENSITY_DARK  = 80

function tint(dark: boolean) {
  return dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'
}

function fillColor(dark: boolean) {
  return dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.22)'
}

function borderColor(dark: boolean) {
  return dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.55)'
}

// ─── LiquidGlassView ──────────────────────────────────────────────────────

type LiquidGlassViewProps = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  innerStyle?: StyleProp<ViewStyle>
  radius?: number
  intensity?: number
  shadow?: boolean
}

export function LiquidGlassView({
  children,
  style,
  innerStyle,
  radius = 20,
  intensity,
  shadow = true,
}: LiquidGlassViewProps) {
  const cs = useColorScheme()
  const dark = cs === 'dark'
  const blurIntensity = intensity ?? (dark ? BLUR_INTENSITY_DARK : BLUR_INTENSITY_LIGHT)

  return (
    <View
      style={[
        shadow && (dark ? styles.shadowDark : styles.shadowLight),
        { borderRadius: radius },
        style,
      ]}
    >
      <BlurView
        intensity={blurIntensity}
        tint={tint(dark) as never}
        style={[
          styles.blur,
          {
            borderRadius: radius,
            borderColor: borderColor(dark),
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            { backgroundColor: fillColor(dark) },
            innerStyle,
          ]}
        >
          {/* Top-edge specular highlight — the signature of Liquid Glass */}
          <View style={styles.specular} pointerEvents="none" />
          {children}
        </View>
      </BlurView>
    </View>
  )
}

// ─── LiquidGlassPressable ─────────────────────────────────────────────────

type LiquidGlassPressableProps = PressableProps & {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  innerStyle?: StyleProp<ViewStyle>
  radius?: number
}

export function LiquidGlassPressable({
  children,
  style,
  innerStyle,
  radius = 20,
  ...rest
}: LiquidGlassPressableProps) {
  const cs = useColorScheme()
  const dark = cs === 'dark'

  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        dark ? styles.shadowDark : styles.shadowLight,
        { borderRadius: radius, opacity: pressed ? 0.82 : 1 },
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
    >
      <BlurView
        intensity={dark ? BLUR_INTENSITY_DARK : BLUR_INTENSITY_LIGHT}
        tint={tint(dark) as never}
        style={[styles.blur, { borderRadius: radius, borderColor: borderColor(dark) }]}
      >
        <View style={[styles.fill, { backgroundColor: fillColor(dark) }, innerStyle]}>
          <View style={styles.specular} pointerEvents="none" />
          {children}
        </View>
      </BlurView>
    </Pressable>
  )
}

// ─── LiquidGlassFAB ───────────────────────────────────────────────────────
// Round floating action button — the watchlist "+" bubble.

type LiquidGlassFABProps = {
  onPress: () => void
  label?: string
  size?: number
  active?: boolean
  /** Override icon/label text */
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function LiquidGlassFAB({
  onPress,
  label = '+',
  size = 52,
  active = false,
  children,
  style,
}: LiquidGlassFABProps) {
  const cs = useColorScheme()
  const dark = cs === 'dark'
  const radius = size / 2

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        dark ? styles.shadowDark : styles.shadowLight,
        {
          width: size,
          height: size,
          borderRadius: radius,
          opacity: pressed ? 0.78 : 1,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        style,
      ]}
      hitSlop={10}
    >
      <BlurView
        intensity={dark ? 85 : 75}
        tint={tint(dark) as never}
        style={[
          styles.blur,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderColor: active
              ? 'rgba(107,140,255,0.6)'
              : borderColor(dark),
            borderWidth: active ? 1.5 : StyleSheet.hairlineWidth,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            styles.fabFill,
            {
              backgroundColor: active
                ? 'rgba(47,74,216,0.18)'
                : fillColor(dark),
            },
          ]}
        >
          <View style={styles.specular} pointerEvents="none" />
          {children ?? (
            <Text
              style={[
                styles.fabLabel,
                { color: active ? '#6b8cff' : dark ? '#f4f5f7' : '#0c0d11' },
              ]}
              allowFontScaling={false}
            >
              {active ? '★' : label}
            </Text>
          )}
        </View>
      </BlurView>
    </Pressable>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  shadowLight: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  shadowDark: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  blur: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fill: {
    flex: 1,
    position: 'relative',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.65)',
    zIndex: 10,
  },
  fabFill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabLabel: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '300',
    letterSpacing: -0.5,
    marginTop: 1,
  },
})
