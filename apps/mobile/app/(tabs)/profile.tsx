import { useRouter } from 'expo-router'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useSidebar } from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { supabase } from '@/lib/supabase'
import { font, radius, space } from '@/constants/theme'

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { open: openSidebar } = useSidebar()
  const { user } = useAuth()
  const router = useRouter()

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          router.replace('/(auth)/sign-in')
        },
      },
    ])
  }

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
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar placeholder */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.avatarLetter, { color: colors.accent }]}>
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={[styles.email, { color: colors.ink }]}>{user?.email ?? '—'}</Text>
          <Text style={[styles.plan, { color: colors.inkSubtle }]}>Verity Subscriber</Text>
        </View>

        <View
          style={[
            styles.section,
            { borderColor: colors.stroke, backgroundColor: colors.surfaceSolid },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.inkSubtle }]}>SUBSCRIPTION</Text>
          <View style={[styles.row, { borderTopColor: colors.stroke }]}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Plan</Text>
            <Text style={[styles.rowValue, { color: colors.inkMuted }]}>Paid</Text>
          </View>
          <View style={[styles.row, { borderTopColor: colors.stroke }]}>
            <Text style={[styles.rowLabel, { color: colors.ink }]}>Watchlist limit</Text>
            <Text style={[styles.rowValue, { color: colors.inkMuted }]}>15 companies</Text>
          </View>
        </View>

        <Pressable
          style={[styles.signOutBtn, { borderColor: colors.danger }]}
          onPress={handleSignOut}
        >
          <Text style={[styles.signOutText, { color: colors.danger }]}>Sign out</Text>
        </Pressable>
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
  avatarSection: { alignItems: 'center', gap: space.sm },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontFamily: font.semi, fontSize: 28 },
  email:        { fontFamily: font.semi, fontSize: 16 },
  plan:         { fontFamily: font.regular, fontSize: 13 },
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
  rowValue:  { fontFamily: font.regular, fontSize: 14 },
  signOutBtn: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  signOutText: { fontFamily: font.semi, fontSize: 15 },
})
