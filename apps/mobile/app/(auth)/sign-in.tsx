import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
} from 'react-native'

import { Text, View } from '@/components/Themed'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function SignInScreen() {
  const { signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async () => {
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
      <View style={styles.center}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.hint}>We’ll email you a magic link (no password).</Text>
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
        <Pressable
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={() => void onSubmit()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <RNText style={styles.buttonText}>Send magic link</RNText>
          )}
        </Pressable>
        {message ? <RNText style={styles.success}>{message}</RNText> : null}
        {error ? <RNText style={styles.err}>{error}</RNText> : null}
        <Text style={styles.small}>
          Add your redirect URL in Supabase (Auth → URL configuration), e.g. the value of
          verity://auth-callback for production builds.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  success: { marginTop: 16, color: '#15803d', fontSize: 14 },
  err: { marginTop: 16, color: '#b91c1c', fontSize: 14 },
  small: { marginTop: 24, fontSize: 12, opacity: 0.65 },
})
