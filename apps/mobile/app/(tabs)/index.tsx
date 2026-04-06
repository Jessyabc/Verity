/**
 * Discover — the signed-in home screen.
 *
 * Layout (top → bottom):
 *  1. "Verity" wordmark + tagline
 *  2. Liquid Glass search bar — expands inline with results when focused
 *  3. Industry digest — cross-portfolio synthesis from watchlist
 */

import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LiquidGlassView } from '@/components/LiquidGlass'
import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { useWatchlistDigest } from '@/hooks/useWatchlistDigest'
import { searchCompanies, type SearchCompanyRow } from '@/lib/companySearch'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { fetchWatchlistSlugs } from '@/lib/watchlistApi'
import { font, space } from '@/constants/theme'
import type { DigestSource } from '@/lib/watchlistDigest'

const SEARCH_RESULTS_MAX_HEIGHT = 340

// ─── Source type pill ────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  paper:   '#4f46e5',
  filing:  '#0f766e',
  report:  '#b45309',
  news:    '#475569',
}

function SourcePill({ type }: { type: string }) {
  return (
    <Text style={[styles.pill, { backgroundColor: SOURCE_COLORS[type] ?? '#475569' }]}>
      {type.toUpperCase()}
    </Text>
  )
}

// ─── Digest section ───────────────────────────────────────────────────────

type DigestProps = {
  digestText: string
  sources: DigestSource[]
  generating: boolean
  colors: ReturnType<typeof useVerityPalette>
}

