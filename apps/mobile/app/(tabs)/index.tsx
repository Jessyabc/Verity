import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { CompanyLogo } from '@/components/CompanyLogo'
import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { searchCompanies, type SearchCompanyRow } from '@/lib/companySearch'
import { shortDocumentTitle } from '@/lib/documentTitles'
import { formatAgo } from '@/lib/format'
import type { RecentDbDoc } from '@/lib/recentDocuments'
import { fetchRecentDocumentsForSlugs } from '@/lib/recentDocuments'
import {
  fetchResearchCacheRowsForSlugs,
  flattenWatchlistResearchHighlights,
  type WatchlistResearchHighlight,
} from '@/lib/researchCache'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { syncSessionForApi } from '@/lib/syncSessionForApi'
import { fetchWatchlistSlugs } from '@/lib/watchlistApi'
import { font, radius, space } from '@/constants/theme'

type HeaderProps = {
  query: string
  setQuery: (q: string) => void
  onSearch: () => void
  loading: boolean
  searchError: string | null
  user: { email?: string | null } | null
  onSignOut: () => void
  recentDocs: RecentDbDoc[]
  recentLoading: boolean
  researchHighlights: WatchlistResearchHighlight[]
  researchLoading: boolean
  onOpenCompany: (slug: string) => void
}

