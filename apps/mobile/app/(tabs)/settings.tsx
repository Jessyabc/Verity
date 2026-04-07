import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useThemePreference, type ThemePreference } from '@/contexts/ThemePreferenceContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font, radius, space } from '@/constants/theme'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
]

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { preference, setPreference } = useThemePreference()
  const router = useRouter()
  const tabBarHeight = useBottomTabBarHeight()
  const styles = buildStyles()

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.canvas }]}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingBottom: insets.bottom + tabBarHeight + space.lg,
        paddingHorizontal: space.lg,
      }}
    >
      <Text style={[styles.kicker, { color: colors.inkSubtle }]}>SETTINGS</Text>
      <Text style={[styles.h1, { color: colors.ink }]}>Preferences</Text>
      <Text style={[styles.lede, { color: colors.inkMuted }]}>
        Appearance uses a frosted navigation bar on iOS. Auto follows the system setting.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.glassRow,
          {
            marginTop: space.xl,
            backgroundColor: colors.surfaceSolid,
            borderColor: colors.stroke,
            opacity: pressed ? 0.95 : 1,
          },
        ]}
        onPress={() => router.push('/profile')}
      >
        <View>
          <Text style={[styles.rowEyebrow, { color: colors.inkSubtle }]}>Account</Text>
          <Text style={[styles.rowTitle, { color: colors.ink }]}>Profile & sign out</Text>
          <Text style={[styles.rowSub, { color: colors.inkMuted }]}>Email and session</Text>
        </View>
        <Text style={[styles.chevron, { color: colors.inkSubtle }]}>›</Text>
      </Pressable>

      <Text style={[styles.sectionLabel, { color: colors.inkSubtle }]}>APPEARANCE</Text>
      <View
        style={[
          styles.segmentWrap,
          {
            backgroundColor: colors.accentSoft,
            borderColor: colors.stroke,
          },
        ]}
      >
        {OPTIONS.map(({ value, label }) => {
          const active = preference === value
          return (
            <Pressable
              key={value}
              style={[
                styles.segmentBtn,
                active && {
                  backgroundColor: colors.surfaceSolid,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.08,
                  shadowRadius: 3,
                  elevation: 2,
                },
              ]}
              onPress={() => setPreference(value)}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: active ? colors.ink : colors.inkMuted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <View
        style={[
          styles.note,
          {
            marginTop: space.xl,
            backgroundColor: colors.surfaceSolid,
            borderColor: colors.stroke,
          },
        ]}
      >
        <Text style={[styles.noteText, { color: colors.inkSubtle }]}>
          Notification and research automation preferences for mobile ship with the same backend
          controls as the web app (see BUILD.md). This screen focuses on how Verity looks on your
          device.
        </Text>
      </View>
    </ScrollView>
  )
}

function buildStyles() {
  return StyleSheet.create({
    screen: { flex: 1 },
    kicker: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8 },
    h1: { fontFamily: font.semi, fontSize: 28, letterSpacing: -0.6, marginTop: space.xs },
    lede: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: space.sm },
    glassRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: space.md,
    },
    rowEyebrow: { fontFamily: font.medium, fontSize: 11, letterSpacing: 0.6 },
    rowTitle: { fontFamily: font.semi, fontSize: 17, marginTop: 4 },
    rowSub: { fontFamily: font.regular, fontSize: 14, marginTop: 4 },
    chevron: { fontSize: 26, marginTop: -4 },
    sectionLabel: {
      fontFamily: font.medium,
      fontSize: 11,
      letterSpacing: 1.6,
      marginTop: space.xl,
      marginBottom: space.sm,
    },
    segmentWrap: {
      flexDirection: 'row',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: 4,
      gap: 4,
    },
    segmentBtn: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentText: { fontFamily: font.medium, fontSize: 14 },
    note: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: space.md,
    },
    noteText: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  })
}