function DigestSection({ digestText, sources, generating, colors }: DigestProps) {
  if (generating && !digestText) {
    return (
      <View style={styles.digestGenerating}>
        <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: space.sm }} />
        <Text style={[styles.digestGeneratingText, { color: colors.inkMuted }]}>
          Synthesizing your portfolio…
        </Text>
      </View>
    )
  }

  if (!digestText) return null

  return (
    <View style={styles.digestContainer}>
      <View style={styles.digestHeader}>
        <Text style={[styles.digestKicker, { color: colors.inkSubtle }]}>YOUR WORLD</Text>
        {generating ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      </View>
      <Text style={[styles.digestTitle, { color: colors.ink }]}>{"What's happening"}</Text>
      <Text style={[styles.digestBody, { color: colors.inkMuted }]}>{digestText}</Text>

      {sources.length > 0 ? (
        <View style={styles.sourcesContainer}>
          <Text style={[styles.sourcesKicker, { color: colors.inkSubtle }]}>SOURCES</Text>
          {sources.map((s, i) => (
            <Pressable
              key={`${s.url}-${i}`}
              onPress={() => void Linking.openURL(s.url)}
              style={[styles.sourceRow, { borderTopColor: colors.stroke }]}
            >
              <View style={styles.sourceRowTop}>
                <SourcePill type={s.type} />
                <Text style={[styles.sourceTitle, { color: colors.accent }]} numberOfLines={2}>
                  {s.title}
                </Text>
              </View>
              {s.relevance ? (
                <Text style={[styles.sourceRelevance, { color: colors.inkMuted }]}>
                  {s.relevance}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={[styles.disclaimer, { color: colors.inkSubtle }]}>
        AI synthesis · not investment advice
      </Text>
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const colors   = useVerityPalette()
  const { user } = useAuth()

  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SearchCompanyRow[]>([])
  const [searching, setSearching]   = useState(false)
  const [isFocused, setIsFocused]   = useState(false)
  const [watchlistSlugs, setWatchlistSlugs] = useState<string[]>([])

  const inputRef  = useRef<TextInput>(null)
  const panelAnim = useRef(new Animated.Value(0)).current

  const { digest, loading: digestLoading } = useWatchlistDigest(
    user?.id ?? null,
    watchlistSlugs,
  )

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return
    void fetchWatchlistSlugs(supabase).then(setWatchlistSlugs).catch(() => {})
  }, [user])

  const runSearch = useCallback(async (q: string) => {
    if (!isSupabaseConfigured()) return
    setSearching(true)
    try {
      const rows = await searchCompanies(q, 20)
      setResults(rows)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (!isFocused) return
    const t = setTimeout(() => void runSearch(query), 180)
    return () => clearTimeout(t)
  }, [query, isFocused, runSearch])

  const onFocus = () => {
    setIsFocused(true)
    void runSearch(query)
    Animated.spring(panelAnim, {
      toValue: 1, useNativeDriver: false, tension: 180, friction: 18,
    }).start()
  }

  const onBlur = () => {
    setTimeout(() => {
      setIsFocused(false)
      Animated.spring(panelAnim, {
        toValue: 0, useNativeDriver: false, tension: 200, friction: 22,
      }).start()
    }, 120)
  }

  const onSelectCompany = (slug: string) => {
    Keyboard.dismiss()
    setIsFocused(false)
    router.push(`/company/${slug}`)
  }

  const panelHeight = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SEARCH_RESULTS_MAX_HEIGHT],
    extrapolate: 'clamp',
  })
  const panelOpacity = panelAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  })

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.canvas }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + 80 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Wordmark + tagline ── */}
      <View style={styles.hero}>
        <Text style={[styles.wordmark, { color: colors.ink }]}>Verity</Text>
        <Text style={[styles.tagline, { color: colors.inkMuted }]}>
          Get a sense of what your businesses are doing
        </Text>
      </View>

      {/* ── Liquid Glass search ── */}
      <LiquidGlassView radius={22} style={styles.searchWrapper} innerStyle={{ paddingVertical: 0 }} shadow>
        <View style={styles.inputRow}>
          <Text style={[styles.searchIcon, { color: colors.inkSubtle }]}>⌕</Text>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.ink }]}
            placeholder="Search companies…"
            placeholderTextColor={colors.inkSubtle}
            value={query}
            onChangeText={setQuery}
            onFocus={onFocus}
            onBlur={onBlur}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: space.sm }} />
          ) : null}
        </View>

        <Animated.View style={{ height: panelHeight, opacity: panelOpacity, overflow: 'hidden' }}>
          <View style={[styles.resultsDivider, { backgroundColor: colors.stroke }]} />
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            ListEmptyComponent={
              !searching ? (
                <Text style={[styles.emptyResults, { color: colors.inkSubtle }]}>
                  {query.length > 0 ? 'No matches' : 'Browse companies…'}
                </Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.resultRow,
                  {
                    borderBottomColor: colors.stroke,
                    backgroundColor: pressed ? colors.stroke : 'transparent',
                  },
                ]}
                onPress={() => onSelectCompany(item.slug)}
              >
                <View style={styles.resultText}>
                  <Text style={[styles.resultName, { color: colors.ink }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.exchange ? (
                    <Text style={[styles.resultMeta, { color: colors.inkMuted }]} numberOfLines={1}>
                      {[item.ticker, item.exchange].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                {item.ticker ? (
                  <Text style={[styles.resultTicker, { color: colors.inkSubtle }]}>
                    {item.ticker}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        </Animated.View>
      </LiquidGlassView>

      {/* ── Industry digest ── */}
      {user && watchlistSlugs.length > 0 ? (
        <DigestSection
          digestText={digest?.digest_text ?? ''}
          sources={(digest?.sources ?? []) as DigestSource[]}
          generating={digest?.is_generating ?? (digestLoading && !digest)}
          colors={colors}
        />
      ) : user ? (
        <Text style={[styles.digestHint, { color: colors.inkSubtle }]}>
          Add companies to your watchlist to see your industry digest here.
        </Text>
      ) : null}
    </ScrollView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  content: { paddingHorizontal: space.lg },

  hero: { marginBottom: space.xl + space.sm },
  wordmark: {
    fontFamily: font.bold,
    fontSize: 42,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  tagline: {
    fontFamily: font.regular,
    fontSize: 17,
    lineHeight: 24,
    marginTop: space.sm,
    maxWidth: 280,
  },

  searchWrapper: { marginBottom: space.xl },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: 14,
    gap: space.sm,
  },
  searchIcon: { fontSize: 18, lineHeight: 22, marginTop: -1 },
  input: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 17,
    height: 22,
    padding: 0,
  },
  resultsDivider: { height: StyleSheet.hairlineWidth },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  resultText:   { flex: 1, minWidth: 0 },
  resultName:   { fontFamily: font.semi, fontSize: 15 },
  resultMeta:   { fontFamily: font.regular, fontSize: 13, marginTop: 2 },
  resultTicker: { fontFamily: 'Courier', fontSize: 12, letterSpacing: 0.5 },
  emptyResults: {
    fontFamily: font.regular,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },

  digestContainer: { marginTop: space.xs },
  digestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  digestKicker: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8 },
  digestTitle:  { fontFamily: font.semi, fontSize: 22, letterSpacing: -0.5, marginBottom: space.md },
  digestBody:   { fontFamily: font.regular, fontSize: 15, lineHeight: 24 },
  digestGenerating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.xl,
    paddingHorizontal: space.sm,
  },
  digestGeneratingText: { fontFamily: font.regular, fontSize: 14 },
  digestHint: {
    fontFamily: font.regular,
    fontSize: 14,
    marginTop: space.xl,
    textAlign: 'center',
  },

  sourcesContainer: { marginTop: space.xl },
  sourcesKicker:    { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8, marginBottom: space.sm },
  sourceRow:        { paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  sourceRowTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  pill: {
    color: '#fff',
    fontFamily: font.medium,
    fontSize: 9,
    letterSpacing: 0.8,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  sourceTitle:     { flex: 1, fontFamily: font.semi, fontSize: 14, lineHeight: 19 },
  sourceRelevance: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 4 },
  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    marginTop: space.xl,
    textAlign: 'center',
    opacity: 0.6,
  },
})