function SearchTabHeader({
  query,
  setQuery,
  onSearch,
  loading,
  searchError,
  user,
  onSignOut,
  recentDocs,
  recentLoading,
  researchHighlights,
  researchLoading,
  onOpenCompany,
}: HeaderProps) {
  const colors = useVerityPalette()
  const styles = buildStyles(colors)

  return (
    <View>
      <View style={styles.hero}>
        <Text style={[styles.kicker, { color: colors.inkSubtle }]}>VERITY MONITOR</Text>
        <Text style={[styles.h1, { color: colors.ink }]}>Companies</Text>
        <Text style={[styles.lede, { color: colors.inkMuted }]}>
          Search your universe, then skim monitored pages and AI research snapshots for your watchlist
          (two separate feeds below).
        </Text>
        <View style={styles.accountRow}>
          <Text style={[styles.email, { color: colors.inkMuted }]} numberOfLines={1}>
            {user?.email ?? '—'}
          </Text>
          <Pressable onPress={onSignOut} hitSlop={8}>
            <Text style={[styles.signOut, { color: colors.accent }]}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.searchCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
        <TextInput
          style={[
            styles.input,
            { color: colors.ink, borderColor: colors.stroke, backgroundColor: colors.surfaceSolid },
          ]}
          placeholder="Name, ticker, slug, or CIK…"
          placeholderTextColor={colors.inkSubtle}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
        <Pressable style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={onSearch}>
          <Text style={styles.primaryBtnText}>Search</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginVertical: space.md }} color={colors.accent} />
      ) : null}
      {searchError ? <Text style={[styles.err, { color: colors.danger }]}>{searchError}</Text> : null}

      <View style={styles.recentSection}>
        <Text style={[styles.recentKicker, { color: colors.inkSubtle }]}>FROM YOUR WATCHLIST</Text>
        <Text style={[styles.recentTitle, { color: colors.ink }]}>Monitored pages</Text>
        <Text style={[styles.recentSub, { color: colors.inkMuted }]}>
          Fetched URLs (EDGAR, IR, etc.) — summaries appear after the enrich job runs on each page.
        </Text>
        {!user ? (
          <Text style={[styles.recentHint, { color: colors.inkMuted }]}>
            Sign in and add companies to your watchlist to see new filings and pages here.
          </Text>
        ) : recentLoading && recentDocs.length === 0 ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.md }} />
        ) : recentDocs.length === 0 ? (
          <Text style={[styles.recentHint, { color: colors.inkMuted }]}>
            Nothing here yet — add companies to your watchlist, then run the monitor (GitHub Actions
            “Monitor once” or locally: npm run monitor:once). SEC-listed names get an EDGAR filings page
            tracked automatically; add IR URLs in Admin on the web for richer coverage.
          </Text>
        ) : (
          recentDocs.map((item) => (
            <View
              key={item.document.id}
              style={[styles.recentRow, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}
            >
              <Pressable onPress={() => onOpenCompany(item.companySlug)}>
                <Text style={[styles.recentCompany, { color: colors.accent }]}>{item.companyName}</Text>
              </Pressable>
              <Pressable onPress={() => void Linking.openURL(item.document.canonical_url)}>
                <Text style={[styles.recentDocTitle, { color: colors.ink }]} numberOfLines={2}>
                  {shortDocumentTitle(item.document)}
                </Text>
                {item.document.summary_text ? (
                  <Text style={[styles.recentSnippet, { color: colors.inkMuted }]} numberOfLines={2}>
                    {item.document.summary_text}
                  </Text>
                ) : null}
                <Text style={[styles.recentMeta, { color: colors.inkSubtle }]}>
                  {formatAgo(item.document.last_checked_at ?? item.document.first_seen_at)}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={styles.recentSection}>
        <Text style={[styles.recentKicker, { color: colors.inkSubtle }]}>FROM YOUR WATCHLIST</Text>
        <Text style={[styles.recentTitle, { color: colors.ink }]}>Research snapshot (AI)</Text>
        <Text style={[styles.recentSub, { color: colors.inkMuted }]}>
          From Perplexity cache per company — open a profile and tap Refresh to update. Not the same
          as monitored pages above.
        </Text>
        {!user ? (
          <Text style={[styles.recentHint, { color: colors.inkMuted }]}>Sign in to see cached research.</Text>
        ) : researchLoading && researchHighlights.length === 0 ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: space.md }} />
        ) : researchHighlights.length === 0 ? (
          <Text style={[styles.recentHint, { color: colors.inkMuted }]}>
            No research cache yet — open a watchlist company, use Refresh under Research & news, or
            run research from the web dashboard.
          </Text>
        ) : (
          researchHighlights.map((h, i) => (
            <View
              key={`${h.slug}-${h.item.url}-${i}`}
              style={[styles.recentRow, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}
            >
              <Pressable onPress={() => onOpenCompany(h.slug)}>
                <Text style={[styles.recentCompany, { color: colors.accent }]}>{h.companyName}</Text>
              </Pressable>
              <Pressable onPress={() => void Linking.openURL(h.item.url)}>
                <Text style={[styles.recentDocTitle, { color: colors.ink }]} numberOfLines={2}>
                  {h.item.title}
                </Text>
                {h.item.snippet ? (
                  <Text style={[styles.recentSnippet, { color: colors.inkMuted }]} numberOfLines={3}>
                    {h.item.snippet}
                  </Text>
                ) : null}
                <Text style={[styles.recentMeta, { color: colors.inkSubtle }]}>
                  {formatAgo(h.fetchedAt)}
                  {h.item.source ? ` · ${h.item.source}` : ''}
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.resultsKicker, { color: colors.inkSubtle }]}>SEARCH RESULTS</Text>
    </View>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { user, signOut, initialized } = useAuth()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<SearchCompanyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [recentDocs, setRecentDocs] = useState<RecentDbDoc[]>([])
  const [recentLoading, setRecentLoading] = useState(false)
  const [researchHighlights, setResearchHighlights] = useState<WatchlistResearchHighlight[]>([])
  const [researchLoading, setResearchLoading] = useState(false)

  const runSearch = useCallback(async (q: string, showMainSpinner = true) => {
    if (!isSupabaseConfigured()) return
    if (showMainSpinner) setLoading(true)
    setSearchError(null)
    try {
      const data = await searchCompanies(q, 30)
      setRows(data)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed')
      setRows([])
    } finally {
      if (showMainSpinner) setLoading(false)
    }
  }, [])

  const loadRecent = useCallback(async () => {
    if (!user) {
      setRecentDocs([])
      setResearchHighlights([])
      return
    }
    setRecentLoading(true)
    setResearchLoading(true)
    try {
      await syncSessionForApi()
      const slugs = await fetchWatchlistSlugs(supabase)
      const [docs, researchRows] = await Promise.all([
        fetchRecentDocumentsForSlugs(slugs, 10),
        fetchResearchCacheRowsForSlugs(slugs),
      ])
      setRecentDocs(docs)
      setResearchHighlights(flattenWatchlistResearchHighlights(researchRows))
    } catch {
      setRecentDocs([])
      setResearchHighlights([])
    } finally {
      setRecentLoading(false)
      setResearchLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!initialized || !user) return
    void runSearch('')
  }, [runSearch, initialized, user])

  useFocusEffect(
    useCallback(() => {
      void loadRecent()
    }, [loadRecent]),
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await syncSessionForApi()
      await Promise.all([runSearch(query, false), loadRecent()])
    } finally {
      setRefreshing(false)
    }
  }, [query, runSearch, loadRecent])

  const styles = buildStyles(colors)

  if (!isSupabaseConfigured()) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas, paddingTop: insets.top }]}>
        <Text style={styles.h1}>Configure Supabase</Text>
        <Text style={styles.muted}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/mobile/.env
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas, paddingTop: insets.top + space.sm }]}>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <SearchTabHeader
            query={query}
            setQuery={setQuery}
            onSearch={() => void runSearch(query)}
            loading={loading}
            searchError={searchError}
            user={user}
            onSignOut={() => void signOut()}
            recentDocs={recentDocs}
            recentLoading={recentLoading}
            researchHighlights={researchHighlights}
            researchLoading={researchLoading}
            onOpenCompany={(slug) => router.push(`/company/${slug}`)}
          />
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={[styles.empty, { color: colors.inkSubtle }]}>
              No results — try another query, or leave the field empty for the newest companies.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, { borderBottomColor: colors.stroke }]}
            onPress={() => router.push(`/company/${item.slug}`)}
          >
            <CompanyLogo name={item.name} ticker={item.ticker} size="md" />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>{item.name}</Text>
              <Text style={[styles.rowMeta, { color: colors.inkMuted }]}>
                {(item.ticker ?? '—') + ' · ' + item.slug}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}

