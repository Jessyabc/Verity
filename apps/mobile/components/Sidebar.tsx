/**
 * Sidebar — sliding drawer + fluid horizontal pan (RNGH + Reanimated).
 *
 * Pan is tuned so vertical scrolling wins (failOffsetY) until horizontal intent is clear (activeOffsetX).
 * Wraps all root content in one GestureDetector so drag + overlay dismiss stay consistent.
 *
 * Exports:
 *   SidebarProvider — wrap the main Stack (see app/_layout.tsx)
 *   useSidebar       — open / close / isOpen
 */

import { useRouter } from 'expo-router'
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font, space } from '@/constants/theme'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width
export const SIDEBAR_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.82), 320)

const SPRING_OPEN = { damping: 26, stiffness: 260, mass: 0.85 }
const SPRING_CLOSE = { damping: 28, stiffness: 280, mass: 0.9 }

// ─── Context ───────────────────────────────────────────────────────────────────

type SidebarCtxType = {
  isOpen: boolean
  open: () => void
  close: () => void
}

const SidebarCtx = createContext<SidebarCtxType>({
  isOpen: false,
  open: () => {},
  close: () => {},
})

export function useSidebar() {
  return useContext(SidebarCtx)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const translateX = useSharedValue(-SIDEBAR_WIDTH)
  const overlayOpacity = useSharedValue(0)
  const startX = useSharedValue(0)
  const [isOpen, setIsOpen] = useState(false)

  const setOpen = useCallback((v: boolean) => {
    setIsOpen(v)
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
    translateX.value = withSpring(0, SPRING_OPEN)
    overlayOpacity.value = withTiming(0.45, { duration: 200 })
  }, [translateX, overlayOpacity])

  const close = useCallback(() => {
    translateX.value = withSpring(-SIDEBAR_WIDTH, SPRING_CLOSE, (finished) => {
      if (finished) runOnJS(setOpen)(false)
    })
    overlayOpacity.value = withTiming(0, { duration: 160 })
  }, [translateX, overlayOpacity, setOpen])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-32, 32])
        .failOffsetY([-22, 22])
        .onStart(() => {
          startX.value = translateX.value
        })
        .onUpdate((e) => {
          const next = Math.min(
            0,
            Math.max(-SIDEBAR_WIDTH, startX.value + e.translationX),
          )
          translateX.value = next
          overlayOpacity.value = interpolate(next, [-SIDEBAR_WIDTH, 0], [0, 0.45])
          if (next > -SIDEBAR_WIDTH + 10) {
            runOnJS(setOpen)(true)
          }
        })
        .onEnd((e) => {
          const x = translateX.value
          const v = e.velocityX
          const openCutoff = -SIDEBAR_WIDTH * 0.35
          const isTap =
            Math.abs(e.translationX) < 12 &&
            Math.abs(e.translationY) < 12 &&
            Math.abs(v) < 220

          if (isTap && startX.value >= -2 && x <= 2) {
            runOnJS(close)()
            return
          }

          const shouldOpen = v > 420 || x > openCutoff

          if (shouldOpen) {
            translateX.value = withSpring(0, SPRING_OPEN)
            overlayOpacity.value = withTiming(0.45, { duration: 200 })
            runOnJS(setOpen)(true)
          } else {
            translateX.value = withSpring(-SIDEBAR_WIDTH, SPRING_CLOSE, (finished) => {
              if (finished) runOnJS(setOpen)(false)
            })
            overlayOpacity.value = withTiming(0, { duration: 160 })
          }
        }),
    [close, translateX, overlayOpacity, startX, setOpen],
  )

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }))

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <SidebarCtx.Provider value={{ isOpen, open, close }}>
      <GestureDetector gesture={pan}>
        <View style={styles.root} collapsable={false}>
          <View style={styles.content}>{children}</View>
          <Animated.View
            pointerEvents={isOpen ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFill, styles.overlayBase, overlayStyle]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          </Animated.View>
          <SidebarPanel translateStyle={sidebarStyle} onNavigate={close} />
        </View>
      </GestureDetector>
    </SidebarCtx.Provider>
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: '⬡', label: 'Watchlist', route: '/(tabs)' },
  { icon: '⌗', label: 'Saved Links', route: '/(tabs)/saved' },
  { icon: '⚙', label: 'Settings', route: '/(tabs)/settings' },
  { icon: '◎', label: 'Profile', route: '/(tabs)/profile' },
] as const

function SidebarPanel({
  translateStyle,
  onNavigate,
}: {
  translateStyle: AnimatedStyle<ViewStyle>
  onNavigate: () => void
}) {
  const { isOpen } = useSidebar()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { user } = useAuth()

  const navigate = (route: string) => {
    onNavigate()
    setTimeout(() => router.push(route as never), 80)
  }

  return (
    <Animated.View
      pointerEvents={isOpen ? 'auto' : 'box-none'}
      style={[
        styles.sidebar,
        { backgroundColor: colors.surfaceSolid },
        translateStyle,
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            paddingTop: insets.top + space.xl,
            paddingBottom: insets.bottom + space.lg,
          },
        ]}
      >
        <View style={styles.brandRow}>
          <Text style={[styles.brand, { color: colors.ink }]}>Verity</Text>
        </View>
        <Text style={[styles.tagline, { color: colors.inkSubtle }]}>
          Company · Media · The Gap
        </Text>

        <View style={[styles.navSection, { borderTopColor: colors.stroke }]}>
          {NAV_ITEMS.map((item) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [styles.navItem, { opacity: pressed ? 0.65 : 1 }]}
              onPress={() => navigate(item.route)}
            >
              <Text style={[styles.navIcon, { color: colors.inkMuted }]}>{item.icon}</Text>
              <Text style={[styles.navLabel, { color: colors.ink }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={[styles.footer, { borderTopColor: colors.stroke }]}>
          {user?.email ? (
            <Text
              style={[styles.userEmail, { color: colors.inkSubtle }]}
              numberOfLines={1}
            >
              {user.email}
            </Text>
          ) : null}
          <Text style={[styles.version, { color: colors.inkSubtle }]}>Verity for iOS</Text>
        </View>
      </View>
    </Animated.View>
  )
}

// Legacy export — drawer UI is inlined in SidebarProvider; keep for any stray imports.
export function SidebarDrawer() {
  return null
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  overlayBase: {
    backgroundColor: '#000',
    zIndex: 100,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 101,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 6, height: 0 },
    elevation: 14,
  },
  inner: {
    flex: 1,
    paddingHorizontal: space.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    fontFamily: font.bold,
    fontSize: 34,
    letterSpacing: -1.2,
  },
  tagline: {
    fontFamily: font.regular,
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.2,
    marginBottom: space.lg,
  },
  navSection: {
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 13,
  },
  navIcon: {
    fontSize: 17,
    width: 26,
    textAlign: 'center',
  },
  navLabel: {
    fontFamily: font.semi,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  footer: {
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.xs,
  },
  userEmail: {
    fontFamily: font.regular,
    fontSize: 13,
  },
  version: {
    fontFamily: font.regular,
    fontSize: 11,
    opacity: 0.6,
  },
})
