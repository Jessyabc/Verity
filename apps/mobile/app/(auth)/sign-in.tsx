import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
} from 'react-native'

import { Text, View } from '@/components/Themed'
import { useAuth } from '@/contexts/AuthContext'
import { palette } from '@/constants/theme'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function SignInScreen() {
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
      <View style={styles.center}>
        <Text style={styles.title}>Configure Supabase</Text>
        <Text style={styles.hint}>
          Copy apps/mobile/.env.example to apps/mobile/.env and set EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart Expo.
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.hint}>
          Sign in to monitor filings, press releases, and investor relations documents from your
          watchlist companies.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="you@company.com"
          placeholderTextColor="#888"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />

        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={() => void onSignIn()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <RNText style={styles.buttonText}>Sign in with password</RNText>
          )}
        </Pressable>

        <Pressable
          style={[styles.secondaryBtn, busy && styles.buttonDisabled]}
          onPress={() => void onSignUp()}
          disabled={busy}
        >
          <RNText style={styles.secondaryBtnText}>Create account</RNText>
        </Pressable>

        {message ? <RNText style={styles.success}>{message}</RNText> : null}
        {error ? <RNText style={styles.err}>{error}</RNText> : null}

        <Pressable
          style={styles.linkRow}
          onPress={() => setShowMagicLink((v) => !v)}
          disabled={busy}
        >
          <RNText style={styles.linkText}>
            {showMagicLink ? '▼ Hide magic link option' : '▶ Sign in with magic link instead'}
          </RNText>
        </Pressable>

        {showMagicLink ? (
          <View style={styles.magicBox}>
            <Text style={styles.magicHint}>
              {"We'll send a sign-in link to your email. Tap it on this device to open the app and sign in instantly — no password needed."}
            </Text>
            <Pressable
              style={[styles.outlineBtn, busy && styles.buttonDisabled]}
              onPress={() => void onMagicLink()}
              disabled={busy}
            >
              <RNText style={styles.outlineBtnText}>Send magic link</RNText>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.small}>
          Verity monitors official company sources only. Content is for informational purposes and
          is not investment advice.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  hint: { fontSize: 15, opacity: 0.8, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: palette.accent,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: palette.accent },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  success: { marginTop: 16, color: '#15803d', fontSize: 14 },
  err: { marginTop: 16, color: '#b91c1c', fontSize: 14 },
  linkRow: { marginTop: 24, paddingVertical: 8 },
  linkText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  magicBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  magicHint: { fontSize: 13, opacity: 0.85, marginBottom: 12 },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#64748b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  outlineBtnText: { fontSize: 15, fontWeight: '600' },
  small: { marginTop: 20, fontSize: 12, opacity: 0.65 },
})
