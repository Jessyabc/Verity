/**
 * Company profile / research — Verity brand: navy, teal, glass; gaps hero; strict source buckets.
 */

import { HeaderBackButton, useHeaderHeight } from '@react-navigation/elements'
import type { NativeStackHeaderBackProps } from '@react-navigation/native-stack'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useState } from 'react'
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
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
  factualGapCategory,
  factualGapText,
  fetchResearchCacheRow,
  type CompanyResearchRow,
  type FactualGap,
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
import { formatMarketCap } from '@/lib/finnhub'
import { supabase } from '@/lib/supabase'

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const GAP_CATEGORY_LABEL: Record<string, string> = {
  numeric: 'Numeric',
  disclosure: 'Disclosure',
  timing: 'Timing',
  definition: 'Definition',
  coverage: 'Coverage',
}

function gapCategoryLabel(category: string | undefined): string | null {
  if (!category) return null
  return GAP_CATEGORY_LABEL[category] ?? category.charAt(0).toUpperCase() + category.slice(1)
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
      style={({ pressed }) => [
        styles.sourceRow,
        { borderTopColor: BRAND.stroke },
        { opacity: pressed ? 0.92 : 1 },
      ]}
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
  const slice = gaps.slice(0, 5)
  const thinCoverage = slice.length > 0 && slice.length < 3
  return (
    <GlassChrome>
      <View style={[styles.heroPad, { backgroundColor: BRAND.glassNavy }]}>
        <View style={styles.gapsTitleRow}>
          <View style={[styles.tealDot, { backgroundColor: BRAND.tealDark }]} />
          <Text style={styles.gapsTitle}>FACTUAL GAPS (THIS QUARTER)</Text>
        </View>
        {slice.length > 0 ? (
          <>
            {slice.map((gap, i) => {
              const label = gapCategoryLabel(factualGapCategory(gap))
              const num = String(i + 1).padStart(2, '0')
              return (
                <View
                  key={i}
                  style={[
                    styles.gapBlock,
                    i < slice.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BRAND.stroke },
                  ]}
                >
                  <View style={styles.gapBlockHeader}>
                    <Text style={[styles.gapIndex, { color: BRAND.tealLight }]}>{num}</Text>
                    {label ? (
                      <View style={[styles.gapCategoryChip, { borderColor: BRAND.stroke }]}>
                        <Text style={[styles.gapCategoryChipText, { color: BRAND.onNavySubtle }]}>{label}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.gapText, { color: BRAND.onNavy }]}>{factualGapText(gap)}</Text>
                </View>
              )
            })}
            <Text style={[styles.gapsFooter, { color: BRAND.onNavySubtle }]}>
              Objective mismatches only · no interpretation
            </Text>
            {thinCoverage ? (
              <Text style={[styles.gapsFooterThin, { color: BRAND.onNavySubtle }]}>
                Limited independent coverage—gaps may reflect disclosure depth rather than disagreement.
              </Text>
            ) : null}
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
  subtitle,
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
  subtitle: string
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

  const toggleSources = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen((v) => !v)
  }

  const bodyBlock = (
    <>
      {bodyText?.trim() ? (
        <Text style={[styles.narrBody, { color: BRAND.onNavy }]}>{bodyText.trim()}</Text>
      ) : (
        <Text style={[styles.narrPlaceholder, { color: BRAND.onNavyMuted }]}>{placeholder}</Text>
      )}

      {sourceItems.length > 0 ? (
        <View style={styles.sourcesWrap}>
          <Pressable
            style={({ pressed }) => [styles.sourcesToggle, { opacity: pressed ? 0.85 : 1 }]}
            onPress={toggleSources}
          >
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
    </>
  )

  const inner = (
    <View style={styles.narrativeRow}>
      {glass === 'navy' ? (
        <View style={[styles.narrativeAccent, { backgroundColor: BRAND.tealDark }]} />
      ) : (
        <LinearGradient
          colors={[BRAND.tealDark, BRAND.tealLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.narrativeAccent}
        />
      )}
      {glass === 'navy' ? (
        <View style={[styles.narrativeMain, styles.narrativeMainCompany]}>
          <View style={styles.titleRow}>
            <View style={styles.narrTitleLead}>
              <VerityMark size={24} />
              <Ionicons name="business-outline" size={20} color={BRAND.tealLight} style={styles.narrLeadIcon} />
            </View>
            <Text style={[styles.narrTitle, { color: BRAND.onNavy }]}>{title}</Text>
            <View style={[styles.badge, { borderColor: BRAND.tealDark }]}>
              <Text style={[styles.badgeText, { color: BRAND.tealLight }]}>{badge}</Text>
            </View>
          </View>
          <Text style={[styles.narrSubtitle, { color: BRAND.onNavySubtle }]}>{subtitle}</Text>
          {bodyBlock}
        </View>
      ) : (
        <View style={styles.narrativeMainMediaOuter}>
          <View style={[StyleSheet.absoluteFillObject, styles.narrativeMainMediaBase]} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: BRAND.glassTealWash }]} />
          <View style={styles.narrativeMain}>
            <View style={styles.titleRow}>
              <View style={styles.narrTitleLead}>
                <Ionicons name="newspaper-outline" size={22} color={BRAND.tealLight} style={styles.narrLeadIcon} />
              </View>
              <Text style={[styles.narrTitle, { color: BRAND.onNavy }]}>{title}</Text>
              <View style={[styles.badge, { borderColor: BRAND.tealDark }]}>
                <Text style={[styles.badgeText, { color: BRAND.tealLight }]}>{badge}</Text>
              </View>
            </View>
            <Text style={[styles.narrSubtitle, { color: BRAND.onNavySubtle }]}>{subtitle}</Text>
            {bodyBlock}
          </View>
        </View>
      )}
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

type MarketStripProps = {
  price: number
  changePct: number
  marketCap: number | null
  peRatio: number | null
}

function MarketGlassStrip({ price, changePct, marketCap, peRatio }: MarketStripProps) {
  const changeStr = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`
  return (
    <GlassChrome>
      <View style={[styles.marketGlassInner, { backgroundColor: BRAND.glassNavy }]}>
        <View style={styles.marketCol}>
          <Text style={[styles.marketLabel, { color: BRAND.onNavySubtle }]}>LAST</Text>
          <Text style={[styles.marketPrice, { color: BRAND.onNavy }]}>${price.toFixed(2)}</Text>
        </View>
        <View style={styles.marketCol}>
          <Text style={[styles.marketLabel, { color: BRAND.onNavySubtle }]}>DAY</Text>
          <Text style={[styles.marketChange, { color: BRAND.onNavy }]}>{changeStr}</Text>
        </View>
        {marketCap ? (
          <View style={styles.marketCol}>
            <Text style={[styles.marketLabel, { color: BRAND.onNavySubtle }]}>MKT CAP</Text>
            <Text style={[styles.marketStat, { color: BRAND.onNavy }]}>{formatMarketCap(marketCap)}</Text>
          </View>
        ) : null}
        {peRatio ? (
          <View style={styles.marketCol}>
            <Text style={[styles.marketLabel, { color: BRAND.onNavySubtle }]}>P/E</Text>
            <Text style={[styles.marketStat, { color: BRAND.onNavy }]}>{peRatio.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>
    </GlassChrome>
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
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
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
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: BRAND.tealDark, opacity: pressed ? 0.92 : 1 },
          ]}
          onPress={() => router.back()}
        >
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
          <View style={[styles.banner, { backgroundColor: 'rgba(185, 28, 28, 0.22)' }]}>
            <Text style={[styles.bannerTitle, { color: BRAND.onNavy }]}>Something went wrong</Text>
            <Text style={[styles.bannerBody, { color: BRAND.onNavyMuted }]}>
              Pull to refresh or try again. {error}
            </Text>
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
            style={({ pressed }) => [
              styles.refreshBtn,
              {
                backgroundColor: BRAND.tealDark,
                opacity: researchBusy ? 0.75 : pressed ? 0.92 : 1,
              },
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
          <View style={styles.marketSection}>
            <MarketGlassStrip
              price={marketData.price}
              changePct={marketData.changePct}
              marketCap={marketData.marketCap}
              peRatio={marketData.peRatio}
            />
            <View style={[styles.researchDivider, { backgroundColor: BRAND.stroke }]} />
          </View>
        ) : null}

        {/* 3 — Factual gaps (hero) */}
        <View style={styles.gapsSectionWrap}>
          <FactualGapsHero gaps={factualGaps} />
        </View>

        {/* 4 — Company narrative */}
        <View style={styles.narrSectionSpacing}>
          <NarrativeCard
            title="Company Narrative"
            subtitle="From IR, filings, and earnings materials"
            badge="Official IR & Filings"
            glass="navy"
            bodyText={research?.company_narrative ?? null}
            placeholder="Run refresh for a neutral summary drawn only from official IR and SEC filings."
            sourceItems={companyItems}
            sourcesLabel="Company IR / Official"
            savedUrls={savedUrls}
            savedRows={savedRows}
            narrativeType="company"
            onSaveToggle={handleSaveToggle}
          />
        </View>

        {/* 5 — Media & analyst narrative */}
        <View style={styles.narrSectionSpacing}>
          <NarrativeCard
            title="Media & Analyst Narrative"
            subtitle="From third-party news and analyst coverage"
            badge="Independent Sources"
            glass="teal"
            bodyText={research?.media_narrative ?? null}
            placeholder="Run refresh for a neutral summary drawn only from independent third-party sources."
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
          style={({ pressed }) => [
            styles.discussBtn,
            {
              backgroundColor: BRAND.tealDark,
              opacity: researchBusy ? 0.75 : pressed ? 0.94 : 1,
            },
          ]}
          onPress={() => {
            if (hasResearch) router.push(`/chat/${slug}`)
            else void runResearch()
          }}
          disabled={researchBusy}
        >
          <Text style={styles.discussBtnText}>
            {hasResearch ? 'Continue in chat with Verity' : 'Run research to open chat'}
          </Text>
        </Pressable>

        <Text style={[styles.disclaimer, { color: BRAND.onNavySubtle }]}>
          Not investment advice · Compare official and independent narratives above · AI may be incomplete · verify with
          primary sources
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

  marketSection: { marginTop: space.sm },
  researchDivider: { height: StyleSheet.hairlineWidth, marginTop: space.lg },
  marketGlassInner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
  },
  marketCol: { minWidth: 56 },
  marketLabel: { fontFamily: font.medium, fontSize: 10, letterSpacing: 0.6, marginBottom: 2 },
  marketPrice: { fontFamily: font.semi, fontSize: 17, fontVariant: ['tabular-nums'] },
  marketChange: { fontFamily: font.medium, fontSize: 15, fontVariant: ['tabular-nums'] },
  marketStat: { fontFamily: font.regular, fontSize: 14, fontVariant: ['tabular-nums'] },

  gapsSectionWrap: { marginTop: space.xl },
  narrSectionSpacing: { marginTop: space.lg },

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
  gapBlock: { paddingVertical: space.sm },
  gapBlockHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  gapIndex: { fontFamily: font.semi, fontSize: 13, letterSpacing: 0.5, minWidth: 28 },
  gapCategoryChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  gapCategoryChipText: { fontFamily: font.medium, fontSize: 10, letterSpacing: 0.3 },
  gapText: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  gapsFooter: { fontFamily: font.regular, fontSize: 11, marginTop: space.md },
  gapsFooterThin: { fontFamily: font.regular, fontSize: 11, marginTop: space.sm, lineHeight: 16 },
  placeholderText: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },

  narrativeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  narrativeAccent: { width: 4, alignSelf: 'stretch' },
  narrativeMain: { flex: 1, minWidth: 0, padding: space.lg },
  narrativeMainCompany: { backgroundColor: 'rgba(6, 26, 45, 0.92)' },
  narrativeMainMediaOuter: { flex: 1, minWidth: 0, position: 'relative' },
  narrativeMainMediaBase: { backgroundColor: 'rgba(10, 37, 64, 0.82)' },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  narrTitleLead: { flexDirection: 'row', alignItems: 'center', marginRight: 2 },
  narrLeadIcon: { marginLeft: 6, opacity: 0.92 },
  narrTitle: { fontFamily: font.semi, fontSize: 17, flex: 1, minWidth: 0 },
  narrSubtitle: { fontFamily: font.regular, fontSize: 12, lineHeight: 17, marginTop: space.xs },
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
  bannerTitle: { fontFamily: font.semi, fontSize: 15, marginBottom: space.xs },
  bannerBody: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
})
