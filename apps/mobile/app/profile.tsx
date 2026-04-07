import { useRouter } from 'expo-router'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font, radius, space } from '@/constants/theme'

function initialsFromEmail(email: string | undefined): string {
  if (!email) return '?'
  const base = email.split('@')[0]?.trim() ?? ''
  const parts = base.split(/[._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  return base.slice(0, 2).toUpperCase() || '?'
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { user, signOut } = useAuth()
  const router = useRouter()
  const email = user?.email ?? ''
  const initials = initialsFromEmail(email)
  const styles = buildStyles()

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.canvas }]}
      contentContainerStyle={{
        paddingTop: insets.top + space.md,
        paddingBottom: insets.bottom + space.xl,
        paddingHorizontal: space.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.kicker, { color: colors.inkSubtle }]}>ACCOUNT</Text>
      <Text style={[styles.h1, { color: colors.ink }]}>Profile</Text>

      <View style={[styles.avatarWrap, { marginTop: space.lg }]}>
        <View style={[styles.avatarGlow, { backgroundColor: colors.accent }]} />
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: colors.canvas,
              borderColor: colors.stroke,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.ink }]}>{initials}</Text>
        </View>
      </View>

      <Text style={[styles.displayName, { color: colors.ink }]}>
        {email ? email.split('@')[0] : 'Signed in'}
      </Text>
      <Text style={[styles.email, { color: colors.inkMuted }]}>{email || '—'}</Text>

      <View
        style={[
          styles.card,
          {
            marginTop: space.xl,
            backgroundColor: colors.surfaceSolid,
            borderColor: colors.stroke,
          },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.inkSubtle }]}>User ID</Text>
        <Text style={[styles.mono, { color: colors.inkMuted }]} selectable>
          {user?.id ?? '—'}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.card,
          styles.rowPress,
          {
            marginTop: space.sm,
            backgroundColor: colors.surfaceSolid,
            borderColor: colors.stroke,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        onPress={() => router.push('/(tabs)/settings')}
      >
        <Text style={[styles.rowTitle, { color: colors.ink }]}>Settings</Text>
        <Text style={[styles.rowChevron, { color: colors.inkSubtle }]}>›</Text>
      </Pressable>

      <Text style={[styles.footnote, { color: colors.inkSubtle }]}>
        Session and preferences stay on this device until you add team or billing features.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.signOut,
          {
            borderColor: colors.danger,
            backgroundColor: pressed ? colors.accentSoft : 'transparent',
          },
        ]}
        onPress={() => void signOut()}
      >
        <Text style={[styles.signOutText, { color: colors.danger }]}>Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}

function buildStyles() {
  return StyleSheet.create({
    screen: { flex: 1 },
    kicker: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8 },
    h1: { fontFamily: font.semi, fontSize: 28, letterSpacing: -0.6, marginTop: space.xs },
    avatarWrap: { alignSelf: 'center', width: 96, height: 96 },
    avatarGlow: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: 48,
      opacity: 0.35,
      transform: [{ scale: 1.08 }],
    },
    avatar: {
      width: 96,
      height: 96,
      borderRadius: 48,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontFamily: font.semi, fontSize: 32, letterSpacing: -0.5 },
    displayName: {
      fontFamily: font.semi,
      fontSize: 20,
      textAlign: 'center',
      marginTop: space.lg,
    },
    email: {
      fontFamily: font.regular,
      fontSize: 15,
      textAlign: 'center',
      marginTop: 6,
    },
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: space.md,
    },
    rowLabel: { fontFamily: font.medium, fontSize: 12, marginBottom: 6 },
    mono: { fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
    rowPress: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    rowTitle: { fontFamily: font.semi, fontSize: 16 },
    rowChevron: { fontSize: 22, marginTop: -2 },
    footnote: {
      fontFamily: font.regular,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
      marginTop: space.lg,
      paddingHorizontal: space.md,
    },
    signOut: {
      marginTop: space.xl,
      borderRadius: radius.lg,
      borderWidth: 1,
      paddingVertical: space.md,
      alignItems: 'center',
    },
    signOutText: { fontFamily: font.semi, fontSize: 16 },
  })
}
