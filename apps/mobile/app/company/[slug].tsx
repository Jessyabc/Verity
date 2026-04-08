/**
 * Company profile / research — Verity brand: navy, teal, glass; gaps hero; strict source buckets.
 */

import { HeaderBackButton, useHeaderHeight } from '@react-navigation/elements'
import type { NativeStackHeaderBackProps } from '@react-navigation/native-stack'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

import Ionicons from '@expo/vector-icons/Ionicons'
import { LiquidGlassHeaderIconButton } from '@/components/LiquidGlass'
import { VerityMark } from '@/components/VerityMark'
import { useAuth } from '@/contexts/AuthContext'
import { BRAND } from '@/constants/brand'
import { font, radius, space } from '@/constants/theme'
import { fetchCompanyBundleBySlug } from '@/lib/companyBundle'
import type { CompanyRow } from '@/lib/companyBySlug'
import { formatAgo, formatResearchUpdated, formatUnknownError } from '@/lib/format'
import { itemIsCompanySource, itemIsMediaSource } from '@/lib/headlineGrouping'
import {
  deleteWatchlistSlug,
  fetchWatchlistSlugs,
  insertWatchlistSlug,
} from '@/lib/watchlistApi'
import {
  fetchResearchCacheRow,
  type CompanyResearchRow,
  type ResearchNewsItem,
} from '@/lib/researchCache'
import { invokeResearchCompany } from '@/lib/researchRefresh'
import {
  fetchSavedHeadlines,
  saveHeadline,
  unsaveHeadline,
  savedUrlSet,
  type SavedHeadlineRow,
} from '@/lib/savedHeadlines'
import { openUrl } from '@/lib/openUrl'
import { useMarketData } from '@/hooks/useMarketData'
import { formatMarketCap, changeColor } from '@/lib/finnhub'
import { supabase } from '@/lib/supabase'

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

type FactualGap = { text: string } | string

function gapLine(gap: FactualGap): string {
  return typeof gap === 'string' ? gap : gap.text ?? ''
}

function SourceLinkRow({
  item,
  savedUrls,
  savedRows,
  narrativeType,
  onSaveToggle,
}: {
  item: ResearchNewsItem
  savedUrls: Set<string>
  savedRows: SavedHeadlineRow[]
  narrativeType: 'company' | 'media'
  onSaveToggle: (item: ResearchNewsItem, savedId?: string, type?: 'company' | 'media') => void
}) {
  const isSaved = savedUrls.has(item.url)
  const savedRow = savedRows.find((r) => r.url === item.url)
  return (
    <Pressable
      style={[styles.sourceRow, { borderTopColor: BRAND.stroke }]}
      onPress={() => void openUrl(item.url)}
    >
      <View style={styles.sourceBody}>
        <Text style={[styles.sourceTitle, { color: BRAND.tealLight }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.sourceMeta, { color: BRAND.onNavySubtle }]} numberOfLines={1}>
          {item.source ?? safeHostname(item.url)}
          {item.published_at ? ` · ${formatAgo(item.published_at)}` : ''}
        </Text>
      </View>
      <Pressable
        style={styles.bookmarkBtn}
        onPress={() => onSaveToggle(item, savedRow?.id, narrativeType)}
        hitSlop={10}
      >
        <Text style={[styles.bookmarkIcon, { color: isSaved ? BRAND.tealLight : BRAND.onNavySubtle }]}>
          {isSaved ? '✦' : '✧'}
        </Text>
      </Pressable>
    </Pressable>
  )
}

function GlassChrome({ children }: { children: ReactNode }) {
  return (
    <BlurView intensity={48} tint="dark" style={styles.glassBlurOuter}>
      <View style={styles.glassChromeInner}>{children}</View>
    </BlurView>
  )
}

function FactualGapsHero({ gaps }: { gaps: FactualGap[] }) {
  return (
    <GlassChrome>
      <View style={[styles.heroPad, { backgroundColor: BRAND.glassNavy }]}>
        <View style={styles.gapsTitleRow}>
          <View style={[styles.tealDot, { backgroundColor: BRAND.tealDark }]} />
          <Text style={styles.gapsTitle}>BIGGEST FACTUAL GAPS THIS QUARTER</Text>
        </View>
        {gaps.length > 0 ? (
          <>
            {gaps.slice(0, 5).map((gap, i) => (
              <View key={i} style={styles.gapRow}>
                <Text style={[styles.gapBullet, { color: BRAND.tealLight }]}>•</Text>
                <Text style={[styles.gapText, { color: BRAND.onNavy }]}>{gapLine(gap)}</Text>
              </View>
            ))}
            <Text style={[styles.gapsFooter, { color: BRAND.onNavySubtle }]}>
              Objective mismatches only · no interpretation
            </Text>
          </>
        ) : (
          <Text style={[styles.placeholderText, { color: BRAND.onNavyMuted }]}>
            Refresh research to surface factual mismatches.
          </Text>
        )}
      </View>
    </GlassChrome>
  )
}

