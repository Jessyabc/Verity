/**
 * Watchlist — the landing screen.
 *
 * Layout:
 *   • Header: menu + Verity mark, “Watchlist” (BRAND / company-page language)
 *   • Glass list of company cards
 *   • Bottom: liquid-glass search orb (on-navy variant)
 *   • Max 15 companies (upsell cap)
 */

import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { BlurView } from 'expo-blur'

import Ionicons from '@expo/vector-icons/Ionicons'
import { CompanyLogo } from '@/components/CompanyLogo'
import { LiquidGlassSearchOrb } from '@/components/LiquidGlassSearchOrb'
import { useSidebar } from '@/components/Sidebar'
import { VerityMark } from '@/components/VerityMark'
import { useAuth } from '@/contexts/AuthContext'
import { font, radius, space } from '@/constants/theme'
import { useAdaptiveBrand } from '@/hooks/useAdaptiveBrand'
import { buildCompanyLogoCandidates } from '@/lib/companyLogo'
import { formatAgo, formatUnknownError, getGreetingForUser } from '@/lib/format'
import { searchCompanies, type SearchCompanyRow } from '@/lib/companySearch'
import { useWatchlistDigest } from '@/hooks/useWatchlistDigest'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  deleteWatchlistSlug,
  fetchCompaniesForSlugs,
  fetchSourceBaseUrlsBySlugs,
  fetchWatchlistSlugs,
  insertWatchlistSlug,
  type WatchlistCompanyRow,
} from '@/lib/watchlistApi'
import { fetchResearchCacheRowsForSlugs, type CompanyResearchRow } from '@/lib/researchCache'
import { createConversation } from '@/lib/chatApi'

const WATCHLIST_CAP = 15

// ─── Company card ──────────────────────────────────────────────────────────────

type CardProps = {
  company: WatchlistCompanyRow
  research: CompanyResearchRow | undefined
  logoCandidates: string[]
  brand: ReturnType<typeof useAdaptiveBrand>
  onPress: () => void
  onRemove: () => void
  isLast: boolean
}

function CompanyCard({ company, research, logoCandidates, brand, onPress, onRemove, isLast }: CardProps) {
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
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: brand.stroke },
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <CompanyLogo
        name={company.name}
        ticker={company.ticker}
        logoCandidates={logoCandidates}
        size="sm"
        tone="brand"
      />
      <View style={styles.listRowMain}>
        <Text style={[styles.cardName, { color: brand.onNavy }]} numberOfLines={1}>
          {company.name}
        </Text>
        {(company.ticker || company.exchange) ? (
          <Text style={[styles.cardTicker, { color: brand.onNavyMuted }]} numberOfLines={1}>
            {[company.ticker, company.exchange].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        <Text style={[styles.listSubtitle, { color: brand.onNavySubtle }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: brand.onNavySubtle }]} aria-hidden>
        ›
      </Text>
      <Pressable onPress={onRemove} style={styles.removeIconHit} hitSlop={12}>
        <Text style={[styles.removeBtnText, { color: brand.onNavySubtle }]}>✕</Text>
      </Pressable>
    </Pressable>
  )
}

// ─── Digest card ──────────────────────────────────────────────────────────────

type DigestCardProps = {
  digest: import('@/lib/watchlistDigest').WatchlistDigestRow | null
  loading: boolean
  error: string | null
  onRefresh: () => void
  onOpenChat: () => void
}

