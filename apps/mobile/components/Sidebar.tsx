/**
 * Sidebar — sliding left-edge drawer navigation (Claude / OpenAI style).
 *
 * Exports:
 *   SidebarProvider   — wrap (tabs)/_layout.tsx children with this
 *   SidebarDrawer     — render once inside SidebarProvider (always mounted)
 *   useSidebar        — open / close / isOpen
 */

import { useRouter } from 'expo-router'
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font, space } from '@/constants/theme'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width
export const SIDEBAR_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.82), 320)

// ─── Context ──────────────────────────────────────────────────────────────────

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

// Internal context carries animation values so they don't trigger re-renders
// on the whole tree when state changes.
type SidebarAnimContextValue = {
  translateX: Animated.Value
  overlayOpacity: Animated.Value
}

const SidebarAnimCtx = createContext<SidebarAnimContextValue>({
  translateX: new Animated.Value(-SIDEBAR_WIDTH),
  overlayOpacity: new Animated.Value(0),
})

export function useSidebar() {
  return useContext(SidebarCtx)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const translateX = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current
  const overlayOpacity = useRef(new Animated.Value(0)).current

  const open = useCallback(() => {
    setIsOpen(true)
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 200,
        friction: 22,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0.45,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()
  }, [translateX, overlayOpacity])

  const close = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: -SIDEBAR_WIDTH,
        useNativeDriver: true,
        tension: 220,
        friction: 24,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => setIsOpen(false))
  }, [translateX, overlayOpacity])

  return (
    <SidebarCtx.Provider value={{ isOpen, open, close }}>
      <SidebarAnimCtx.Provider value={{ translateX, overlayOpacity }}>
        {children}
      </SidebarAnimCtx.Provider>
    </SidebarCtx.Provider>
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: '⬡', label: 'Watchlist',   route: '/(tabs)' },
  { icon: '⌗', label: 'Saved Links', route: '/(tabs)/saved' },
  { icon: '⚙', label: 'Settings',    route: '/(tabs)/settings' },
  { icon: '◎', label: 'Profile',     route: '/(tabs)/profile' },
] as const

// ─── Drawer UI ────────────────────────────────────────────────────────────────

export function SidebarDrawer() {
  const { isOpen, close } = useSidebar()
  const { translateX, overlayOpacity } = useContext(SidebarAnimCtx)
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { user } = useAuth()

  const navigate = (route: string) => {
    close()
    // Small delay so the close animation starts before navigation
    setTimeout(() => router.push(route as never), 80)
  }

  return (
    <>
      {/* Dim overlay — always rendered, pointerEvents gated by isOpen */}
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000', opacity: overlayOpacity, zIndex: 100 },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Sidebar panel — always rendered, slides in/out */}
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[
          styles.sidebar,
          {
            backgroundColor: colors.surfaceSolid,
            transform: [{ translateX }],
          },
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
          {/* Wordmark */}
          <View style={styles.brandRow}>
            <Text style={[styles.brand, { color: colors.ink }]}>Verity</Text>
          </View>
          <Text style={[styles.tagline, { color: colors.inkSubtle }]}>
            Company · Media · The Gap
          </Text>

          {/* Nav items */}
          <View style={[styles.navSection, { borderTopColor: colors.stroke }]}>
            {NAV_ITEMS.map((item) => (
              <Pressable
                key={item.route}
                style={({ pressed }) => [
                  styles.navItem,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
                onPress={() => navigate(item.route)}
              >
                <Text style={[styles.navIcon, { color: colors.inkMuted }]}>
                  {item.icon}
                </Text>
                <Text style={[styles.navLabel, { color: colors.ink }]}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* User footer */}
          <View style={[styles.footer, { borderTopColor: colors.stroke }]}>
            {user?.email ? (
              <Text
                style={[styles.userEmail, { color: colors.inkSubtle }]}
                numberOfLines={1}
              >
                {user.email}
              </Text>
            ) : null}
            <Text style={[styles.version, { color: colors.inkSubtle }]}>
              Verity for iOS
            </Text>
          </View>
        </View>
      </Animated.View>
    </>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
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
