/**
 * Watchlist — the landing screen.
 *
 * Layout:
 *   • Header: hamburger icon ← → "Watchlist" title
 *   • FlatList of company cards (research summaries)
 *   • Bottom: liquid-glass search orb → tap opens full-screen Safari-style company search
 *   • Max 15 companies (upsell cap)
 */

import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Ionicons from '@expo/vector-icons/Ionicons'
import { CompanyLogo } from '@/components/CompanyLogo'
import { LiquidGlassSearchOrb } from '@/components/LiquidGlassSearchOrb'
import { useSidebar } from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { resolveCompanyLogoUrl } from '@/lib/companyLogo'
import { formatAgo, formatUnknownError } from '@/lib/format'
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
import { font, onAccent, radius, space } from '@/constants/theme'

const WATCHLIST_CAP = 15

// ─── Company card ──────────────────────────────────────────────────────────────

type CardProps = {
  company: WatchlistCompanyRow
  research: CompanyResearchRow | undefined
  colors: ReturnType<typeof useVerityPalette>
  onPress: () => void
  onRemove: () => void
  isLast: boolean
}

function CompanyCard({ company, research, colors, onPress, onRemove, isLast }: CardProps) {
  const summary = research?.synthesis ?? research?.items?.[0]?.snippet ?? null
  const gaps = Array.isArray(research?.factual_gaps) ? (research!.factual_gaps as unknown[]) : []

  const subtitle =
    gaps.length > 0
      ? `${gaps.length} open gap${gaps.length !== 1 ? 's' : ''}${
          research?.fetched_at ? ` · ${formatAgo(research.fetched_at)}` : ''
        }`
      : summary
        ? summary
        : research?.fetched_at
          ? `Updated ${formatAgo(research.fetched_at)}`
          : 'Tap to open'

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.stroke },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <CompanyLogo
        name={company.name}
        ticker={company.ticker}
        logoUrl={resolveCompanyLogoUrl({ explicit: company.logo_url })}
        size="sm"
      />
      <View style={styles.listRowMain}>
        <Text style={[styles.cardName, { color: colors.ink }]} numberOfLines={1}>
          {company.name}
        </Text>
        {(company.ticker || company.exchange) ? (
          <Text style={[styles.cardTicker, { color: colors.inkMuted }]} numberOfLines={1}>
            {[company.ticker, company.exchange].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        <Text style={[styles.listSubtitle, { color: colors.inkSubtle }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: colors.inkSubtle }]} aria-hidden>›</Text>
      <Pressable onPress={onRemove} style={styles.removeIconHit} hitSlop={12}>
        <Text style={[styles.removeBtnText, { color: colors.inkSubtle }]}>✕</Text>
      </Pressable>
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

  useEffect(() => {
    if (visible) {
      setQuery('')
      setResults([])
    } else {
      Keyboard.dismiss()
    }
  }, [visible])

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
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => {
        Keyboard.dismiss()
        onClose()
      }}
    >
      <KeyboardAvoidingView
        style={[styles.searchScreenRoot, { backgroundColor: colors.canvas }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.searchScreenInner, { backgroundColor: colors.canvas }]}>
          <View
            style={[
              styles.safariChrome,
              {
                paddingTop: insets.top + 6,
                borderBottomColor: colors.stroke,
                backgroundColor: colors.canvas,
              },
            ]}
          >
            <Text
              style={[styles.safariEcho, { color: query.length > 0 ? colors.ink : colors.inkSubtle }]}
              numberOfLines={2}
            >
              {query.length > 0 ? query : 'Company name or ticker'}
            </Text>

            <View style={styles.safariControlRow}>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss()
                  onClose()
                }}
                hitSlop={12}
                style={styles.safariCancelHit}
              >
                <Text style={[styles.safariCancel, { color: colors.accent }]}>Cancel</Text>
              </Pressable>
              <View
                style={[
                  styles.safariFieldPill,
                  {
                    backgroundColor: colors.surfaceSolid,
                    borderColor: colors.stroke,
                  },
                ]}
              >
                <Ionicons name="search" size={18} color={colors.inkSubtle} style={styles.safariFieldIcon} />
                <TextInput
                  style={[styles.safariFieldInput, { color: colors.ink }]}
                  placeholder="Search or enter company…"
                  placeholderTextColor={colors.inkSubtle}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
                  autoFocus
                />
                {searching ? (
                  <ActivityIndicator size="small" color={colors.accent} style={styles.safariSpinner} />
                ) : null}
              </View>
            </View>
          </View>

          {atCap ? (
            <View style={styles.capMessage}>
              <Text style={[styles.capTitle, { color: colors.ink }]}>Watchlist full</Text>
              <Text style={[styles.capBody, { color: colors.inkMuted }]}>
                {"You're tracking"} {WATCHLIST_CAP} companies — the maximum on the current plan. Remove a
                company to add another.
              </Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.resultsListFlex}
              {...(Platform.OS === 'ios'
                ? { contentInsetAdjustmentBehavior: 'automatic' as const }
                : {})}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
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
                      if (!inList) {
                        Keyboard.dismiss()
                        onSelect(item.slug)
                      }
                    }}
                    disabled={inList}
                  >
                    <CompanyLogo
                      name={item.name}
                      ticker={item.ticker}
                      logoUrl={resolveCompanyLogoUrl({ explicit: item.logo_url })}
                      size="sm"
                    />
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
                      <Ionicons name="bookmark" size={22} color={colors.accent} accessibilityLabel="On watchlist" />
                    ) : (
                      <View style={styles.addToWatchRow}>
                        <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                        <Text style={[styles.addLabel, { color: colors.accent }]}>Add</Text>
                      </View>
                    )}
                  </Pressable>
                )
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
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
      setError(formatUnknownError(e))
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
      setError(formatUnknownError(e))
    }
  }

  const handleRemove = async (slug: string) => {
    try {
      await deleteWatchlistSlug(supabase, slug)
      setCompanies((prev) => prev.filter((c) => c.slug !== slug))
    } catch (e) {
      setError(formatUnknownError(e))
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
            marginHorizontal: space.lg,
            marginTop: space.sm,
            paddingBottom: insets.bottom + 88,
            borderRadius: radius.lg,
            overflow: 'hidden',
            backgroundColor: colors.surfaceSolid,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <CompanyCard
              company={item}
              research={researchMap.get(item.slug)}
              colors={colors}
              isLast={index === companies.length - 1}
              onPress={() => router.push(`/company/${item.slug}`)}
              onRemove={() => void handleRemove(item.slug)}
            />
          )}
        />
      )}

      {/* ── Bottom liquid-glass search orb ── */}
      <View
        style={[styles.searchOrbContainer, { paddingBottom: insets.bottom + space.md }]}
        pointerEvents="box-none"
      >
        <LiquidGlassSearchOrb
          onOpen={() => {
            if (!atCap) setShowSearch(true)
          }}
          disabled={atCap}
          iconColor={atCap ? colors.inkSubtle : colors.ink}
          accessibilityLabel={
            atCap
              ? `Watchlist full, ${WATCHLIST_CAP} of ${WATCHLIST_CAP} companies`
              : 'Add company to watchlist, open search'
          }
        />
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

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  listRowMain: { flex: 1, minWidth: 0 },
  listSubtitle: { fontFamily: font.regular, fontSize: 12, marginTop: 4, lineHeight: 16 },
  chevron:      { fontSize: 20, fontWeight: '300', marginRight: -4 },
  removeIconHit: { padding: 6 },
  removeBtnText: { fontSize: 13 },
  cardName:       { fontFamily: font.semi, fontSize: 16, letterSpacing: -0.3 },
  cardTicker:     { fontFamily: font.medium, fontSize: 12, marginTop: 2 },

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
  emptyBtnText: { fontFamily: font.semi, color: onAccent, fontSize: 15 },

  searchOrbContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  searchScreenRoot: { flex: 1 },
  searchScreenInner: { flex: 1 },
  safariChrome: {
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  safariEcho: {
    fontFamily: font.semi,
    fontSize: 28,
    letterSpacing: -0.6,
    lineHeight: 34,
    marginBottom: space.md,
    minHeight: 36,
  },
  safariControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  safariCancelHit: { paddingVertical: 8, paddingRight: 4 },
  safariCancel: { fontFamily: font.regular, fontSize: 17 },
  safariFieldPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
    paddingRight: space.sm,
  },
  safariFieldIcon: { marginLeft: 12 },
  safariFieldInput: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 17,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    paddingHorizontal: 10,
    paddingRight: 8,
  },
  safariSpinner: { marginRight: 8 },
  resultsListFlex: { flex: 1 },
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
  addToWatchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