function DigestCard({ digest, loading, error, onRefresh, onOpenChat }: DigestCardProps) {
  const brand = useAdaptiveBrand()
  if (loading) {
    return (
      <View style={styles.digestShimmer}>
        <Text style={[styles.digestShimmerText, { color: brand.onNavySubtle }]}>
          Loading your summary…
        </Text>
      </View>
    )
  }

  // Generating but no text yet — first-time generation in flight
  if (digest?.is_generating && !digest.digest_text) {
    return (
      <View style={[styles.digestPrompt, { borderColor: brand.stroke }]}>
        <Text style={[styles.digestPromptText, { color: brand.onNavyMuted }]}>
          Preparing your portfolio summary…
        </Text>
      </View>
    )
  }

  // Error state — failure visible, tap to retry
  if (error && !digest?.digest_text) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.digestPrompt,
          { borderColor: brand.stroke, opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={onRefresh}
        accessibilityLabel="Retry portfolio summary"
      >
        <Text style={[styles.digestPromptText, { color: brand.onNavyMuted }]} numberOfLines={2}>
          Couldn{'’'}t generate summary: {error}. Tap to retry.
        </Text>
      </Pressable>
    )
  }

  // No digest and not generating — prompt to generate
  if (!digest?.digest_text) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.digestPrompt,
          { borderColor: brand.stroke, opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={onRefresh}
        accessibilityLabel="Generate portfolio summary"
      >
        <Text style={[styles.digestPromptText, { color: brand.onNavyMuted }]}>
          Tap to generate your portfolio summary
        </Text>
      </Pressable>
    )
  }

  // Has digest text
  return (
    <Pressable
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      onPress={onOpenChat}
      accessibilityRole="button"
      accessibilityLabel="Open portfolio chat"
    >
      <BlurView intensity={28} tint="dark" style={styles.digestCard}>
        <View
          style={[
            styles.digestCardInner,
            { backgroundColor: brand.glassNavy, borderColor: brand.tealLight },
          ]}
        >
          <View style={styles.digestKickerRow}>
            <View style={[styles.digestDot, { backgroundColor: brand.tealLight }]} />
            <Text style={[styles.digestKicker, { color: brand.tealLight }]}>
              PORTFOLIO BRIEF
            </Text>
            <Text style={[styles.digestKickerHint, { color: brand.onNavySubtle }]}>
              Tap to chat
            </Text>
          </View>
          <Text
            style={[styles.digestText, { color: brand.onNavy }]}
            numberOfLines={4}
          >
            {digest.digest_text}
          </Text>
          <View style={styles.digestFooter}>
            <Text style={[styles.digestMeta, { color: brand.onNavySubtle }]}>
              {digest.is_generating
                ? 'Updating…'
                : `Updated ${formatAgo(digest.generated_at)}`}
            </Text>
            {!digest.is_generating ? (
              <Pressable onPress={onRefresh} hitSlop={10} accessibilityLabel="Refresh summary">
                <Text style={[styles.digestRefreshBtn, { color: brand.tealLight }]}>Refresh</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </BlurView>
    </Pressable>
  )
}

// ─── Search modal ─────────────────────────────────────────────────────────────

type SearchModalProps = {
  visible: boolean
  onClose: () => void
  onSelect: (slug: string) => void
  currentSlugs: string[]
  atCap: boolean
}

function SearchModal({ visible, onClose, onSelect, currentSlugs, atCap }: SearchModalProps) {
  const insets = useSafeAreaInsets()
  const brand = useAdaptiveBrand()
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
        style={[styles.searchScreenRoot, { backgroundColor: brand.navy }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[styles.searchScreenInner, { backgroundColor: brand.navy }]}>
          <View
            style={[
              styles.safariChrome,
              {
                paddingTop: insets.top + 6,
                borderBottomColor: brand.stroke,
                backgroundColor: brand.navy,
              },
            ]}
          >
            <Text
              style={[
                styles.safariEcho,
                { color: query.length > 0 ? brand.onNavy : brand.onNavySubtle },
              ]}
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
                <Text style={[styles.safariCancel, { color: brand.tealLight }]}>Cancel</Text>
              </Pressable>
              <View
                style={[
                  styles.safariFieldPill,
                  {
                    backgroundColor: brand.glassNavy,
                    borderColor: brand.stroke,
                  },
                ]}
              >
                <Ionicons name="search" size={18} color={brand.onNavySubtle} style={styles.safariFieldIcon} />
                <TextInput
                  style={[styles.safariFieldInput, { color: brand.onNavy }]}
                  placeholder="Search or enter company…"
                  placeholderTextColor={brand.onNavyMuted}
                  value={query}
                  onChangeText={setQuery}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
                  autoFocus
                />
                {searching ? (
                  <ActivityIndicator size="small" color={brand.tealLight} style={styles.safariSpinner} />
                ) : null}
              </View>
            </View>
          </View>

          {atCap ? (
            <View style={styles.capMessage}>
              <Text style={[styles.capTitle, { color: brand.onNavy }]}>Watchlist full</Text>
              <Text style={[styles.capBody, { color: brand.onNavyMuted }]}>
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
                  <Text style={[styles.emptyResults, { color: brand.onNavySubtle }]}>
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
                        borderBottomColor: brand.stroke,
                        backgroundColor: pressed ? brand.glassTealWash : 'transparent',
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
                      logoCandidates={buildCompanyLogoCandidates({ explicit: item.logo_url })}
                      size="sm"
                      tone="brand"
                    />
                    <View style={styles.resultText}>
                      <Text style={[styles.resultName, { color: brand.onNavy }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.exchange || item.ticker ? (
                        <Text style={[styles.resultMeta, { color: brand.onNavyMuted }]} numberOfLines={1}>
                          {[item.ticker, item.exchange].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    {inList ? (
                      <Ionicons name="bookmark" size={20} color={brand.tealLight} accessibilityLabel="On watchlist" />
                    ) : (
                      <View style={styles.addToWatchRow}>
                        <Ionicons name="add-circle-outline" size={20} color={brand.tealLight} />
                        <Text style={[styles.addLabel, { color: brand.tealLight }]}>Add</Text>
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
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { open: openSidebar } = useSidebar()
  const brand = useAdaptiveBrand()

  const [companies, setCompanies] = useState<WatchlistCompanyRow[]>([])
  const [researchMap, setResearchMap] = useState<Map<string, CompanyResearchRow>>(new Map())
  const [sourceBySlug, setSourceBySlug] = useState<Map<string, string[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)

  const slugs = useMemo(() => companies.map((c) => c.slug), [companies])
  const {
    digest,
    loading: digestLoading,
    error: digestError,
    refresh: refreshDigest,
  } = useWatchlistDigest(user?.id ?? null, slugs)

  const load = useCallback(async () => {
    if (!user) {
      setCompanies([])
      setSourceBySlug(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const slugs = await fetchWatchlistSlugs(supabase)
      const [cos, rows, srcMap] = await Promise.all([
        fetchCompaniesForSlugs(supabase, slugs),
        fetchResearchCacheRowsForSlugs(slugs),
        fetchSourceBaseUrlsBySlugs(supabase, slugs),
      ])
      setCompanies(cos)
      setSourceBySlug(srcMap)
      const map = new Map<string, CompanyResearchRow>()
      for (const r of rows) map.set(r.slug, r)
      setResearchMap(map)
    } catch (e) {
      setError(formatUnknownError(e))
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  useEffect(() => {
    if (!user || companies.length === 0) return
    const t = setInterval(() => {
      void fetchResearchCacheRowsForSlugs(companies.map((c) => c.slug))
        .then((rows) => {
          const map = new Map<string, CompanyResearchRow>()
          for (const r of rows) map.set(r.slug, r)
          setResearchMap(map)
        })
        .catch(() => {})
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

  const openPortfolioChat = useCallback(async () => {
    if (!user) {
      router.push('/chat/__portfolio__')
      return
    }
    try {
      const convo = await createConversation(user.id, '__portfolio__')
      router.push(`/chat/__portfolio__/${convo.id}`)
    } catch {
      // Fall back to the conversation list if the insert fails.
      router.push('/chat/__portfolio__')
    }
  }, [user, router])

  const handleRemove = async (slug: string) => {
    try {
      await deleteWatchlistSlug(supabase, slug)
      setCompanies((prev) => prev.filter((c) => c.slug !== slug))
      setSourceBySlug((prev) => {
        const next = new Map(prev)
        next.delete(slug)
        return next
      })
    } catch (e) {
      setError(formatUnknownError(e))
    }
  }

  const atCap = companies.length >= WATCHLIST_CAP

  return (
    <View style={[styles.screen, { backgroundColor: brand.navy }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + space.md, borderBottomColor: brand.stroke },
        ]}
      >
        <Pressable style={styles.menuBtn} onPress={openSidebar} hitSlop={10} accessibilityLabel="Open menu">
          <Ionicons name="menu-outline" size={28} color={brand.tealLight} />
        </Pressable>
        <VerityMark size={36} />
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: brand.onNavy }]}>Watchlist</Text>
          {user ? (
            <Text style={[styles.headerGreeting, { color: brand.onNavySubtle }]} numberOfLines={1}>
              {getGreetingForUser({
                email: user.email,
                username: (user.user_metadata as Record<string, unknown> | undefined)?.username as string | undefined,
              })}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.companyCount, { color: brand.onNavySubtle }]}>
          {companies.length}/{WATCHLIST_CAP}
        </Text>
      </View>

      {error ? (
        <View style={[styles.errBanner, { backgroundColor: 'rgba(185, 28, 28, 0.25)' }]}>
          <Text style={[styles.err, { color: brand.onNavy }]}>{error}</Text>
        </View>
      ) : null}

      {/* Digest summary — shown once companies are loaded */}
      {!loading && companies.length > 0 ? (
        <View style={styles.digestArea}>
          <DigestCard
            digest={digest}
            loading={digestLoading}
            error={digestError}
            onRefresh={() => void refreshDigest()}
            onOpenChat={() => void openPortfolioChat()}
          />
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={brand.tealLight} size="large" style={{ marginTop: space.xl }} />
      ) : companies.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: brand.onNavy }]}>Your watchlist is empty</Text>
          <Text style={[styles.emptyBody, { color: brand.onNavyMuted }]}>
            Search for any public company below. Verity tracks the gap between what the company officially says and
            what media and analysts are reporting.
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: brand.tealDark }]}
            onPress={() => setShowSearch(true)}
          >
            <Text style={styles.emptyBtnText}>Add your first company</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.listOuter}>
          <BlurView intensity={48} tint={brand.blurTint} style={styles.listGlassOuter}>
            <View style={[styles.listGlassInner, { backgroundColor: brand.glassNavy }]}>
              <FlatList
                data={companies}
                keyExtractor={(c) => c.slug}
                style={styles.listFlex}
                contentContainerStyle={{
                  paddingBottom: insets.bottom + 88,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => (
                  <CompanyCard
                    company={item}
                    research={researchMap.get(item.slug)}
                    logoCandidates={buildCompanyLogoCandidates({
                      explicit: item.logo_url,
                      sourceBaseUrls: sourceBySlug.get(item.slug) ?? [],
                    })}
                    brand={brand}
                    isLast={index === companies.length - 1}
                    onPress={() => router.push(`/company/${item.slug}`)}
                    onRemove={() => void handleRemove(item.slug)}
                  />
                )}
              />
            </View>
          </BlurView>
        </View>
      )}

      <View
        style={[styles.searchOrbContainer, { paddingBottom: insets.bottom + space.md }]}
        pointerEvents="box-none"
      >
        <LiquidGlassSearchOrb
          variant="onNavy"
          onOpen={() => {
            if (!atCap) setShowSearch(true)
          }}
          disabled={atCap}
          iconColor={atCap ? brand.onNavySubtle : brand.onNavy}
          accessibilityLabel={
            atCap
              ? `Watchlist full, ${WATCHLIST_CAP} of ${WATCHLIST_CAP} companies`
              : 'Add company to watchlist, open search'
          }
        />
      </View>

      <SearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={handleAddCompany}
        currentSlugs={companies.map((c) => c.slug)}
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
    gap: space.sm,
  },
  menuBtn: { padding: 4, marginRight: 2 },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: font.semi, fontSize: 18, letterSpacing: -0.3 },
  headerGreeting: { fontFamily: font.regular, fontSize: 12, marginTop: 1 },
  companyCount: { fontFamily: font.regular, fontSize: 12 },

  digestArea: {
    marginHorizontal: space.lg,
    marginTop: space.md,
    marginBottom: space.xs,
  },
  digestShimmer: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  digestShimmerText: { fontFamily: font.regular, fontSize: 13 },
  digestPrompt: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
  },
  digestPromptText: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  digestCard: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  digestCardInner: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  digestKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  digestDot: { width: 6, height: 6, borderRadius: 3 },
  digestKicker: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    flex: 1,
  },
  digestKickerHint: {
    fontFamily: font.medium,
    fontSize: 11,
  },
  digestText: { fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  digestFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  digestMeta: { fontFamily: font.regular, fontSize: 11 },
  digestRefreshBtn: { fontFamily: font.medium, fontSize: 12 },
  errBanner: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
  },
  err: { fontFamily: font.regular, fontSize: 14 },

  listOuter: {
    flex: 1,
    marginHorizontal: space.lg,
    marginTop: space.sm,
  },
  listGlassOuter: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  listGlassInner: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  listFlex: { flex: 1 },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
  },
  listRowMain: { flex: 1, minWidth: 0 },
  listSubtitle: { fontFamily: font.regular, fontSize: 12, marginTop: 4, lineHeight: 16 },
  chevron: { fontSize: 20, fontWeight: '300', marginRight: -4 },
  removeIconHit: { padding: 6 },
  removeBtnText: { fontSize: 13 },
  cardName: { fontFamily: font.semi, fontSize: 16, letterSpacing: -0.3 },
  cardTicker: { fontFamily: font.medium, fontSize: 12, marginTop: 2 },

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
  emptyBtn: { borderRadius: radius.md, paddingVertical: space.md, alignItems: 'center' },
  emptyBtnText: { fontFamily: font.semi, color: '#ffffff', fontSize: 15 },

  searchOrbContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4,
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
  resultText: { flex: 1, minWidth: 0 },
  resultName: { fontFamily: font.semi, fontSize: 15 },
  resultMeta: { fontFamily: font.regular, fontSize: 13, marginTop: 2 },
  addToWatchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLabel: { fontFamily: font.semi, fontSize: 13 },
  emptyResults: {
    fontFamily: font.regular,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
  },
  capMessage: { padding: space.xl, gap: space.sm },
  capTitle: { fontFamily: font.semi, fontSize: 18 },
  capBody: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
})
