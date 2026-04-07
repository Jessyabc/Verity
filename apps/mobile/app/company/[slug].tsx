/**
 * Company profile — the hero screen.
 *
 * Exact hierarchy (top → bottom):
 *  1. Identity card (logo · name · ticker · market data)
 *  2. Biggest Factual Gaps This Quarter  ← new, highest priority
 *  3. Company Narrative                  ← official IR / filings only
 *  4. Media & Analyst Narrative          ← news / analysts
 *  5. "Discuss this research" CTA        ← opens chat
 */

import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LiquidGlassFAB } from '@/components/LiquidGlass'
import { CompanyLogo } from '@/components/CompanyLogo'
import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { fetchCompanyBundleBySlug } from '@/lib/companyBundle'
import type { CompanyRow } from '@/lib/companyBySlug'
import { formatAgo } from '@/lib/format'
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
import { classifyItem } from '@/lib/headlineGrouping'
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
import { font, radius, space } from '@/constants/theme'

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

// ─── Factual gap ──────────────────────────────────────────────────────────────

type FactualGap = { text: string } | string

function FactualGapText(gap: FactualGap): string {
  return typeof gap === 'string' ? gap : gap.text ?? ''
}

function FactualGapsSection({
  gaps,
  colors,
}: {
  gaps: FactualGap[]
  colors: ReturnType<typeof useVerityPalette>
}) {
  if (gaps.length === 0) return null
  return (
    <View
      style={[
        styles.card,
        styles.gapsCard,
        { backgroundColor: colors.surfaceSolid, borderColor: colors.accent + '44' },
      ]}
    >
      <View style={styles.gapsHeader}>
        <View style={[styles.gapsDot, { backgroundColor: colors.accent }]} />
        <Text style={[styles.gapsKicker, { color: colors.accent }]}>
          BIGGEST FACTUAL GAPS THIS QUARTER
        </Text>
      </View>
      {gaps.slice(0, 5).map((gap, i) => (
        <View key={i} style={styles.gapRow}>
          <Text style={[styles.gapBullet, { color: colors.accent }]}>•</Text>
          <Text style={[styles.gapText, { color: colors.ink }]}>{FactualGapText(gap)}</Text>
        </View>
      ))}
      <Text style={[styles.gapsFooter, { color: colors.inkSubtle }]}>
        Objective mismatches only · no interpretation
      </Text>
    </View>
  )
}

// ─── Source link row ──────────────────────────────────────────────────────────

function SourceRow({
  item,
  savedUrls,
  savedRows,
  companySlug,
  narrativeType,
  colors,
  onSaveToggle,
}: {
  item: ResearchNewsItem
  savedUrls: Set<string>
  savedRows: SavedHeadlineRow[]
  companySlug: string
  narrativeType: 'company' | 'media'
  colors: ReturnType<typeof useVerityPalette>
  onSaveToggle: (item: ResearchNewsItem, savedId?: string, type?: 'company' | 'media') => void
}) {
  const isSaved = savedUrls.has(item.url)
  const savedRow = savedRows.find((r) => r.url === item.url)
  return (
    <Pressable
      style={[styles.sourceRow, { borderTopColor: colors.stroke }]}
      onPress={() => void openUrl(item.url)}
    >
      <View style={styles.sourceBody}>
        <Text style={[styles.sourceTitle, { color: colors.accent }]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[styles.sourceMeta, { color: colors.inkSubtle }]} numberOfLines={1}>
          {item.source ?? safeHostname(item.url)}
          {item.published_at ? ` · ${formatAgo(item.published_at)}` : ''}
        </Text>
      </View>
      <Pressable
        style={styles.bookmarkBtn}
        onPress={() => onSaveToggle(item, savedRow?.id, narrativeType)}
        hitSlop={10}
      >
        <Text style={[styles.bookmarkIcon, { color: isSaved ? colors.accent : colors.inkSubtle }]}>
          {isSaved ? '✦' : '✧'}
        </Text>
      </Pressable>
    </Pressable>
  )
}

// ─── Narrative section (Company / Media) ─────────────────────────────────────

