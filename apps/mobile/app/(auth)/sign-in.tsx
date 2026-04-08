import { useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { BlurView } from 'expo-blur'
import { StatusBar } from 'expo-status-bar'

import { VerityWordmark } from '@/components/VerityWordmark'
import { useAuth } from '@/contexts/AuthContext'
import { BRAND } from '@/constants/brand'
import { font, radius, space } from '@/constants/theme'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { isSupabaseConfigured } from '@/lib/supabase'
import { openUrl } from '@/lib/openUrl'

const PRIVACY_URL = 'https://verity.so/privacy'
const TERMS_URL = 'https://verity.so/terms'

export default function SignInScreen() {
  const palette = useVerityPalette()
  const { signInWithPassword, signUpWithPassword, signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMagicLink, setShowMagicLink] = useState(false)

  const onSignIn = async () => {
    setMessage(null)
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter email and password.')
      return
    }
    setBusy(true)
    const { error: err } = await signInWithPassword(email, password)
    setBusy(false)
    if (err) setError(err.message)
  }

  const onSignUp = async () => {
    setMessage(null)
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter email and password.')
      return
    }
    setBusy(true)
    const { error: err, hint } = await signUpWithPassword(email, password)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setMessage(hint ?? 'Account ready — you are signed in (or sign in after confirming email).')
  }

  const onMagicLink = async () => {
    setMessage(null)
    setError(null)
    if (!email.trim()) {
      setError('Enter your email.')
      return
    }
    setBusy(true)
    const { error: err } = await signInWithMagicLink(email)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setMessage('Check your email for the sign-in link.')
  }

  if (!isSupabaseConfigured()) {
    return (
      <View style={[styles.center, { backgroundColor: BRAND.navy }]}>
        <StatusBar style="light" />
        <Text style={[styles.title, { color: BRAND.onNavy }]}>Configure Supabase</Text>
        <Text style={[styles.hint, { color: BRAND.onNavyMuted }]}>
          Copy apps/mobile/.env.example to apps/mobile/.env and set EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.flex, { backgroundColor: BRAND.navy }]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <VerityWordmark height={36} />
            <Text style={[styles.tagline, { color: BRAND.tealLight }]}>
              Company · Media · The Gap
            </Text>
          </View>

          <Text style={[styles.lead, { color: BRAND.onNavyMuted }]}>
            Sign in to monitor filings, press releases, and investor relations from your watchlist
            companies.
          </Text>

          <BlurPill>
            <TextInput
              style={[styles.input, { color: BRAND.onNavy }]}
              placeholder="you@company.com"
              placeholderTextColor={BRAND.onNavySubtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
          </BlurPill>
          <BlurPill>
            <TextInput
              style={[styles.input, { color: BRAND.onNavy }]}
              placeholder="Password"
              placeholderTextColor={BRAND.onNavySubtle}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              editable={!busy}
            />
          </BlurPill>

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: BRAND.tealDark, opacity: pressed || busy ? 0.85 : 1 },
            ]}
            onPress={() => void onSignIn()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={BRAND.navy} />
            ) : (
              <Text style={[styles.primaryBtnLabel, { color: BRAND.navy }]}>
                Sign in with password
              </Text>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryPress, { opacity: pressed ? 0.75 : 1 }]}
            onPress={() => void onSignUp()}
            disabled={busy}
          >
            <Text style={[styles.secondaryLabel, { color: BRAND.tealLight }]}>Create account</Text>
          </Pressable>

          {message ? (
            <Text style={[styles.success, { color: BRAND.tealLight }]}>{message}</Text>
          ) : null}
          {error ? <Text style={[styles.err, { color: palette.danger }]}>{error}</Text> : null}

          <Pressable
            style={styles.linkRow}
            onPress={() => setShowMagicLink((v) => !v)}
            disabled={busy}
          >
            <Text style={[styles.linkText, { color: BRAND.onNavySubtle }]}>
              {showMagicLink ? '▼ Hide magic link option' : '▶ Sign in with magic link instead'}
            </Text>
          </Pressable>

          {showMagicLink ? (
            <BlurPill style={styles.magicBox}>
              <Text style={[styles.magicHint, { color: BRAND.onNavyMuted }]}>
                {"We'll send a sign-in link to your email. Tap it on this device to open the app and sign in instantly — no password needed."}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.outlineBtn,
                  { borderColor: BRAND.tealLight, opacity: pressed || busy ? 0.85 : 1 },
                ]}
                onPress={() => void onMagicLink()}
                disabled={busy}
              >
                <Text style={[styles.outlineBtnText, { color: BRAND.tealLight }]}>
                  Send magic link
                </Text>
              </Pressable>
            </BlurPill>
          ) : null}

          <Text style={[styles.small, { color: BRAND.onNavySubtle }]}>
            Verity monitors official company sources only. Content is for informational purposes and
            is not investment advice.
          </Text>

          <View style={styles.legalRow}>
            <Pressable onPress={() => void openUrl(PRIVACY_URL)}>
              <Text style={[styles.legalLink, { color: BRAND.tealLight }]}>Privacy Policy</Text>
            </Pressable>
            <Text style={[styles.legalSep, { color: BRAND.onNavySubtle }]}>·</Text>
            <Pressable onPress={() => void openUrl(TERMS_URL)}>
              <Text style={[styles.legalLink, { color: BRAND.tealLight }]}>Terms of Use</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

function BlurPill({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <BlurView intensity={40} tint="dark" style={[styles.fieldShell, style]}>
      <View style={[styles.fieldInner, { backgroundColor: BRAND.glassNavy }]}>{children}</View>
    </BlurView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    padding: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.xxl * 2,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    padding: space.xl,
    justifyContent: 'center',
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
  },
  brandBlock: {
    marginBottom: space.lg,
    gap: space.sm,
  },
  tagline: {
    fontFamily: font.medium,
    fontSize: 13,
    letterSpacing: 0.4,
  },
  title: { fontFamily: font.bold, fontSize: 22, marginBottom: space.sm },
  lead: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: space.xl,
  },
  fieldShell: {
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BRAND.stroke,
  },
  fieldInner: {
    borderRadius: radius.md - 1,
    overflow: 'hidden',
  },
  input: {
    fontFamily: font.regular,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 16,
  },
  primaryBtn: {
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.sm,
  },
  primaryBtnLabel: {
    fontFamily: font.semi,
    fontSize: 16,
  },
  secondaryPress: {
    marginTop: space.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontFamily: font.semi,
    fontSize: 15,
  },
  success: { marginTop: space.lg, fontFamily: font.regular, fontSize: 14 },
  err: { marginTop: space.lg, fontFamily: font.regular, fontSize: 14 },
  hint: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  linkRow: { marginTop: space.xl, paddingVertical: space.sm },
  linkText: { fontFamily: font.semi, fontSize: 14 },
  magicBox: {
    marginTop: space.sm,
    padding: space.lg,
  },
  magicHint: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginBottom: space.md },
  outlineBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  outlineBtnText: { fontFamily: font.semi, fontSize: 15 },
  small: { marginTop: space.xl, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.md,
    gap: 6,
  },
  legalLink: { fontFamily: font.medium, fontSize: 12, textDecorationLine: 'underline' },
  legalSep: { fontSize: 12 },
})