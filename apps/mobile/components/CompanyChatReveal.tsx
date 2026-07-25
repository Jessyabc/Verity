/**
 * Interactive swipe-to-chat — same physical feel as the shell menu / iOS back.
 *
 * Chat sits behind on the right. A leftward drag that begins on the right half
 * of the screen pushes the company profile away and reveals chat underneath,
 * following the finger. Completing the gesture navigates into the real chat
 * route with no second animation.
 *
 * Left half stays free for the native edge-back gesture.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Dimensions, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'

import { VerityMark } from '@/components/VerityMark'
import { font, space } from '@/constants/theme'
import type { AdaptiveBrandTokens } from '@/hooks/useAdaptiveBrand'

const SCREEN_WIDTH = Dimensions.get('window').width
const MID_X = SCREEN_WIDTH * 0.5
const OPEN_DISTANCE = SCREEN_WIDTH
const OPEN_THRESHOLD = SCREEN_WIDTH * 0.28
const VELOCITY_OPEN = -550
const SPRING = { damping: 28, stiffness: 280, mass: 0.9 }

type Props = {
  enabled: boolean
  brand: AdaptiveBrandTokens
  companyName: string
  onOpenChat: () => void | Promise<void>
  children: React.ReactNode
}

export function CompanyChatReveal({
  enabled,
  brand,
  companyName,
  onOpenChat,
  children,
}: Props) {
  const insets = useSafeAreaInsets()
  const dragX = useSharedValue(0)
  const startDragX = useSharedValue(0)
  const touchStartX = useSharedValue(0)
  const touchStartY = useSharedValue(0)
  const openingRef = useRef(false)
  const onOpenChatRef = useRef(onOpenChat)
  onOpenChatRef.current = onOpenChat

  // Reset if the user navigates back onto this screen after a completed reveal.
  useEffect(() => {
    dragX.value = 0
    openingRef.current = false
  }, [dragX])

  const finishOpen = useCallback(() => {
    if (openingRef.current) return
    openingRef.current = true
    void (async () => {
      try {
        await onOpenChatRef.current()
        // Stay fully revealed — the chat route replaces this screen with animation: 'none'.
      } catch {
        dragX.value = withSpring(0, SPRING)
        openingRef.current = false
      }
    })()
  }, [dragX])

  const hapticLight = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
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

          // Left half → native back / scroll; do not steal.
          if (touchStartX.value < MID_X) {
            state.fail()
            return
          }

          // Vertical intent → scroll wins.
          if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) {
            state.fail()
            return
          }

          // Right half + leftward → reveal chat.
          if (dx < -18) {
            state.activate()
            return
          }

          // Rightward from right half → not our gesture.
          if (dx > 18) {
            state.fail()
          }
        })
        .onStart(() => {
          startDragX.value = dragX.value
        })
        .onUpdate((e) => {
          const next = Math.min(0, Math.max(-OPEN_DISTANCE, startDragX.value + e.translationX))
          dragX.value = next
        })
        .onEnd((e) => {
          const shouldOpen =
            dragX.value < -OPEN_THRESHOLD || e.velocityX < VELOCITY_OPEN

          if (shouldOpen) {
            runOnJS(hapticLight)()
            dragX.value = withTiming(
              -OPEN_DISTANCE,
              { duration: 220, easing: Easing.out(Easing.cubic) },
              (finished) => {
                if (finished) runOnJS(finishOpen)()
              },
            )
          } else {
            dragX.value = withSpring(0, SPRING)
          }
        }),
    [dragX, enabled, finishOpen, hapticLight, startDragX, touchStartX, touchStartY],
  )

  const companyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: dragX.value < -4 ? 0.28 : 0,
    shadowRadius: 20,
    elevation: dragX.value < -4 ? 18 : 0,
  }))

  const chatStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: OPEN_DISTANCE + dragX.value }],
  }))

  if (!enabled) {
    return <View style={styles.root}>{children}</View>
  }

  return (
    <View style={[styles.root, { backgroundColor: brand.navy }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.chatLayer, { backgroundColor: brand.navy }, chatStyle]}
      >
        <View style={[styles.chatPeek, { paddingTop: insets.top + 56 }]}>
          <VerityMark size={28} />
          <Text style={[styles.chatPeekTitle, { color: brand.onNavy }]}>Afaqi</Text>
          <Text style={[styles.chatPeekSub, { color: brand.onNavyMuted }]} numberOfLines={2}>
            {companyName}
          </Text>
          <Text style={[styles.chatPeekHint, { color: brand.onNavySubtle }]}>
            Conversation ready
          </Text>
        </View>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.companyLayer, companyStyle]} collapsable={false}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  chatLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  chatPeek: {
    flex: 1,
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  chatPeekTitle: {
    fontFamily: font.semi,
    fontSize: 28,
    letterSpacing: -0.4,
    marginTop: space.md,
  },
  chatPeekSub: {
    fontFamily: font.regular,
    fontSize: 16,
  },
  chatPeekHint: {
    fontFamily: font.regular,
    fontSize: 13,
    marginTop: space.sm,
  },
  companyLayer: {
    flex: 1,
    zIndex: 1,
  },
})
