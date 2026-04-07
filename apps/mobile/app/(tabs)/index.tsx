/**
 * Watchlist — the landing screen.
 *
 * Layout:
 *   • Header: hamburger icon ← → "Watchlist" title
 *   • FlatList of company cards (research summaries)
 *   • Bottom: permanent glass search bar ("Add company to watchlist…")
 *     → tapping expands a modal sheet with live search results
 *   • Max 15 companies (upsell cap)
 */

import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LiquidGlassView } from '@/components/LiquidGlass'
import { useSidebar } from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { formatAgo } from '@/lib/format'
import { searchCompanies, type SearchCompanyRow } from '@/lib/companySearch'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  deleteWatchlistSlug,
  fetchCompaniesForSlugs,
  fetchWatchlistSlugs,
  insertWatchlistSlug,
  type WatchlistCompanyRow,
} from '@/lib/watchlistApi'
import { fetchResearchCacheRowsForSlugs, type CompanyResearchRow } from '@/lib/researchCache'
import { font, radius, space } from '@/constants/theme'

const WATCHLIST_CAP = 15

// ─── Company card ──────────────────────────────────────────────────────────────

type CardProps = {
  company: WatchlistCompanyRow
  research: CompanyResearchRow | undefined
  colors: ReturnType<typeof useVerityPalette>
  onPress: () => void
  onRemove: () => void
}

function CompanyCard({ company, research, colors, onPress, onRemove }: CardProps) {
  const summary = research?.synthesis ?? research?.items?.[0]?.snippet ?? null
  const gaps = Array.isArray(research?.factual_gaps) ? (research!.factual_gaps as unknown[]) : []

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceSolid,
          borderColor: colors.stroke,
          opacity: pressed ? 0.93 : 1,
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardName, { color: colors.ink }]} numberOfLines={1}>
            {company.name}
          </Text>
          {(company.ticker || company.exchange) ? (
            <Text style={[styles.cardTicker, { color: colors.inkMuted }]}>
              {[company.ticker, company.exchange].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onRemove}
          style={[styles.removeBtn, { borderColor: colors.stroke }]}
          hitSlop={8}
        >
          <Text style={[styles.removeBtnText, { color: colors.inkSubtle }]}>✕</Text>
        </Pressable>
      </View>

      {gaps.length > 0 ? (
        <View style={[styles.gapBadge, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.gapBadgeText, { color: colors.accent }]}>
            {gaps.length} factual gap{gaps.length !== 1 ? 's' : ''} this quarter
          </Text>
        </View>
      ) : summary ? (
        <Text style={[styles.cardSummary, { color: colors.inkMuted }]} numberOfLines={2}>
          {summary}
        </Text>
      ) : (
        <Text style={[styles.cardNoResearch, { color: colors.inkSubtle }]}>
          No research yet — tap to run
        </Text>
      )}

      {research?.fetched_at ? (
        <Text style={[styles.cardAge, { color: colors.inkSubtle }]}>
          Updated {formatAgo(research.fetched_at)}
        </Text>
      ) : null}
    </Pressable>
  )
}

// ─── Search modal ─────────────────────────────────────────────────────────────

type SearchModalProps = {
  visible: boolean
  onClose: () => void
  onSelect: (slug: string) => void
  currentSlugs: string[]
  colors: ReturnType<typeof useVerityPalette>
  atCap: boolean
}