function NarrativeSection({
  label,
  sourceLabel,
  dotColor,
  narrativeText,
  items,
  savedUrls,
  savedRows,
  companySlug,
  narrativeType,
  colors,
  onSaveToggle,
}: {
  label: string
  sourceLabel: string
  dotColor: string
  narrativeText: string | null
  items: ResearchNewsItem[]
  savedUrls: Set<string>
  savedRows: SavedHeadlineRow[]
  companySlug: string
  narrativeType: 'company' | 'media'
  colors: ReturnType<typeof useVerityPalette>
  onSaveToggle: (item: ResearchNewsItem, savedId?: string, type?: 'company' | 'media') => void
}) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  if (!narrativeText && items.length === 0) return null

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
      {/* Section header */}
      <View style={styles.narrativeHeader}>
        <View style={[styles.narrativeDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.narrativeLabel, { color: colors.inkSubtle }]}>
          {label.toUpperCase()}
        </Text>
      </View>

      {/* AI synthesis paragraph */}
      {narrativeText ? (
        <Text style={[styles.narrativeBody, { color: colors.ink }]}>
          {narrativeText}
        </Text>
      ) : (
        <Text style={[styles.narrativePlaceholder, { color: colors.inkMuted }]}>
          Run research to generate the {label}.
        </Text>
      )}

      {/* Sources */}
      {items.length > 0 ? (
        <View style={styles.sourcesBlock}>
          <Pressable
            style={styles.sourcesToggle}
            onPress={() => setSourcesExpanded((v) => !v)}
          >
            <Text style={[styles.sourcesKicker, { color: colors.inkSubtle }]}>
              {sourceLabel.toUpperCase()}
            </Text>
            <Text style={[styles.sourcesCount, { color: colors.accent }]}>
              {items.length} {sourcesExpanded ? '↑' : '↓'}
            </Text>
          </Pressable>
          {sourcesExpanded
            ? items.map((item, i) => (
                <SourceRow
                  key={`${item.url}-${i}`}
                  item={item}
                  savedUrls={savedUrls}
                  savedRows={savedRows}
                  companySlug={companySlug}
                  narrativeType={narrativeType}
                  colors={colors}
                  onSaveToggle={onSaveToggle}
                />
              ))
            : null}
        </View>
      ) : null}
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CompanyScreen() {
  const { slug: slugParam } = useLocalSearchParams<{ slug: string }>()
  const slug       = typeof slugParam === 'string' ? slugParam : slugParam?.[0] ?? ''
  const navigation = useNavigation()
  const router     = useRouter()
  const insets     = useSafeAreaInsets()
  const colors     = useVerityPalette()
  const { user }   = useAuth()

  const [company, setCompany]           = useState<CompanyRow | null>(null)
  const { data: marketData }            = useMarketData(company?.ticker)
  const [research, setResearch]         = useState<CompanyResearchRow | null>(null)
  const [savedRows, setSavedRows]       = useState<SavedHeadlineRow[]>([])
  const [loading, setLoading]           = useState(true)
  const [refreshing, setRefreshing]     = useState(false)
  const [researchBusy, setResearchBusy] = useState(false)
  const [onWatchlist, setOnWatchlist]   = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const savedUrls = savedUrlSet(savedRows)

  const load = useCallback(async () => {
    if (!slug) { setLoading(false); return }
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
        try { setSavedRows(await fetchSavedHeadlines(slug)) } catch { /* non-critical */ }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [slug, user])

  useEffect(() => { void load() }, [load])

  useLayoutEffect(() => {
    navigation.setOptions({
      title: company?.name ?? (slug || 'Company'),
      headerTintColor: colors.accent,
      headerStyle: { backgroundColor: colors.surfaceSolid },
      headerTitleStyle: { fontFamily: font.semi, color: colors.ink, fontSize: 17 },
    })
  }, [navigation, company?.name, slug, colors])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  const toggleWatchlist = async () => {
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
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const runResearch = async () => {
    if (!company) return
    setResearchBusy(true)
    setError(null)
    try {
      await invokeResearchCompany(company.slug, company.name, company.ticker)
      setResearch(await fetchResearchCacheRow(company.slug))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
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
    } catch { /* silent — knowledge bank is non-critical */ }
  }

  // ── Loading / error states ──────────────────────────────────────────────────

  if (!slug) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <Text style={[styles.muted, { color: colors.inkMuted }]}>Missing company.</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (!company) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas, padding: space.xl }]}>
        <Text style={[styles.h1, { color: colors.ink }]}>Not found</Text>
        <Text style={[styles.muted, { color: colors.inkMuted, marginTop: space.md, textAlign: 'center' }]}>
          {"This company isn't in the database yet."}
        </Text>
        <Pressable
          style={[styles.backBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  // Derive split items
  const allItems     = research?.items ?? []
  const companyItems = allItems.filter((i) => classifyItem(i) === 'official')
  const mediaItems   = allItems.filter((i) => classifyItem(i) === 'external')

  // Factual gaps from new field or empty
  const factualGaps = Array.isArray(research?.factual_gaps)
    ? (research!.factual_gaps as FactualGap[])
    : []

  const hasResearch = allItems.length > 0 || research?.company_narrative || research?.media_narrative

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingBottom: insets.bottom + space.xxl + 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.bannerText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {/* ── 0. Identity card ── */}
        <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
          <View style={styles.identityRow}>
            <CompanyLogo name={company.name} ticker={company.ticker} size="lg" />
            <View style={styles.identityText}>
              <Text style={[styles.h1, { color: colors.ink }]}>{company.name}</Text>
              {company.ticker ? (
                <Text style={[styles.ticker, { color: colors.inkMuted }]}>
                  {company.ticker}
                  {company.exchange ? ` · ${company.exchange}` : ''}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Market data row */}
          {marketData ? (
            <View style={styles.marketRow}>
              <Text style={[styles.price, { color: colors.ink }]}>
                ${marketData.price.toFixed(2)}
              </Text>
              <Text
                style={[
                  styles.change,
                  {
                    color: changeColor(
                      marketData.changePct,
                      colors.success,
                      colors.danger,
                      colors.inkSubtle,
                    ),
                  },
                ]}
              >
                {marketData.changePct >= 0 ? '+' : ''}{marketData.changePct.toFixed(2)}%
              </Text>
              {marketData.marketCap ? (
                <Text style={[styles.marketMeta, { color: colors.inkSubtle }]}>
                  {formatMarketCap(marketData.marketCap)}
                </Text>
              ) : null}
              {marketData.peRatio ? (
                <Text style={[styles.marketMeta, { color: colors.inkSubtle }]}>
                  P/E {marketData.peRatio.toFixed(1)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Last updated + refresh */}
          <View style={styles.refreshRow}>
            {research?.fetched_at ? (
              <Text style={[styles.updatedText, { color: colors.inkSubtle }]}>
                Updated {formatAgo(research.fetched_at)}
              </Text>
            ) : (
              <Text style={[styles.updatedText, { color: colors.inkSubtle }]}>
                No research yet
              </Text>
            )}
            <Pressable
              style={[
                styles.refreshBtn,
                {
                  borderColor: colors.accent,
                  backgroundColor: researchBusy ? colors.accentSoft : 'transparent',
                },
              ]}
              onPress={() => void runResearch()}
              disabled={researchBusy}
            >
              {researchBusy ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={[styles.refreshBtnText, { color: colors.accent }]}>
                  {hasResearch ? 'Refresh' : 'Run research'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── 1. Biggest Factual Gaps ── */}
        {factualGaps.length > 0 ? (
          <FactualGapsSection gaps={factualGaps} colors={colors} />
        ) : hasResearch ? (
          <View
            style={[
              styles.card,
              styles.gapsCard,
              { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke, opacity: 0.6 },
            ]}
          >
            <View style={styles.gapsHeader}>
              <View style={[styles.gapsDot, { backgroundColor: colors.inkSubtle }]} />
              <Text style={[styles.gapsKicker, { color: colors.inkSubtle }]}>
                BIGGEST FACTUAL GAPS THIS QUARTER
              </Text>
            </View>
            <Text style={[styles.gapText, { color: colors.inkMuted, paddingHorizontal: space.lg, paddingBottom: space.md }]}>
              Refresh research to generate factual gaps — mechanical mismatches between what the
              company reports and what media and analysts are observing.
            </Text>
          </View>
        ) : null}

        {/* ── 2. Company Narrative ── */}
        <NarrativeSection
          label="Company Narrative"
          sourceLabel="Company IR"
          dotColor="#0f766e"
          narrativeText={research?.company_narrative ?? null}
          items={companyItems}
          savedUrls={savedUrls}
          savedRows={savedRows}
          companySlug={slug}
          narrativeType="company"
          colors={colors}
          onSaveToggle={handleSaveToggle}
        />

        {/* ── 3. Media & Analyst Narrative ── */}
        <NarrativeSection
          label="Media & Analyst Narrative"
          sourceLabel="Media & Analyst"
          dotColor="#475569"
          narrativeText={research?.media_narrative ?? null}
          items={mediaItems}
          savedUrls={savedUrls}
          savedRows={savedRows}
          companySlug={slug}
          narrativeType="media"
          colors={colors}
          onSaveToggle={handleSaveToggle}
        />

        {/* ── 4. Chat CTA ── */}
        {hasResearch ? (
          <Pressable
            style={[styles.chatCta, { borderColor: colors.accent }]}
            onPress={() => router.push(`/chat/${slug}`)}
          >
            <Text style={[styles.chatCtaLabel, { color: colors.accent }]}>Verity</Text>
            <Text style={[styles.chatCtaText, { color: colors.accent }]}>
              Discuss this research
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.runCta, { backgroundColor: colors.accent }]}
            onPress={() => void runResearch()}
            disabled={researchBusy}
          >
            {researchBusy ? (
              <View style={styles.ctaRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.runCtaText}>Researching…</Text>
              </View>
            ) : (
              <Text style={styles.runCtaText}>Run research</Text>
            )}
          </Pressable>
        )}

        <Text style={[styles.disclaimer, { color: colors.inkSubtle }]}>
          Not investment advice · AI may be incomplete · verify with primary sources
        </Text>
      </ScrollView>

      {/* Floating watchlist FAB */}
      {user ? (
        <LiquidGlassFAB
          onPress={() => void toggleWatchlist()}
          active={onWatchlist}
          size={52}
          style={styles.fab}
        />
      ) : null}
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:   { flex: 1 },
  scroll:      { flex: 1 },
  scrollInner: { padding: space.lg, gap: space.md },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted:       { fontFamily: font.regular, fontSize: 15 },

  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
  },

  // Identity
  identityRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  identityText: { flex: 1, minWidth: 0 },
  h1:     { fontFamily: font.semi, fontSize: 24, letterSpacing: -0.5 },
  ticker: { fontFamily: font.medium, fontSize: 14, marginTop: 4 },
  marketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
  price:      { fontFamily: font.semi, fontSize: 17, letterSpacing: -0.3 },
  change:     { fontFamily: font.medium, fontSize: 14 },
  marketMeta: { fontFamily: font.regular, fontSize: 13 },

  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.md,
  },
  updatedText: { fontFamily: font.regular, fontSize: 12 },
  refreshBtn: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 5,
    minWidth: 90,
    alignItems: 'center',
  },
  refreshBtnText: { fontFamily: font.semi, fontSize: 13 },

  // Factual gaps
  gapsCard:   {},
  gapsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  gapsDot:   { width: 7, height: 7, borderRadius: 4 },
  gapsKicker:{ fontFamily: font.semi, fontSize: 10, letterSpacing: 1.6, flex: 1 },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    marginBottom: space.sm,
  },
  gapBullet:  { fontFamily: font.semi, fontSize: 14, lineHeight: 20, marginTop: 1 },
  gapText:    { flex: 1, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  gapsFooter: { fontFamily: font.regular, fontSize: 11, marginTop: space.xs, opacity: 0.7 },

  // Narrative sections
  narrativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  narrativeDot:        { width: 7, height: 7, borderRadius: 4 },
  narrativeLabel:      { fontFamily: font.semi, fontSize: 10, letterSpacing: 1.6 },
  narrativeBody:       { fontFamily: font.regular, fontSize: 15, lineHeight: 23 },
  narrativePlaceholder:{ fontFamily: font.regular, fontSize: 14, fontStyle: 'italic' },

  // Sources
  sourcesBlock:  { marginTop: space.lg },
  sourcesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.xs,
  },
  sourcesKicker: { fontFamily: font.medium, fontSize: 10, letterSpacing: 1.4 },
  sourcesCount:  { fontFamily: font.semi, fontSize: 12 },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  sourceBody:   { flex: 1, minWidth: 0 },
  sourceTitle:  { fontFamily: font.semi, fontSize: 13, lineHeight: 19 },
  sourceMeta:   { fontFamily: font.regular, fontSize: 11, marginTop: 2 },
  bookmarkBtn:  { paddingTop: 2 },
  bookmarkIcon: { fontSize: 16 },

  // CTAs
  chatCta: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: space.md + 2,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
  },
  chatCtaLabel: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.4 },
  chatCtaText:  { fontFamily: font.semi, fontSize: 15 },
  runCta: {
    borderRadius: radius.sm,
    paddingVertical: space.md + 2,
    alignItems: 'center',
  },
  ctaRow:      { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  runCtaText:  { fontFamily: font.semi, color: '#fff', fontSize: 16 },
  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.6,
  },

  fab:      { position: 'absolute', top: space.md, right: space.lg },
  backBtn: {
    marginTop: space.xl,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.sm,
  },
  backBtnText: { fontFamily: font.semi, color: '#fff', fontSize: 15 },
  banner:      { padding: space.md, borderRadius: radius.sm },
  bannerText:  { fontFamily: font.regular, fontSize: 14 },
})
