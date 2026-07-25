/**
 * Right-half swipe → open the existing Afaqi conversation screen.
 *
 * Does not invent a placeholder chat page. The company profile can follow the
 * finger slightly, then we push the real `/chat/...` route (same screen the
 * CTA uses). Left half stays free for native edge-back.
 */

import { useCallback, useMemo, useRef } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

const SCREEN_WIDTH = Dimensions.get('window').width
const MID_X = SCREEN_WIDTH * 0.5
/** Max drag while previewing — not a full fake screen. */
const DRAG_CAP = SCREEN_WIDTH * 0.35
const OPEN_THRESHOLD = SCREEN_WIDTH * 0.18
const VELOCITY_OPEN = -550
const SPRING = { damping: 28, stiffness: 280, mass: 0.9 }

type Props = {
  enabled: boolean
  onOpenChat: () => void | Promise<void>
  children: React.ReactNode
}

export function CompanyChatReveal({ enabled, onOpenChat, children }: Props) {
  const dragX = useSharedValue(0)
  const startDragX = useSharedValue(0)
  const touchStartX = useSharedValue(0)
  const touchStartY = useSharedValue(0)
  const openingRef = useRef(false)
  const onOpenChatRef = useRef(onOpenChat)
  onOpenChatRef.current = onOpenChat

  const reset = useCallback(() => {
    dragX.value = 0
    openingRef.current = false
  }, [dragX])

  // Company stays under chat in the stack — always restore when we come back.
  useFocusEffect(
    useCallback(() => {
      reset()
    }, [reset]),
  )

  const finishOpen = useCallback(() => {
    if (openingRef.current) return
    openingRef.current = true
    // Snap profile back underneath; the real chat route animates on top.
    dragX.value = withSpring(0, SPRING)
    void (async () => {
      try {
        await onOpenChatRef.current()
      } catch {
        /* stay on profile */
      } finally {
        openingRef.current = false
        dragX.value = 0
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

          if (touchStartX.value < MID_X) {
            state.fail()
            return
          }
          if (Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) {
            state.fail()
            return
          }
          if (dx < -18) {
            state.activate()
            return
          }
          if (dx > 18) {
            state.fail()
          }
        })
        .onStart(() => {
          startDragX.value = dragX.value
        })
        .onUpdate((e) => {
          const next = Math.min(0, Math.max(-DRAG_CAP, startDragX.value + e.translationX))
          dragX.value = next
        })
        .onEnd((e) => {
          const shouldOpen = dragX.value < -OPEN_THRESHOLD || e.velocityX < VELOCITY_OPEN
          if (shouldOpen) {
            runOnJS(hapticLight)()
            runOnJS(finishOpen)()
          } else {
            dragX.value = withSpring(0, SPRING)
          }
        }),
    [dragX, enabled, finishOpen, hapticLight, startDragX, touchStartX, touchStartY],
  )

  const companyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
  }))

  if (!enabled) {
    return <View style={styles.root}>{children}</View>
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.root, companyStyle]} collapsable={false}>
        {children}
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