function SearchModal({ visible, onClose, onSelect, currentSlugs, colors, atCap }: SearchModalProps) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchCompanyRow[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<TextInput>(null)
  const slideAnim = useRef(new Animated.Value(300)).current

  useEffect(() => {
    if (visible) {
      setQuery('')
      setResults([])
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 200,
        friction: 22,
      }).start(() => inputRef.current?.focus())
    } else {
      Animated.spring(slideAnim, {
        toValue: 300,
        useNativeDriver: true,
        tension: 220,
        friction: 24,
      }).start()
    }
  }, [visible, slideAnim])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(async () => {
      if (!isSupabaseConfigured()) return
      setSearching(true)
      try {
        setResults(await searchCompanies(query, 20))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 180)
    return () => clearTimeout(t)
  }, [query, visible])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={() => { Keyboard.dismiss(); onClose() }}
      />

      <Animated.View
        style={[
          styles.searchPanel,
          {
            backgroundColor: colors.surfaceSolid,
            paddingBottom: insets.bottom + space.sm,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.stroke }]} />

        {atCap ? (
          <View style={styles.capMessage}>
            <Text style={[styles.capTitle, { color: colors.ink }]}>Watchlist full</Text>
            <Text style={[styles.capBody, { color: colors.inkMuted }]}>
              {"You're tracking"} {WATCHLIST_CAP} companies — the maximum on the current plan.
              Remove a company to add another.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.inputRow, { borderBottomColor: colors.stroke }]}>
              <Text style={[styles.searchIcon, { color: colors.inkSubtle }]}>⌕</Text>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: colors.ink }]}
                placeholder="Search companies…"
                placeholderTextColor={colors.inkSubtle}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
              />
              {searching ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : null}
            </View>

            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.resultsList}
              ListEmptyComponent={
                !searching ? (
                  <Text style={[styles.emptyResults, { color: colors.inkSubtle }]}>
                    {query.length > 0 ? 'No matches' : 'Type a company name or ticker…'}
                  </Text>
                ) : null
              }
              renderItem={({ item }) => {
                const inList = currentSlugs.includes(item.slug)
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.resultRow,
                      {
                        borderBottomColor: colors.stroke,
                        backgroundColor: pressed ? colors.accentSoft : 'transparent',
                        opacity: inList ? 0.5 : 1,
                      },
                    ]}
                    onPress={() => {
                      if (!inList) { Keyboard.dismiss(); onSelect(item.slug) }
                    }}
                    disabled={inList}
                  >
                    <View style={styles.resultText}>
                      <Text style={[styles.resultName, { color: colors.ink }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.exchange || item.ticker ? (
                        <Text style={[styles.resultMeta, { color: colors.inkMuted }]} numberOfLines={1}>
                          {[item.ticker, item.exchange].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    {inList ? (
                      <Text style={[styles.inListLabel, { color: colors.accent }]}>★</Text>
                    ) : (
                      <Text style={[styles.addLabel, { color: colors.accent }]}>+ Add</Text>
                    )}
                  </Pressable>
                )
              }}
            />
          </>
        )}
      </Animated.View>
    </Modal>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WatchlistScreen() {
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const colors   = useVerityPalette()
  const { user } = useAuth()
  const { open: openSidebar } = useSidebar()

  const [companies, setCompanies]     = useState<WatchlistCompanyRow[]>([])
  const [researchMap, setResearchMap] = useState<Map<string, CompanyResearchRow>>(new Map())
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [showSearch, setShowSearch]   = useState(false)

  const load = useCallback(async () => {
    if (!user) { setCompanies([]); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const slugs = await fetchWatchlistSlugs(supabase)
      const [cos, rows] = await Promise.all([
        fetchCompaniesForSlugs(supabase, slugs),
        fetchResearchCacheRowsForSlugs(slugs),
      ])
      setCompanies(cos)
      const map = new Map<string, CompanyResearchRow>()
      for (const r of rows) map.set(r.slug, r)
      setResearchMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  useEffect(() => {
    if (!user || companies.length === 0) return
    const t = setInterval(() => {
      void fetchResearchCacheRowsForSlugs(companies.map((c) => c.slug)).then((rows) => {
        const map = new Map<string, CompanyResearchRow>()
        for (const r of rows) map.set(r.slug, r)
        setResearchMap(map)
      }).catch(() => {})
    }, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [user, companies])

  const handleAddCompany = async (slug: string) => {
    setShowSearch(false)
    if (!user) return
    try {
      await insertWatchlistSlug(supabase, user.id, slug)
      await load()
      router.push(`/company/${slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleRemove = async (slug: string) => {
    try {
      await deleteWatchlistSlug(supabase, slug)
      setCompanies((prev) => prev.filter((c) => c.slug !== slug))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const atCap = companies.length >= WATCHLIST_CAP

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      {/* ── Header ── */}
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
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Watchlist</Text>
        <Text style={[styles.companyCount, { color: colors.inkSubtle }]}>
          {companies.length}/{WATCHLIST_CAP}
        </Text>
      </View>

      {error ? (
        <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {/* ── Company list ── */}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : companies.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>Your watchlist is empty</Text>
          <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
            Search for any public company below. Verity tracks the gap between what the company
            officially says and what media and analysts are reporting.
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
            onPress={() => setShowSearch(true)}
          >
            <Text style={styles.emptyBtnText}>Add your first company</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(c) => c.slug}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingTop: space.md,
            paddingBottom: insets.bottom + 110,
          }}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <CompanyCard
              company={item}
              research={researchMap.get(item.slug)}
              colors={colors}
              onPress={() => router.push(`/company/${item.slug}`)}
              onRemove={() => void handleRemove(item.slug)}
            />
          )}
        />
      )}

      {/* ── Permanent bottom search bar ── */}
      <View
        style={[
          styles.searchBarContainer,
          { paddingBottom: insets.bottom + space.sm },
        ]}
      >
        <LiquidGlassView
          radius={20}
          style={styles.searchBar}
          innerStyle={{ paddingVertical: 0 }}
          shadow
        >
          <Pressable
            style={styles.searchBarInner}
            onPress={() => setShowSearch(true)}
            accessibilityRole="search"
            accessibilityLabel="Add company to watchlist"
          >
            <Text style={[styles.searchBarIcon, { color: colors.inkSubtle }]}>⌕</Text>
            <Text style={[styles.searchBarPlaceholder, { color: colors.inkSubtle }]}>
              {atCap
                ? `Watchlist full (${WATCHLIST_CAP}/${WATCHLIST_CAP})`
                : 'Add company to watchlist…'}
            </Text>
          </Pressable>
        </LiquidGlassView>
      </View>

      {/* ── Search modal ── */}
      <SearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={handleAddCompany}
        currentSlugs={companies.map((c) => c.slug)}
        colors={colors}
        atCap={atCap}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  hLine:       { height: 1.5, borderRadius: 1 },
  headerTitle: { flex: 1, fontFamily: font.semi, fontSize: 18, letterSpacing: -0.3 },
  companyCount:{ fontFamily: font.regular, fontSize: 12 },
  err:         { fontFamily: font.regular, fontSize: 14, marginHorizontal: space.lg, marginTop: space.sm },

  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.sm,
  },
  cardMeta:       { flex: 1, minWidth: 0 },
  cardName:       { fontFamily: font.semi, fontSize: 17, letterSpacing: -0.3 },
  cardTicker:     { fontFamily: font.medium, fontSize: 12, marginTop: 2 },
  removeBtn: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText:  { fontSize: 11 },
  gapBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    marginBottom: space.xs,
  },
  gapBadgeText:   { fontFamily: font.semi, fontSize: 12 },
  cardSummary:    { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  cardNoResearch: { fontFamily: font.regular, fontSize: 13, fontStyle: 'italic' },
  cardAge:        { fontFamily: font.regular, fontSize: 11, marginTop: space.xs },

  empty: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
  },
  emptyTitle: { fontFamily: font.semi, fontSize: 22, letterSpacing: -0.4 },
  emptyBody: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  emptyBtn:     { borderRadius: radius.sm, paddingVertical: space.md, alignItems: 'center' },
  emptyBtnText: { fontFamily: font.semi, color: '#fff', fontSize: 15 },

  searchBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: space.lg,
    right: space.lg,
  },
  searchBar: {},
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 15,
  },
  searchBarIcon:        { fontSize: 18, lineHeight: 22, marginTop: -1 },
  searchBarPlaceholder: { fontFamily: font.regular, fontSize: 16 },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  searchPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginTop: space.md,
    marginBottom: space.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchIcon: { fontSize: 18, lineHeight: 22, marginTop: -1 },
  input: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 17,
    height: 22,
    padding: 0,
  },
  resultsList: { maxHeight: 380 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  resultText:   { flex: 1, minWidth: 0 },
  resultName:   { fontFamily: font.semi, fontSize: 15 },
  resultMeta:   { fontFamily: font.regular, fontSize: 13, marginTop: 2 },
  inListLabel:  { fontFamily: font.medium, fontSize: 16 },
  addLabel:     { fontFamily: font.semi, fontSize: 13 },
  emptyResults: {
    fontFamily: font.regular,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  capMessage: { padding: space.xl, gap: space.sm },
  capTitle:   { fontFamily: font.semi, fontSize: 18 },
  capBody:    { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
})
