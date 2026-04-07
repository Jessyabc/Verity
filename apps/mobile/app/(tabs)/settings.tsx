/**
 * Settings screen — accessed via sidebar.
 * Includes appearance (theme) preferences from ThemePreferenceContext.
 */
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSidebar } from '@/components/Sidebar'
import { useThemePreference, type ThemePreference } from '@/contexts/ThemePreferenceContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font, radius, space } from '@/constants/theme'

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
]

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { open: openSidebar } = useSidebar()
  const { preference, setPreference } = useThemePreference()
  const router = useRouter()

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + space.md, borderBottomColor: colors.stroke },
        ]}
      >
        <Pressable style={styles.menuBtn} onPress={openSidebar} hitSlop={10}>
          <View style={styles.hamburger}>
            <View style={[styles.hLine, { backgroundColor: colors.ink }]} />
            <View style={[styles.hLine, { backgroundColor: colors.ink }]} />
            <View style={[styles.hLine, { backgroundColor: colors.ink, width: 15 }]} />
          </View>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Account */}
        <View style={[styles.section, { borderColor: colors.stroke, backgroundColor: colors.surfaceSolid }]}>
          <Text style={[styles.sectionTitle, { color: colors.inkSubtle }]}>ACCOUNT</Text>
          <Pressable
            style={({ pressed }) => [
              styles.row,
              { borderTopColor: colors.stroke, opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.ink }]}>Profile & sign out</Text>
              <Text style={[styles.rowSub, { color: colors.inkMuted }]}>Email and session</Text>
            </View>
            <Text style={[styles.chevron, { color: colors.inkSubtle }]}>›</Text>
          </Pressable>
        </View>

        {/* Appearance */}
        <View style={[styles.section, { borderColor: colors.stroke, backgroundColor: colors.surfaceSolid }]}>
          <Text style={[styles.sectionTitle, { color: colors.inkSubtle }]}>APPEARANCE</Text>
          <View style={[styles.segmentRow, { borderTopColor: colors.stroke }]}>
            <View
              style={[
                styles.segmentWrap,
                { backgroundColor: colors.accentSoft, borderColor: colors.stroke },
              ]}
            >
              {APPEARANCE_OPTIONS.map(({ value, label }) => {
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
          </View>
        </View>

        {/* Research */}
        <View style={[styles.section, { borderColor: colors.stroke, backgroundColor: colors.surfaceSolid }]}>
          <Text style={[styles.sectionTitle, { color: colors.inkSubtle }]}>RESEARCH</Text>
          <View style={[styles.row, { borderTopColor: colors.stroke }]}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Daily refresh</Text>
            <Text style={[styles.rowValue, { color: colors.inkMuted }]}>8:00 PM</Text>
          </View>
          <View style={[styles.row, { borderTopColor: colors.stroke }]}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Watchlist cap</Text>
            <Text style={[styles.rowValue, { color: colors.inkMuted }]}>15 companies</Text>
          </View>
          <View style={[styles.row, { borderTopColor: colors.stroke }]}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Model</Text>
            <Text style={[styles.rowValue, { color: colors.inkMuted }]}>Perplexity sonar-pro</Text>
          </View>
        </View>

        <Text style={[styles.disclaimer, { color: colors.inkSubtle }]}>
          Verity provides factual research only. Nothing here constitutes investment advice.
          Always verify information with primary sources before making financial decisions.
        </Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.md,
  },
  menuBtn:     { padding: 4 },
  hamburger:   { gap: 5 },
  hLine:       { width: 22, height: 1.5, borderRadius: 1 },
  headerTitle: { flex: 1, fontFamily: font.semi, fontSize: 18, letterSpacing: -0.3 },
  content:     { paddingTop: space.xl, paddingHorizontal: space.lg, gap: space.xl },
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontFamily: font.medium,
    fontSize: 11,
    letterSpacing: 1.6,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel:  { fontFamily: font.regular, fontSize: 16 },
  rowSub:    { fontFamily: font.regular, fontSize: 13, marginTop: 2 },
  rowValue:  { fontFamily: font.regular, fontSize: 14 },
  chevron:   { fontSize: 22 },
  segmentRow: {
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontFamily: font.medium, fontSize: 14 },
  disclaimer: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: space.md,
  },
})
