/**
 * Sidebar — menu sits *under* the main shell; content pushes right (RNGH + Reanimated).
 *
 * Pan is tuned so vertical scrolling wins until horizontal intent is clear.
 * On company profiles, `useCompanyChatSwipeZones` makes the shell yield:
 *   - left half → native edge-back
 *   - right half → interactive chat reveal (CompanyChatReveal)
 *
 * Exports:
 *   SidebarProvider — wrap the main Stack (see app/_layout.tsx)
 *   useSidebar — open / close / isOpen
 *   useCompanyChatSwipeZones — enable 50/50 yield on company profile
 */

import { useRouter, useSegments } from 'expo-router'
import { BlurView } from 'expo-blur'
import Ionicons from '@expo/vector-icons/Ionicons'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { VerityMark } from '@/components/VerityMark'
import { useAuth } from '@/contexts/AuthContext'
import { BRAND } from '@/constants/brand'
import { font, space } from '@/constants/theme'
import { formatUnknownError } from '@/lib/format'
import { supabase } from '@/lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width
const MID_X = SCREEN_WIDTH * 0.5
export const SIDEBAR_WIDTH = Math.min(Math.round(SCREEN_WIDTH * 0.82), 320)

const SPRING_OPEN = { damping: 26, stiffness: 260, mass: 0.85 }
const SPRING_CLOSE = { damping: 28, stiffness: 280, mass: 0.9 }

// ─── Context ───────────────────────────────────────────────────────────────────

type SidebarCtxType = {
  isOpen: boolean
  open: () => void
  close: () => void
  /** When true, shell pan yields left-half back + right-half chat reveal. */
  setCompanyChatSwipeZones: (enabled: boolean) => void
}

const SidebarCtx = createContext<SidebarCtxType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  setCompanyChatSwipeZones: () => {},
})

export function useSidebar() {
  return useContext(SidebarCtx)
}

/** Enable 50/50 swipe zones for the lifetime of a company profile screen. */
export function useCompanyChatSwipeZones(enabled: boolean) {
  const { setCompanyChatSwipeZones } = useSidebar()
  useEffect(() => {
    setCompanyChatSwipeZones(enabled)
    return () => setCompanyChatSwipeZones(false)
  }, [enabled, setCompanyChatSwipeZones])
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const contentX = useSharedValue(0)
  const overlayOpacity = useSharedValue(0)
  const startX = useSharedValue(0)
  const touchStartX = useSharedValue(0)
  const touchStartY = useSharedValue(0)
  const companyZones = useSharedValue(0)
  const [isOpen, setIsOpen] = useState(false)

  const setOpen = useCallback((v: boolean) => {
    setIsOpen(v)
  }, [])

  const setCompanyChatSwipeZones = useCallback(
    (enabled: boolean) => {
      companyZones.value = enabled ? 1 : 0
    },
    [companyZones],
  )

  const open = useCallback(() => {
    setIsOpen(true)
    contentX.value = withSpring(SIDEBAR_WIDTH, SPRING_OPEN)
    overlayOpacity.value = withTiming(0.45, { duration: 200 })
  }, [contentX, overlayOpacity])

  const close = useCallback(() => {
    contentX.value = withSpring(0, SPRING_CLOSE, (finished) => {
      if (finished) runOnJS(setOpen)(false)
    })
    overlayOpacity.value = withTiming(0, { duration: 160 })
  }, [contentX, overlayOpacity, setOpen])

  /**
   * Shell pan: swipe right → open menu (default).
   * With company zones: yield left half (edge-back) and right half (chat reveal).
   */
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((e) => {
          const t = e.allTouches[0]
          touchStartX.value = t?.absoluteX ?? 0
          touchStartY.value = t?.absoluteY ?? 0
        })
        .onTouchesMove((e, state) => {
          const t = e.allTouches[0]
          if (!t) return
          const dx = t.absoluteX - touchStartX.value
          const dy = t.absoluteY - touchStartY.value

          if (Math.abs(dy) > 22 && Math.abs(dy) > Math.abs(dx)) {
            state.fail()
            return
          }

          // Menu already open — allow drag either way to close/adjust.
          if (contentX.value > 2) {
            if (Math.abs(dx) > 24) state.activate()
            return
          }

          if (companyZones.value === 1) {
            // Yield entire horizontal lane on company profiles:
            // left half → native back, right half → chat reveal.
            state.fail()
            return
          }

          if (Math.abs(dx) > 32) {
            state.activate()
          }
        })
        .onStart(() => {
          startX.value = contentX.value
        })
        .onUpdate((e) => {
          const next = Math.min(
            SIDEBAR_WIDTH,
            Math.max(0, startX.value + e.translationX),
          )
          contentX.value = next
          overlayOpacity.value = interpolate(next, [0, SIDEBAR_WIDTH], [0, 0.45])
          if (next > 10) {
            runOnJS(setOpen)(true)
          }
        })
        .onEnd((e) => {
          const x = contentX.value
          const v = e.velocityX
          const openCutoff = SIDEBAR_WIDTH * 0.65
          const isTap =
            Math.abs(e.translationX) < 12 &&
            Math.abs(e.translationY) < 12 &&
            Math.abs(v) < 220

          if (isTap && startX.value >= SIDEBAR_WIDTH - 2 && x >= SIDEBAR_WIDTH - 2) {
            runOnJS(close)()
            return
          }

          const shouldOpen = v > 420 || x > openCutoff

          if (shouldOpen) {
            contentX.value = withSpring(SIDEBAR_WIDTH, SPRING_OPEN)
            overlayOpacity.value = withTiming(0.45, { duration: 200 })
            runOnJS(setOpen)(true)
          } else {
            contentX.value = withSpring(0, SPRING_CLOSE, (finished) => {
              if (finished) runOnJS(setOpen)(false)
            })
            overlayOpacity.value = withTiming(0, { duration: 160 })
          }
        }),
    [close, contentX, companyZones, overlayOpacity, startX, touchStartX, touchStartY, setOpen],
  )

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentX.value }],
  }))

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }))

  const ctx = useMemo(
    () => ({ isOpen, open, close, setCompanyChatSwipeZones }),
    [isOpen, open, close, setCompanyChatSwipeZones],
  )

  return (
    <SidebarCtx.Provider value={ctx}>
      <GestureDetector gesture={pan}>
        <View style={styles.root} collapsable={false}>
          <SidebarPanel onNavigate={close} />

          <Animated.View
            style={[
              styles.contentShell,
              Platform.OS === 'ios' ? styles.contentShadowIOS : styles.contentShadowAndroid,
              contentAnimatedStyle,
            ]}
          >
            <View style={[styles.contentFill, { backgroundColor: BRAND.navy }]}>{children}</View>
            <Animated.View
              pointerEvents={isOpen ? 'auto' : 'none'}
              style={[StyleSheet.absoluteFill, styles.overlayBase, styles.overlayWrap, overlayStyle]}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              />
            </Animated.View>
          </Animated.View>
        </View>
      </GestureDetector>
    </SidebarCtx.Provider>
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    icon: 'list-outline' as const,
    iconActive: 'list' as const,
    label: 'Watchlist',
    route: '/(tabs)' as const,
    tabKey: 'index' as const,
  },
  {
    icon: 'chatbubbles-outline' as const,
    iconActive: 'chatbubbles' as const,
    label: 'Afaqi',
    route: '/afaqi' as const,
    tabKey: 'afaqi' as const,
  },
  {
    icon: 'bookmark-outline' as const,
    iconActive: 'bookmark' as const,
    label: 'Saved',
    route: '/(tabs)/saved' as const,
    tabKey: 'saved' as const,
  },
  {
    icon: 'person-outline' as const,
    iconActive: 'person' as const,
    label: 'Account',
    route: '/(tabs)/settings' as const,
    tabKey: 'settings' as const,
  },
] as const

