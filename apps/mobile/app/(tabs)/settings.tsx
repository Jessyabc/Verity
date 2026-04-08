/**
 * Account & settings — profile, username, appearance, subscription info, sign out (single hub).
 */
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Ionicons from '@expo/vector-icons/Ionicons'
import { useSidebar } from '@/components/Sidebar'
import { VerityMark } from '@/components/VerityMark'
import { useAuth } from '@/contexts/AuthContext'
import { useThemePreference, type ThemePreference } from '@/contexts/ThemePreferenceContext'
import { BRAND } from '@/constants/brand'
import { font, radius, space } from '@/constants/theme'
import { formatUnknownError } from '@/lib/format'
import { supabase } from '@/lib/supabase'

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
]

function readUsername(meta: Record<string, unknown> | undefined): string {
  const u = meta?.username
  return typeof u === 'string' ? u : ''
}

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets()
  const { open: openSidebar } = useSidebar()
  const { preference, setPreference } = useThemePreference()
  const { user } = useAuth()
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [nameSaved, setNameSaved] = useState(false)

  useEffect(() => {
    setUsername(readUsername(user?.user_metadata as Record<string, unknown> | undefined))
    setNameError(null)
    setNameSaved(false)
  }, [user?.id, user?.user_metadata])

  const saveUsername = useCallback(async () => {
    const next = username.trim()
    if (next.length > 40) {
      setNameError('Username must be 40 characters or fewer.')
      return
    }
    setSavingName(true)
    setNameError(null)
    setNameSaved(false)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { username: next || null },
      })
      if (error) throw error
      setNameSaved(true)
    } catch (e) {
      setNameError(formatUnknownError(e))
    } finally {
      setSavingName(false)
    }
  }, [username])

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

  const displayInitial =
    (username.trim()[0] ?? user?.email?.[0] ?? '?').toUpperCase()

  return (
    <View style={[styles.screen, { backgroundColor: BRAND.navy }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + space.md, borderBottomColor: BRAND.stroke },
        ]}
      >
        <Pressable style={styles.menuBtn} onPress={openSidebar} hitSlop={10} accessibilityLabel="Open menu">
          <Ionicons name="menu-outline" size={26} color={BRAND.tealLight} />
        </Pressable>
        <VerityMark size={28} />
        <Text style={[styles.headerTitle, { color: BRAND.onNavy }]}>Account</Text>
        <View style={{ width: 8 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(92, 154, 154, 0.25)' }]}>
            <Text style={[styles.avatarLetter, { color: BRAND.onNavy }]}>{displayInitial}</Text>
          </View>
          <Text style={[styles.email, { color: BRAND.onNavyMuted }]}>{user?.email ?? '—'}</Text>
        </View>

        <View style={[styles.section, { borderColor: BRAND.stroke }]}>
          <Text style={[styles.sectionKicker, { color: BRAND.tealLight }]}>PROFILE</Text>
          <Text style={[styles.label, { color: BRAND.onNavySubtle }]}>Username</Text>
          <TextInput
            value={username}
            onChangeText={(t) => {
              setUsername(t)
              setNameSaved(false)
            }}
            placeholder="How should we greet you?"
            placeholderTextColor={BRAND.onNavyMuted}
            style={[
              styles.input,
              {
                color: BRAND.onNavy,
                borderColor: BRAND.stroke,
                backgroundColor: BRAND.glassNavy,
              },
            ]}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={40}
            editable={!savingName}
          />
          {nameError ? (
            <Text style={[styles.inlineErr, { color: '#f87171' }]}>{nameError}</Text>
          ) : null}
          {nameSaved ? (
            <Text style={[styles.inlineOk, { color: BRAND.tealLight }]}>Saved</Text>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: BRAND.tealDark, opacity: pressed || savingName ? 0.85 : 1 },
            ]}
            onPress={() => void saveUsername()}
            disabled={savingName}
          >
            {savingName ? (
              <ActivityIndicator color={BRAND.onNavy} />
            ) : (
              <Text style={styles.primaryBtnText}>Save username</Text>
            )}
          </Pressable>
        </View>

        <View style={[styles.section, { borderColor: BRAND.stroke }]}>
          <Text style={[styles.sectionKicker, { color: BRAND.tealLight }]}>APPEARANCE</Text>
          <View style={[styles.segmentWrap, { backgroundColor: BRAND.glassNavy, borderColor: BRAND.stroke }]}>
            {APPEARANCE_OPTIONS.map(({ value, label }) => {
              const active = preference === value
              return (
                <Pressable
                  key={value}
                  style={[
                    styles.segmentBtn,
                    active && { backgroundColor: 'rgba(140, 198, 192, 0.22)' },
                  ]}
                  onPress={() => setPreference(value)}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? BRAND.onNavy : BRAND.onNavyMuted },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View style={[styles.section, { borderColor: BRAND.stroke }]}>
          <Text style={[styles.sectionKicker, { color: BRAND.tealLight }]}>PLAN & RESEARCH</Text>
          <View style={[styles.row, { borderTopColor: BRAND.stroke }]}>
            <Text style={[styles.rowLabel, { color: BRAND.onNavy }]}>Plan</Text>
            <Text style={[styles.rowValue, { color: BRAND.onNavyMuted }]}>Subscriber</Text>
          </View>
          <View style={[styles.row, { borderTopColor: BRAND.stroke }]}>
            <Text style={[styles.rowLabel, { color: BRAND.onNavy }]}>Watchlist cap</Text>
            <Text style={[styles.rowValue, { color: BRAND.onNavyMuted }]}>15 companies</Text>
          </View>
          <View style={[styles.row, { borderTopColor: BRAND.stroke }]}>
            <Text style={[styles.rowLabel, { color: BRAND.onNavy }]}>Daily refresh</Text>
            <Text style={[styles.rowValue, { color: BRAND.onNavyMuted }]}>8:00 PM</Text>
          </View>
          <View style={[styles.row, { borderTopColor: BRAND.stroke }]}>
            <Text style={[styles.rowLabel, { color: BRAND.onNavy }]}>Model</Text>
            <Text style={[styles.rowValue, { color: BRAND.onNavyMuted }]}>Perplexity sonar-pro</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.signOutBtn,
            { borderColor: '#f87171', opacity: pressed ? 0.88 : 1 },
          ]}
          onPress={handleSignOut}
        >
          <Text style={[styles.signOutText, { color: '#f87171' }]}>Sign out</Text>
        </Pressable>

        <Text style={[styles.disclaimer, { color: BRAND.onNavySubtle }]}>
          Verity provides factual research only. Nothing here constitutes investment advice. Always verify with
          primary sources.
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
    gap: space.sm,
  },
  menuBtn: { padding: 4, marginRight: 2 },
  headerTitle: { flex: 1, fontFamily: font.semi, fontSize: 18, letterSpacing: -0.3 },
  content: { paddingTop: space.xl, paddingHorizontal: space.lg, gap: space.xl },

  avatarSection: { alignItems: 'center', gap: space.sm },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontFamily: font.semi, fontSize: 28 },
  email: { fontFamily: font.regular, fontSize: 14, textAlign: 'center' },

  section: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    gap: space.sm,
  },
  sectionKicker: {
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 0.9,
    marginBottom: space.xs,
  },
  label: { fontFamily: font.medium, fontSize: 12, marginTop: space.xs },
  input: {
    fontFamily: font.regular,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    marginTop: 6,
  },
  inlineErr: { fontFamily: font.regular, fontSize: 13, marginTop: 4 },
  inlineOk: { fontFamily: font.regular, fontSize: 13, marginTop: 4 },
  primaryBtn: {
    marginTop: space.md,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: font.semi, fontSize: 15, color: BRAND.onNavy },

  segmentWrap: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
    marginTop: space.xs,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontFamily: font.medium, fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontFamily: font.regular, fontSize: 16 },
  rowValue: { fontFamily: font.regular, fontSize: 14 },

  signOutBtn: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  signOutText: { fontFamily: font.semi, fontSize: 15 },

  disclaimer: {
    fontFamily: font.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: space.md,
  },
})
