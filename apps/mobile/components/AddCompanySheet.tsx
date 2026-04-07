/**
 * AddCompanySheet — lets the app owner add new companies to the tracking universe.
 *
 * Calls admin-upsert-company edge function (requires ADMIN_EMAIL to match
 * the signed-in user's email). On success it navigates to the new company profile.
 */

import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { useVerityPalette } from '@/hooks/useVerityPalette'
import { formatUnknownError } from '@/lib/format'
import { supabase } from '@/lib/supabase'
import { font, radius, space } from '@/constants/theme'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

type Props = {
  visible: boolean
  onClose: () => void
  onSuccess: (slug: string) => void
}

export function AddCompanySheet({ visible, onClose, onSuccess }: Props) {
  const colors = useVerityPalette()

  const [name, setName]       = useState('')
  const [ticker, setTicker]   = useState('')
  const [url, setUrl]         = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const reset = () => {
    setName('')
    setTicker('')
    setUrl('')
    setError(null)
    setBusy(false)
  }

  const close = () => { reset(); onClose() }

  const submit = async () => {
    const trimName   = name.trim()
    const trimUrl    = url.trim()
    const trimTicker = ticker.trim().toUpperCase() || null

    if (!trimName) { setError('Company name is required.'); return }
    if (!trimUrl)  { setError('Website or IR URL is required.'); return }
    if (!trimUrl.startsWith('http')) { setError('URL must start with https://'); return }

    const slug = toSlug(trimName)
    if (!slug) { setError('Company name produced an empty slug — try a different name.'); return }

    setError(null)
    setBusy(true)

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('admin-upsert-company', {
        body: {
          slug,
          name: trimName,
          ticker: trimTicker,
          sourceKey: 'web',
          sourceLabel: trimTicker ? 'Investor Relations' : 'Website',
          baseUrl: trimUrl,
        },
      })

      if (fnErr) throw new Error(fnErr.message ?? 'Edge function error')
      if (data?.error) throw new Error(data.error)

      reset()
      onSuccess(slug)
    } catch (e) {
      setError(formatUnknownError(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.canvas }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.kicker, { color: colors.inkSubtle }]}>TRACK A COMPANY</Text>
              <Text style={[styles.title, { color: colors.ink }]}>Add company</Text>
            </View>
            <Pressable onPress={close} hitSlop={12}>
              <Text style={[styles.closeBtn, { color: colors.accent }]}>Cancel</Text>
            </Pressable>
          </View>

          <Text style={[styles.hint, { color: colors.inkMuted }]}>
            Enter the company details and its investor relations or corporate website URL. Verity will monitor it for new documents and filings.
          </Text>

          {/* Fields */}
          <Text style={[styles.label, { color: colors.inkSubtle }]}>COMPANY NAME *</Text>
          <TextInput
            style={[styles.input, { color: colors.ink, borderColor: colors.stroke, backgroundColor: colors.surfaceSolid }]}
            placeholder="e.g. Apple Inc."
            placeholderTextColor={colors.inkSubtle}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            editable={!busy}
          />

          <Text style={[styles.label, { color: colors.inkSubtle }]}>TICKER (optional)</Text>
          <TextInput
            style={[styles.input, { color: colors.ink, borderColor: colors.stroke, backgroundColor: colors.surfaceSolid }]}
            placeholder="e.g. AAPL"
            placeholderTextColor={colors.inkSubtle}
            value={ticker}
            onChangeText={setTicker}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
          />

          <Text style={[styles.label, { color: colors.inkSubtle }]}>WEBSITE OR IR URL *</Text>
          <TextInput
            style={[styles.input, { color: colors.ink, borderColor: colors.stroke, backgroundColor: colors.surfaceSolid }]}
            placeholder="https://investor.apple.com"
            placeholderTextColor={colors.inkSubtle}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!busy}
          />

          {name.trim() ? (
            <Text style={[styles.slugPreview, { color: colors.inkSubtle }]}>
              Slug: {toSlug(name.trim()) || '—'}
            </Text>
          ) : null}

          {error ? (
            <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
          ) : null}

          <Pressable
            style={[styles.submitBtn, { backgroundColor: busy ? colors.accentSoft : colors.accent }]}
            onPress={() => void submit()}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Add company</Text>
            )}
          </Pressable>

          <Text style={[styles.footnote, { color: colors.inkSubtle }]}>
            Requires admin access. Research will populate after the first monitoring run.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content:   { padding: space.xl, paddingBottom: 60 },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  kicker:   { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8, marginBottom: space.xs },
  title:    { fontFamily: font.bold, fontSize: 26, letterSpacing: -0.6 },
  closeBtn: { fontFamily: font.semi, fontSize: 16, paddingTop: 4 },

  hint: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: space.xl,
  },

  label: {
    fontFamily: font.medium,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: space.sm,
    marginTop: space.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 13,
    fontFamily: font.regular,
    fontSize: 16,
  },

  slugPreview: {
    fontFamily: 'Courier',
    fontSize: 12,
    marginTop: space.sm,
    opacity: 0.7,
  },

  error: {
    fontFamily: font.regular,
    fontSize: 14,
    marginTop: space.md,
    lineHeight: 20,
  },

  submitBtn: {
    marginTop: space.xl,
    borderRadius: radius.md,
    paddingVertical: space.md + 2,
    alignItems: 'center',
  },
  submitBtnText: { fontFamily: font.semi, color: '#fff', fontSize: 16 },

  footnote: {
    fontFamily: font.regular,
    fontSize: 12,
    marginTop: space.md,
    textAlign: 'center',
    opacity: 0.7,
  },
})
