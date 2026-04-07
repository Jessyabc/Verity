import { useRouter } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSidebar } from '@/components/Sidebar'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font, radius, space } from '@/constants/theme'

export default function SettingsScreen() {
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { open: openSidebar } = useSidebar()
  const router = useRouter()

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
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
        <View style={[styles.section, { borderColor: colors.stroke, backgroundColor: colors.surfaceSolid }]}>
          <Text style={[styles.sectionTitle, { color: colors.inkSubtle }]}>ACCOUNT</Text>

          <Pressable
            style={[styles.row, { borderTopColor: colors.stroke }]}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Profile</Text>
            <Text style={[styles.rowChevron, { color: colors.inkSubtle }]}>›</Text>
          </Pressable>
        </View>

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
        </View>

        <View style={[styles.section, { borderColor: colors.stroke, backgroundColor: colors.surfaceSolid }]}>
          <Text style={[styles.sectionTitle, { color: colors.inkSubtle }]}>ABOUT</Text>

          <View style={[styles.row, { borderTopColor: colors.stroke }]}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Version</Text>
            <Text style={[styles.rowValue, { color: colors.inkMuted }]}>1.0</Text>
          </View>
          <View style={[styles.row, { borderTopColor: colors.stroke }]}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Model</Text>
            <Text style={[styles.rowValue, { color: colors.inkMuted }]}>Perplexity sonar-pro</Text>
          </View>
        </View>

        <Text style={[styles.disclaimer, { color: colors.inkSubtle }]}>
          Verity provides factual research only. Nothing on this app constitutes investment
          advice. Always verify information with primary sources before making financial decisions.
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
  rowLabel:   { fontFamily: font.regular, fontSize: 16 },
  rowValue:   { fontFamily: font.regular, fontSize: 14 },
  rowChevron: { fontFamily: font.regular, fontSize: 20 },
  disclaimer: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: space.md,
  },
})