function sidebarActiveTab(segments: string[]): (typeof NAV_ITEMS)[number]['tabKey'] {
  if (segments.includes('afaqi')) return 'afaqi'
  if (segments.includes('saved')) return 'saved'
  if (segments.includes('settings')) return 'settings'
  return 'index'
}

function SidebarPanel({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter()
  const segments = useSegments()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const activeTab = sidebarActiveTab(segments as string[])
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const navigate = (route: string) => {
    onNavigate()
    setTimeout(() => router.push(route as never), 80)
  }

  const username =
    typeof (user?.user_metadata as Record<string, unknown> | undefined)?.username === 'string'
      ? String((user!.user_metadata as Record<string, unknown>).username).trim()
      : ''
  const identityLine = username || user?.email || ''

  return (
    <View style={styles.sidebarUnderlay} pointerEvents="box-none">
      <BlurView intensity={48} tint="dark" style={styles.sidebarBlur}>
        <View style={[styles.sidebarInner, { backgroundColor: BRAND.glassNavy }]}>
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
              <VerityMark size={32} />
              <Text style={[styles.brandWord, { color: BRAND.onNavy }]}>Verity</Text>
            </View>
            <Text style={[styles.tagline, { color: BRAND.onNavySubtle }]}>
              Company · Media · The Gap
            </Text>

            <View style={[styles.navSection, { borderTopColor: BRAND.stroke }]}>
              {NAV_ITEMS.map((item) => {
                const active = item.tabKey === activeTab
                return (
                  <Pressable
                    key={item.route}
                    style={({ pressed }) => [
                      styles.navItem,
                      active && {
                        backgroundColor: BRAND.glassTealWash,
                      },
                      { opacity: pressed ? 0.72 : 1 },
                    ]}
                    onPress={() => navigate(item.route)}
                  >
                    <View style={styles.navIconWrap}>
                      <Ionicons
                        name={active ? item.iconActive : item.icon}
                        size={20}
                        color={active ? BRAND.tealLight : BRAND.onNavyMuted}
                      />
                    </View>
                    <Text
                      style={[
                        styles.navLabel,
                        { color: active ? BRAND.tealLight : BRAND.onNavy },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={{ flex: 1 }} />

            <View style={[styles.footer, { borderTopColor: BRAND.stroke }]}>
              <Pressable
                style={({ pressed }) => [styles.feedbackBtn, { opacity: pressed ? 0.72 : 1 }]}
                onPress={() => setFeedbackOpen(true)}
              >
                <Ionicons name="chatbox-ellipses-outline" size={18} color={BRAND.tealLight} />
                <Text style={[styles.feedbackLabel, { color: BRAND.onNavy }]}>Feedback</Text>
              </Pressable>

              {identityLine ? (
                <Text style={[styles.userEmail, { color: BRAND.onNavySubtle }]} numberOfLines={1}>
                  {identityLine}
                </Text>
              ) : null}
              <Text style={[styles.version, { color: BRAND.onNavySubtle }]}>Verity for iOS</Text>
            </View>

            <FeedbackModal
              open={feedbackOpen}
              onClose={() => setFeedbackOpen(false)}
              userId={user?.id ?? null}
              username={username || null}
              email={user?.email ?? null}
            />
          </View>
        </View>
      </BlurView>
    </View>
  )
}

function FeedbackModal({
  open,
  onClose,
  userId,
  username,
  email,
}: {
  open: boolean
  onClose: () => void
  userId: string | null
  username: string | null
  email: string | null
}) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    const text = message.trim()
    if (!text) {
      Alert.alert('Feedback', 'Write a short note first.')
      return
    }
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to send feedback.')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('user_feedback').insert({
        user_id: userId,
        email,
        username,
        message: text,
        platform: Platform.OS,
      })
      if (error) throw error
      setMessage('')
      Alert.alert('Thanks', 'Feedback sent.')
      onClose()
    } catch (e) {
      Alert.alert('Could not send', formatUnknownError(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: BRAND.glassNavy, borderColor: BRAND.stroke }]}>
          <Text style={[styles.modalTitle, { color: BRAND.onNavy }]}>Send feedback</Text>
          <Text style={[styles.modalSubtitle, { color: BRAND.onNavySubtle }]}>
            Neutral, factual feedback helps us improve Verity.
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="What should we improve?"
            placeholderTextColor={BRAND.onNavyMuted}
            style={[
              styles.modalInput,
              {
                color: BRAND.onNavy,
                borderColor: BRAND.stroke,
                backgroundColor: 'rgba(10, 37, 64, 0.6)',
              },
            ]}
            multiline
            textAlignVertical="top"
            editable={!submitting}
            maxLength={1000}
          />
          <View style={styles.modalActions}>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnSecondary,
                { borderColor: BRAND.stroke, opacity: pressed || submitting ? 0.85 : 1 },
              ]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={[styles.modalBtnText, { color: BRAND.onNavyMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.modalBtn,
                { backgroundColor: BRAND.tealDark, opacity: pressed || submitting ? 0.88 : 1 },
              ]}
              onPress={() => void submit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={BRAND.onNavy} />
              ) : (
                <Text style={[styles.modalBtnText, { color: BRAND.onNavy }]}>Send</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  sidebarUnderlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 0,
  },
  sidebarBlur: {
    flex: 1,
  },
  sidebarInner: {
    flex: 1,
  },
  contentShell: {
    flex: 1,
    zIndex: 2,
    backgroundColor: BRAND.navy,
  },
  contentFill: {
    flex: 1,
  },
  overlayWrap: {
    zIndex: 5,
  },
  contentShadowIOS: {
    shadowColor: '#000',
    shadowOffset: { width: -10, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
  },
  contentShadowAndroid: {
    elevation: 18,
  },
  overlayBase: {
    backgroundColor: '#000',
  },
  inner: {
    flex: 1,
    paddingHorizontal: space.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  brandWord: {
    fontFamily: font.bold,
    fontSize: 28,
    letterSpacing: -1,
  },
  tagline: {
    fontFamily: font.regular,
    fontSize: 12,
    marginTop: 6,
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
    gap: space.sm + 2,
    paddingVertical: 11,
    paddingHorizontal: space.sm,
    borderRadius: 10,
    marginHorizontal: -space.sm,
  },
  navIconWrap: {
    width: 24,
    alignItems: 'center',
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
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: 10,
  },
  feedbackLabel: {
    fontFamily: font.semi,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  userEmail: {
    fontFamily: font.regular,
    fontSize: 13,
  },
  version: {
    fontFamily: font.regular,
    fontSize: 11,
    opacity: 0.75,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  modalCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: space.lg,
  },
  modalTitle: { fontFamily: font.semi, fontSize: 18, letterSpacing: -0.3 },
  modalSubtitle: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 6 },
  modalInput: {
    marginTop: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    minHeight: 120,
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 21,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.lg },
  modalBtn: {
    borderRadius: 12,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  modalBtnSecondary: { backgroundColor: 'rgba(10, 37, 64, 0.32)', borderWidth: StyleSheet.hairlineWidth },
  modalBtnText: { fontFamily: font.semi, fontSize: 15 },
})