function buildStyles(colors: ReturnType<typeof useVerityPalette>) {
  return StyleSheet.create({
    screen: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', padding: space.xl },
    hero: { marginBottom: space.lg },
    kicker: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8, marginBottom: space.xs },
    h1: { fontFamily: font.semi, fontSize: 28, letterSpacing: -0.6 },
    lede: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: space.sm },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: space.md,
      gap: space.md,
    },
    email: { fontFamily: font.regular, fontSize: 14, flex: 1 },
    signOut: { fontFamily: font.semi, fontSize: 14 },
    searchCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: space.md,
      marginBottom: space.sm,
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingHorizontal: space.md,
      paddingVertical: 12,
      fontSize: 16,
      fontFamily: font.regular,
    },
    primaryBtn: {
      marginTop: space.md,
      paddingVertical: space.md,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    primaryBtnText: { fontFamily: font.semi, color: '#fff', fontSize: 15 },
    list: { flex: 1 },
    empty: { fontFamily: font.regular, fontSize: 14, marginTop: space.md, marginBottom: space.lg },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.md,
      paddingVertical: space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: { fontFamily: font.semi, fontSize: 16 },
    rowMeta: { fontFamily: font.regular, fontSize: 13, marginTop: 4 },
    err: { fontFamily: font.regular, fontSize: 14, marginTop: space.sm },
    muted: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: space.md },
    recentSection: { marginTop: space.lg, marginBottom: space.md },
    recentKicker: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8 },
    recentTitle: { fontFamily: font.semi, fontSize: 18, marginTop: space.xs },
    recentSub: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 6 },
    recentHint: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: space.sm },
    recentRow: {
      marginTop: space.sm,
      padding: space.md,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    recentCompany: { fontFamily: font.semi, fontSize: 13, marginBottom: 4 },
    recentDocTitle: { fontFamily: font.semi, fontSize: 15, lineHeight: 20 },
    recentSnippet: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 4 },
    recentMeta: { fontFamily: font.regular, fontSize: 12, marginTop: 6 },
    resultsKicker: {
      fontFamily: font.medium,
      fontSize: 11,
      letterSpacing: 1.8,
      marginTop: space.md,
      marginBottom: space.sm,
    },
  })
}