function NarrativeCard({
  title,
  badge,
  glass,
  bodyText,
  placeholder,
  sourceItems,
  sourcesLabel,
  savedUrls,
  savedRows,
  narrativeType,
  onSaveToggle,
}: {
  title: string
  badge: string
  glass: 'navy' | 'teal'
  bodyText: string | null
  placeholder: string
  sourceItems: ResearchNewsItem[]
  sourcesLabel: string
  savedUrls: Set<string>
  savedRows: SavedHeadlineRow[]
  narrativeType: 'company' | 'media'
  onSaveToggle: (item: ResearchNewsItem, savedId?: string, type?: 'company' | 'media') => void
}) {
  const [open, setOpen] = useState(false)

  const inner = (
    <View
      style={[
        styles.narrativeInner,
        glass === 'navy'
          ? { backgroundColor: BRAND.glassNavy }
          : { backgroundColor: 'rgba(10, 37, 64, 0.55)' },
      ]}
    >
      <View style={styles.titleRow}>
        {glass === 'navy' ? (
          <View style={styles.narrTitleLead}>
            <VerityMark size={24} />
          </View>
        ) : null}
        <Text style={[styles.narrTitle, { color: BRAND.onNavy }]}>{title}</Text>
        <View style={[styles.badge, { borderColor: BRAND.tealDark }]}>
          <Text style={[styles.badgeText, { color: BRAND.tealLight }]}>{badge}</Text>
        </View>
      </View>
      {bodyText?.trim() ? (
        <Text style={[styles.narrBody, { color: BRAND.onNavy }]}>{bodyText.trim()}</Text>
      ) : (
        <Text style={[styles.narrPlaceholder, { color: BRAND.onNavyMuted }]}>{placeholder}</Text>
      )}

      {sourceItems.length > 0 ? (
        <View style={styles.sourcesWrap}>
          <Pressable style={styles.sourcesToggle} onPress={() => setOpen((v) => !v)}>
            <Text style={[styles.sourcesLabel, { color: BRAND.onNavySubtle }]}>{sourcesLabel}</Text>
            <Text style={[styles.sourcesToggleText, { color: BRAND.tealLight }]}>
              {open ? 'Hide' : 'Show'} ({sourceItems.length})
            </Text>
          </Pressable>
          {open
            ? sourceItems.map((item, i) => (
                <SourceLinkRow
                  key={`${item.url}-${i}`}
                  item={item}
                  savedUrls={savedUrls}
                  savedRows={savedRows}
                  narrativeType={narrativeType}
                  onSaveToggle={onSaveToggle}
                />
              ))
            : null}
        </View>
      ) : null}
    </View>
  )

  if (glass === 'teal') {
    return (
      <LinearGradient
        colors={['rgba(92, 154, 154, 0.42)', 'rgba(140, 198, 192, 0.32)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tealGradientBorder}
      >
        <BlurView intensity={44} tint="dark" style={styles.glassBlurOuter}>
          <View style={styles.tealWash}>{inner}</View>
        </BlurView>
      </LinearGradient>
    )
  }

  return (
    <BlurView intensity={48} tint="dark" style={styles.glassBlurOuter}>
      {inner}
    </BlurView>
  )
}

export default function CompanyScreen() {
  const { slug: slugParam } = useLocalSearchParams<{ slug: string }>()
  const slug = typeof slugParam === 'string' ? slugParam : slugParam?.[0] ?? ''
  const navigation = useNavigation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const headerHeight = useHeaderHeight()
  const { user } = useAuth()

  const [company, setCompany] = useState<CompanyRow | null>(null)
  const [, setLogoFallbackBaseUrl] = useState<string | null>(null)
  const { data: marketData } = useMarketData(company?.ticker)
  const [research, setResearch] = useState<CompanyResearchRow | null>(null)
  const [savedRows, setSavedRows] = useState<SavedHeadlineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [researchBusy, setResearchBusy] = useState(false)
  const [onWatchlist, setOnWatchlist] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedUrls = savedUrlSet(savedRows)

  const load = useCallback(async () => {
    if (!slug) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const [bundle, r, wl] = await Promise.all([
        fetchCompanyBundleBySlug(slug),
        fetchResearchCacheRow(slug),
        user ? fetchWatchlistSlugs(supabase) : Promise.resolve([] as string[]),
      ])
      setCompany(bundle.company)
      setLogoFallbackBaseUrl(bundle.logoFallbackBaseUrl)
      setResearch(r)
      setOnWatchlist(wl.includes(slug))
      if (user) {
        try {
          setSavedRows(await fetchSavedHeadlines(slug))
        } catch {
          /* optional */
        }
      }
    } catch (e) {
      setError(formatUnknownError(e))
    } finally {
      setLoading(false)
    }
  }, [slug, user])

  useEffect(() => {
    void load()
  }, [load])

  const toggleWatchlist = useCallback(async () => {
    if (!user || !slug) return
    try {
      if (onWatchlist) {
        await deleteWatchlistSlug(supabase, slug)
        setOnWatchlist(false)
      } else {
        await insertWatchlistSlug(supabase, user.id, slug)
        setOnWatchlist(true)
      }
    } catch (e) {
      setError(formatUnknownError(e))
    }
  }, [user, slug, onWatchlist])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '',
      headerBackTitleVisible: false,
      headerBackButtonDisplayMode: 'minimal',
      headerTransparent: true,
      headerShadowVisible: false,
      headerTintColor: BRAND.tealLight,
      headerBlurEffect:
        Platform.OS === 'ios' ? ('systemChromeMaterialDark' as const) : undefined,
      headerStyle: {
        backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(10, 37, 64, 0.72)',
      },
      headerBackground: () =>
        Platform.OS === 'android' ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null,
      headerLeft: (_props: NativeStackHeaderBackProps) => (
        <View style={styles.navLeft}>
          <HeaderBackButton
            displayMode="minimal"
            tintColor={BRAND.tealLight}
            onPress={() => navigation.goBack()}
          />
          <VerityMark size={26} />
        </View>
      ),
      headerRight: () =>
        user ? (
          <LiquidGlassHeaderIconButton
            accessibilityLabel={onWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
            active={onWatchlist}
            onPress={() => void toggleWatchlist()}
          >
            <Ionicons
              name={onWatchlist ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={onWatchlist ? BRAND.tealLight : BRAND.onNavySubtle}
            />
          </LiquidGlassHeaderIconButton>
        ) : null,
    })
  }, [navigation, user, onWatchlist, toggleWatchlist])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const runResearch = async () => {
    if (!company) return
    setResearchBusy(true)
    setError(null)
    try {
      await invokeResearchCompany(company.slug, company.name, company.ticker)
      setResearch(await fetchResearchCacheRow(company.slug))
    } catch (e) {
      setError(formatUnknownError(e))
    } finally {
      setResearchBusy(false)
    }
  }

  const handleSaveToggle = async (
    item: ResearchNewsItem,
    savedId?: string,
    narrativeType?: 'company' | 'media',
  ) => {
    if (!user) return
    try {
      if (savedId) {
        await unsaveHeadline(savedId)
        setSavedRows((prev) => prev.filter((r) => r.id !== savedId))
      } else {
        await saveHeadline(user.id, slug, item, narrativeType ?? 'media')
        setSavedRows(await fetchSavedHeadlines(slug))
      }
    } catch {
      /* non-critical */
    }
  }

  if (!slug) {
    return (
      <View style={[styles.center, { backgroundColor: BRAND.navy, paddingTop: headerHeight }]}>
        <Text style={{ color: BRAND.onNavyMuted }}>Missing company.</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: BRAND.navy, paddingTop: headerHeight }]}>
        <ActivityIndicator color={BRAND.tealLight} size="large" />
      </View>
    )
  }

  if (!company) {
    return (
      <View
        style={[styles.center, { backgroundColor: BRAND.navy, padding: space.xl, paddingTop: headerHeight }]}
      >
        <Text style={[styles.h1, { color: BRAND.onNavy }]}>Not found</Text>
        <Text style={{ color: BRAND.onNavyMuted, marginTop: space.md, textAlign: 'center' }}>
          {"This company isn't in the database yet."}
        </Text>
        <Pressable style={[styles.backBtn, { backgroundColor: BRAND.tealDark }]} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  const allItems = research?.items ?? []
  const companyItems = allItems.filter(itemIsCompanySource)
  const mediaItems = allItems.filter(itemIsMediaSource)

  const factualGaps = Array.isArray(research?.factual_gaps)
    ? (research?.factual_gaps as FactualGap[])
    : []

  const hasResearch =
    allItems.length > 0 ||
    Boolean(research?.company_narrative?.trim()) ||
    Boolean(research?.media_narrative?.trim()) ||
    factualGaps.length > 0

  const headerLine = company.ticker ? `${company.name} · ${company.ticker}` : company.name

  return (
    <View style={[styles.container, { backgroundColor: BRAND.navy }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          {
            paddingTop: headerHeight + space.md,
            paddingBottom: insets.bottom + space.xxl + 24,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={BRAND.tealLight} />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={[styles.banner, { backgroundColor: 'rgba(185, 28, 28, 0.25)' }]}>
            <Text style={{ color: BRAND.onNavy }}>{error}</Text>
          </View>
        ) : null}

        {/* 1 — Header */}
        <Text style={[styles.headerLine, { color: BRAND.onNavy }]}>{headerLine}</Text>

        {/* 2 — Updated + Refresh */}
        <View style={styles.refreshRow}>
          <Text style={[styles.updatedLine, { color: BRAND.onNavyMuted }]}>
            {formatResearchUpdated(research?.fetched_at)}
          </Text>
          <Pressable
            style={[
              styles.refreshBtn,
              { backgroundColor: researchBusy ? BRAND.tealDark : BRAND.tealDark, opacity: researchBusy ? 0.75 : 1 },
            ]}
            onPress={() => void runResearch()}
            disabled={researchBusy}
          >
            {researchBusy ? (
              <ActivityIndicator color={BRAND.onNavy} size="small" />
            ) : (
              <Text style={styles.refreshBtnLabel}>Refresh</Text>
            )}
          </Pressable>
        </View>

        {marketData ? (
          <View style={styles.marketRow}>
            <Text style={[styles.price, { color: BRAND.onNavy }]}>
              ${marketData.price.toFixed(2)}
            </Text>
            <Text
              style={[
                styles.change,
                {
                  color: changeColor(
                    marketData.changePct,
                    BRAND.tealLight,
                    '#f87171',
                    BRAND.onNavySubtle,
                  ),
                },
              ]}
            >
              {marketData.changePct >= 0 ? '+' : ''}
              {marketData.changePct.toFixed(2)}%
            </Text>
            {marketData.marketCap ? (
              <Text style={[styles.marketMeta, { color: BRAND.onNavySubtle }]}>
                {formatMarketCap(marketData.marketCap)}
              </Text>
            ) : null}
            {marketData.peRatio ? (
              <Text style={[styles.marketMeta, { color: BRAND.onNavySubtle }]}>
                P/E {marketData.peRatio.toFixed(1)}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* 3 — Factual gaps (hero) */}
        <View style={styles.sectionGap}>
          <FactualGapsHero gaps={factualGaps} />
        </View>

        {/* 4 — Company narrative */}
        <View style={styles.sectionGap}>
          <NarrativeCard
            title="Company Narrative"
            badge="Official IR & Filings"
            glass="navy"
            bodyText={research?.company_narrative ?? null}
            placeholder="Refresh research to generate a neutral summary from official IR and SEC filings only."
            sourceItems={companyItems}
            sourcesLabel="Company IR / Official"
            savedUrls={savedUrls}
            savedRows={savedRows}
            narrativeType="company"
            onSaveToggle={handleSaveToggle}
          />
        </View>

        {/* 5 — Media & analyst narrative */}
        <View style={styles.sectionGap}>
          <NarrativeCard
            title="Media & Analyst Narrative"
            badge="Independent Sources"
            glass="teal"
            bodyText={research?.media_narrative ?? null}
            placeholder="Refresh research to generate a neutral summary from independent third-party sources only."
            sourceItems={mediaItems}
            sourcesLabel="Media & Analyst"
            savedUrls={savedUrls}
            savedRows={savedRows}
            narrativeType="media"
            onSaveToggle={handleSaveToggle}
          />
        </View>

        {/* 6 — Discuss */}
        <Pressable
          style={[styles.discussBtn, { backgroundColor: BRAND.tealDark }]}
          onPress={() => {
            if (hasResearch) router.push(`/chat/${slug}`)
            else void runResearch()
          }}
          disabled={researchBusy}
        >
          <Text style={styles.discussBtnText}>
            {hasResearch ? 'Discuss this research with Verity' : 'Run research to unlock discussion'}
          </Text>
        </Pressable>

        <Text style={[styles.disclaimer, { color: BRAND.onNavySubtle }]}>
          Not investment advice · AI may be incomplete · always verify with primary sources
        </Text>
      </ScrollView>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: space.lg, gap: space.lg },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: Platform.OS === 'ios' ? 4 : 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  h1: { fontFamily: font.semi, fontSize: 22 },

  headerLine: { fontFamily: font.semi, fontSize: 22, letterSpacing: -0.4, lineHeight: 28 },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  updatedLine: { fontFamily: font.regular, fontSize: 14, flex: 1, paddingRight: space.md },
  refreshBtn: {
    borderRadius: radius.md,
    paddingHorizontal: space.xl,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  refreshBtnLabel: { fontFamily: font.semi, fontSize: 15, color: BRAND.onNavy },

  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.xs,
  },
  price: { fontFamily: font.semi, fontSize: 16 },
  change: { fontFamily: font.medium, fontSize: 14 },
  marketMeta: { fontFamily: font.regular, fontSize: 12 },

  sectionGap: { marginTop: space.xs },

  glassBlurOuter: { borderRadius: radius.lg, overflow: 'hidden' },
  glassChromeInner: { borderRadius: radius.lg, overflow: 'hidden' },
  tealGradientBorder: { borderRadius: radius.lg, padding: 1, overflow: 'hidden' },
  tealWash: { borderRadius: radius.lg - 1, overflow: 'hidden' },

  heroPad: { padding: space.lg, borderRadius: radius.lg },
  gapsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  tealDot: { width: 8, height: 8, borderRadius: 4 },
  gapsTitle: {
    fontFamily: font.bold,
    fontSize: 12,
    letterSpacing: 0.9,
    color: BRAND.tealLight,
    flex: 1,
  },
  gapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginBottom: space.sm },
  gapBullet: { fontFamily: font.semi, fontSize: 15, lineHeight: 22, marginTop: 1 },
  gapText: { flex: 1, fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  gapsFooter: { fontFamily: font.regular, fontSize: 11, marginTop: space.sm },
  placeholderText: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },

  narrativeInner: { padding: space.lg, borderRadius: radius.lg },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  narrTitleLead: { marginRight: 2 },
  narrTitle: { fontFamily: font.semi, fontSize: 17, flex: 1, minWidth: 0 },
  badge: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
  badgeText: { fontFamily: font.medium, fontSize: 11 },
  narrBody: { fontFamily: font.regular, fontSize: 16, lineHeight: 24, marginTop: space.md },
  narrPlaceholder: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: space.md, fontStyle: 'italic' },
  sourcesWrap: { marginTop: space.lg },
  sourcesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.xs,
  },
  sourcesLabel: { fontFamily: font.medium, fontSize: 12 },
  sourcesToggleText: { fontFamily: font.semi, fontSize: 12 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  sourceBody: { flex: 1, minWidth: 0 },
  sourceTitle: { fontFamily: font.semi, fontSize: 13, lineHeight: 19 },
  sourceMeta: { fontFamily: font.regular, fontSize: 11, marginTop: 2 },
  bookmarkBtn: { paddingTop: 2 },
  bookmarkIcon: { fontSize: 16 },

  discussBtn: {
    borderRadius: radius.md,
    paddingVertical: space.md + 2,
    alignItems: 'center',
    marginTop: space.sm,
  },
  discussBtnText: {
    fontFamily: font.semi,
    fontSize: 16,
    color: BRAND.onNavy,
    textAlign: 'center',
    paddingHorizontal: space.md,
  },
  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    textAlign: 'center',
    marginTop: space.md,
    lineHeight: 16,
  },

  backBtn: {
    marginTop: space.xl,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.sm,
  },
  backBtnText: { fontFamily: font.semi, color: BRAND.onNavy, fontSize: 15 },
  banner: { padding: space.md, borderRadius: radius.sm, marginBottom: space.sm },
})
