/**
 * Company profile screen.
 *
 * Layout (top → bottom):
 *  1. Identity card — logo, name, ticker, truncated summary
 *  2. "Read full analysis →" link (if research exists)
 *  3. Tracked documents
 *  4. Research headlines — grouped by story, split into Company / World narratives
 *  5. Refresh research CTA + Ask Afaqi CTA
 */

import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { LiquidGlassFAB } from '@/components/LiquidGlass'
import { CompanyLogo } from '@/components/CompanyLogo'
import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { fetchCompanyBundleBySlug } from '@/lib/companyBundle'
import type { CompanyRow } from '@/lib/companyBySlug'
import { shortDocumentTitle } from '@/lib/documentTitles'
import { formatAgo } from '@/lib/format'
import type { DbTrackedDocument } from '@/lib/monitoringTypes'
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
  groupHeadlines,
  classifyItem,
  type HeadlineCluster,
} from '@/lib/headlineGrouping'
import {
  fetchSavedHeadlines,
  saveHeadline,
  unsaveHeadline,
  savedUrlSet,
  type SavedHeadlineRow,
} from '@/lib/savedHeadlines'
import { supabase } from '@/lib/supabase'
import { font, radius, space } from '@/constants/theme'

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

// ─── Single headline cluster row ──────────────────────────────────────────────

type ClusterRowProps = {
  cluster: HeadlineCluster
  savedUrls: Set<string>
  savedRows: SavedHeadlineRow[]
  onSaveToggle: (item: ResearchNewsItem, savedId?: string) => void
  colors: ReturnType<typeof useVerityPalette>
}

function ClusterRow({ cluster, savedUrls, savedRows, onSaveToggle, colors }: ClusterRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { primary, extras, sourceCount } = cluster
  const isSaved = savedUrls.has(primary.url)
  const savedRow = savedRows.find((r) => r.url === primary.url)

  return (
    <View style={[styles.clusterBlock, { borderTopColor: colors.stroke }]}>
      {/* Primary headline */}
      <Pressable onPress={() => void Linking.openURL(primary.url)} style={styles.clusterMain}>
        <View style={styles.clusterTitleRow}>
          <Text style={[styles.clusterTitle, { color: colors.accent }]} numberOfLines={2}>
            {primary.title}
          </Text>
          <Pressable
            style={styles.bookmarkBtn}
            onPress={() => onSaveToggle(primary, savedRow?.id)}
            hitSlop={10}
          >
            <Text style={[styles.bookmarkIcon, { color: isSaved ? colors.accent : colors.inkSubtle }]}>
              {isSaved ? '✦' : '✧'}
            </Text>
          </Pressable>
        </View>
        {primary.snippet ? (
          <Text style={[styles.clusterSnippet, { color: colors.inkMuted }]} numberOfLines={2}>
            {primary.snippet}
          </Text>
        ) : null}
        <Text style={[styles.clusterMeta, { color: colors.inkSubtle }]} numberOfLines={1}>
          {primary.source ?? safeHostname(primary.url)}
          {primary.published_at ? ` · ${formatAgo(primary.published_at)}` : ''}
        </Text>
      </Pressable>

      {/* N-sources badge + expand toggle */}
      {sourceCount > 1 ? (
        <Pressable style={styles.expandRow} onPress={() => setExpanded((v) => !v)}>
          <View style={[styles.sourceBadge, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.sourceBadgeText, { color: colors.accent }]}>
              {sourceCount} sources
            </Text>
          </View>
          <Text style={[styles.expandToggle, { color: colors.inkSubtle }]}>
            {expanded ? 'Show less ↑' : 'Show all ↓'}
          </Text>
        </Pressable>
      ) : null}

      {/* Extra sources shown when expanded */}
      {expanded
        ? extras.map((extra, i) => (
            <Pressable
              key={`extra-${i}`}
              style={[styles.extraRow, { borderTopColor: colors.stroke }]}
              onPress={() => void Linking.openURL(extra.url)}
            >
              <Text style={[styles.extraTitle, { color: colors.accent }]} numberOfLines={2}>
                {extra.title}
              </Text>
              <Text style={[styles.extraMeta, { color: colors.inkSubtle }]} numberOfLines={1}>
                {extra.source ?? safeHostname(extra.url)}
              </Text>
            </Pressable>
          ))
        : null}
    </View>
  )
}

// ─── Narrative section (Company Says / World Says) ────────────────────────────

type NarrativeSectionProps = {
  label: string
  dotColor: string
  clusters: HeadlineCluster[]
  savedUrls: Set<string>
  savedRows: SavedHeadlineRow[]
  onSaveToggle: (item: ResearchNewsItem, savedId?: string) => void
  colors: ReturnType<typeof useVerityPalette>
}

function NarrativeSection({
  label, dotColor, clusters, savedUrls, savedRows, onSaveToggle, colors,
}: NarrativeSectionProps) {
  if (clusters.length === 0) return null
  return (
    <View style={styles.narrativeSection}>
      <View style={styles.narrativeHeader}>
        <View style={[styles.narrativeDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.narrativeLabel, { color: colors.inkSubtle }]}>{label}</Text>
      </View>
      {clusters.map((cluster, i) => (
        <ClusterRow
          key={`${cluster.primary.url}-${i}`}
          cluster={cluster}
          savedUrls={savedUrls}
          savedRows={savedRows}
          onSaveToggle={onSaveToggle}
          colors={colors}
        />
      ))}
    </View>
  )
}

// ─── Research section ──────────────────────────────────────────────────────────

type ResearchSectionProps = {
  research: CompanyResearchRow | null
  savedUrls: Set<string>
  savedRows: SavedHeadlineRow[]
  slug: string
  busy: boolean
  onRefresh: () => void
  onSaveToggle: (item: ResearchNewsItem, savedId?: string) => void
  colors: ReturnType<typeof useVerityPalette>
}

function ResearchSection({
  research, savedUrls, savedRows, slug, busy, onRefresh, onSaveToggle, colors,
}: ResearchSectionProps) {
  const router = useRouter()
  const items = research?.items ?? []

  const officialClusters = groupHeadlines(items.filter((i) => classifyItem(i) === 'official'))
  const externalClusters = groupHeadlines(items.filter((i) => classifyItem(i) === 'external'))

  return (
    <View style={styles.section}>
      <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionKicker, { color: colors.inkSubtle }]}>RESEARCH & NEWS</Text>
            <Text style={[styles.sectionTitle, { color: colors.ink }]}>
              {items.length > 0 ? 'Latest developments' : 'No research yet'}
            </Text>
          </View>
        </View>

        {research?.fetched_at ? (
          <Text style={[styles.meta, { color: colors.inkSubtle }]}>
            {formatAgo(research.fetched_at)}
            {research.model ? ` · ${research.model}` : ''}
          </Text>
        ) : null}
        {research?.error ? (
          <Text style={[styles.warn, { color: colors.amber }]}>{research.error}</Text>
        ) : null}

        {items.length > 0 ? (
          <>
            <NarrativeSection
              label="WHAT THE COMPANY SAYS"
              dotColor="#0f766e"
              clusters={officialClusters}
              savedUrls={savedUrls}
              savedRows={savedRows}
              onSaveToggle={onSaveToggle}
              colors={colors}
            />
            <NarrativeSection
              label="WHAT THE WORLD SAYS"
              dotColor="#475569"
              clusters={externalClusters}
              savedUrls={savedUrls}
              savedRows={savedRows}
              onSaveToggle={onSaveToggle}
              colors={colors}
            />
          </>
        ) : null}

        {/* Refresh research CTA */}
        <Pressable
          style={[
            styles.researchCta,
            {
              backgroundColor: busy ? colors.accentSoft : colors.accent,
              marginTop: items.length > 0 ? space.lg : space.md,
            },
          ]}
          onPress={onRefresh}
          disabled={busy}
        >
          {busy ? (
            <View style={styles.ctaRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.ctaText}>Researching…</Text>
            </View>
          ) : (
            <Text style={styles.ctaText}>
              {items.length > 0 ? 'Refresh research' : 'Run research'}
            </Text>
          )}
        </Pressable>

        {/* Ask Afaqi CTA */}
        {items.length > 0 ? (
          <Pressable
            style={[styles.afaqiCta, { borderColor: colors.accent }]}
            onPress={() => router.push(`/chat/${slug}`)}
          >
            <Text style={[styles.afaqiCtaLabel, { color: colors.accent }]}>Afaqi</Text>
            <Text style={[styles.afaqiCtaText, { color: colors.accent }]}>
              Ask about this research
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.disclaimer, { color: colors.inkSubtle }]}>
          Not investment advice · AI may be incomplete
        </Text>
      </View>
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function CompanyScreen() {
  const { slug: slugParam } = useLocalSearchParams<{ slug: string }>()
  const slug       = typeof slugParam === 'string' ? slugParam : slugParam?.[0] ?? ''
  const navigation = useNavigation()
  const router     = useRouter()
  const colors     = useVerityPalette()
  const { user }   = useAuth()

  const [company, setCompany]           = useState<CompanyRow | null>(null)
  const [documents, setDocuments]       = useState<DbTrackedDocument[]>([])
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
      setDocuments(bundle.documents)
      setResearch(r)
      setOnWatchlist(wl.includes(slug))

      if (user) {
        try {
          setSavedRows(await fetchSavedHeadlines(slug))
        } catch {
          // knowledge bank is non-critical
        }
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
      const r = await fetchResearchCacheRow(company.slug)
      setResearch(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setResearchBusy(false)
    }
  }

  const handleSaveToggle = async (item: ResearchNewsItem, savedId?: string) => {
    if (!user) return
    try {
      if (savedId) {
        await unsaveHeadline(savedId)
        setSavedRows((prev) => prev.filter((r) => r.id !== savedId))
      } else {
        await saveHeadline(user.id, slug, item)
        setSavedRows(await fetchSavedHeadlines(slug))
      }
    } catch {
      // silent — knowledge bank is non-critical
    }
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
        <Text style={[styles.kicker, { color: colors.inkSubtle }]}>COMPANY</Text>
        <Text style={[styles.h1, { color: colors.ink }]}>Not found</Text>
        <Text style={[styles.muted, { color: colors.inkMuted, marginTop: space.md, textAlign: 'center' }]}>
          {"This company isn't in your database yet."}
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

  const researchItems = research?.items ?? []
  const summaryText   = researchItems[0]?.snippet ?? company.tagline ?? null

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
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

        {/* ── Identity card ── */}
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

          {summaryText ? (
            <Text style={[styles.summary, { color: colors.inkMuted }]} numberOfLines={3}>
              {summaryText}
            </Text>
          ) : null}

          {researchItems.length > 0 ? (
            <Pressable
              style={styles.readerLink}
              onPress={() => router.push(`/reader/${slug}`)}
            >
              <Text style={[styles.readerLinkText, { color: colors.accent }]}>
                Read full analysis →
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* ── Tracked documents ── */}
        {documents.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionKicker, { color: colors.inkSubtle }]}>DOCUMENTS</Text>
            <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
              {documents.map((doc) => (
                <Pressable
                  key={doc.id}
                  style={[styles.docRow, { borderTopColor: colors.stroke }]}
                  onPress={() => void Linking.openURL(doc.canonical_url)}
                >
                  <Text style={[styles.docTitle, { color: colors.accent }]} numberOfLines={2}>
                    {shortDocumentTitle(doc)}
                  </Text>
                  {doc.summary_text ? (
                    <Text style={[styles.docSnippet, { color: colors.inkMuted }]} numberOfLines={2}>
                      {doc.summary_text}
                    </Text>
                  ) : null}
                  <Text style={[styles.docMeta, { color: colors.inkSubtle }]}>
                    {formatAgo(doc.last_checked_at ?? doc.first_seen_at)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ── Research headlines ── */}
        <ResearchSection
          research={research}
          savedUrls={savedUrls}
          savedRows={savedRows}
          slug={slug}
          busy={researchBusy}
          onRefresh={() => void runResearch()}
          onSaveToggle={handleSaveToggle}
          colors={colors}
        />
      </ScrollView>

      {/* ── Floating Liquid Glass watchlist button ── */}
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
  scrollInner: { padding: space.lg, paddingBottom: space.xxl + 20 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted:       { fontFamily: font.regular, fontSize: 15 },

  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    marginBottom: space.lg,
  },
  identityRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  identityText: { flex: 1, minWidth: 0 },
  h1:     { fontFamily: font.semi, fontSize: 24, letterSpacing: -0.5 },
  kicker: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8 },
  ticker: { fontFamily: font.medium, fontSize: 14, marginTop: 4 },
  summary: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: space.md,
  },
  readerLink:     { marginTop: space.sm },
  readerLinkText: { fontFamily: font.semi, fontSize: 14 },

  section: { marginBottom: space.lg },
  sectionKicker: {
    fontFamily: font.medium,
    fontSize: 11,
    letterSpacing: 1.8,
    marginBottom: space.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.xs,
  },
  sectionTitle: { fontFamily: font.semi, fontSize: 18, marginTop: 2 },
  meta:  { fontFamily: font.regular, fontSize: 13, marginTop: space.xs },
  warn:  { fontFamily: font.regular, fontSize: 13, marginTop: space.xs },

  // Documents
  docRow: {
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.xs,
  },
  docTitle:   { fontFamily: font.semi, fontSize: 15, lineHeight: 20 },
  docSnippet: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 4 },
  docMeta:    { fontFamily: font.regular, fontSize: 12, marginTop: space.xs },

  // Narrative sections
  narrativeSection: { marginTop: space.md },
  narrativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  narrativeDot:   { width: 7, height: 7, borderRadius: 4 },
  narrativeLabel: { fontFamily: font.medium, fontSize: 10, letterSpacing: 1.5 },

  // Headline cluster
  clusterBlock: {
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.xs,
  },
  clusterMain:     {},
  clusterTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  clusterTitle: {
    flex: 1,
    fontFamily: font.semi,
    fontSize: 15,
    lineHeight: 21,
  },
  bookmarkBtn:  { paddingTop: 2 },
  bookmarkIcon: { fontSize: 16 },
  clusterSnippet: {
    fontFamily: font.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  clusterMeta: { fontFamily: font.regular, fontSize: 12, marginTop: space.xs },

  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  sourceBadge:     { borderRadius: 10, paddingHorizontal: space.sm, paddingVertical: 3 },
  sourceBadgeText: { fontFamily: font.medium, fontSize: 11 },
  expandToggle:    { fontFamily: font.regular, fontSize: 12 },

  extraRow: {
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.xs,
    paddingLeft: space.md,
  },
  extraTitle: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  extraMeta:  { fontFamily: font.regular, fontSize: 11, marginTop: 2 },

  // CTAs
  researchCta: {
    paddingVertical: space.md + 2,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  ctaRow:  { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ctaText: { fontFamily: font.semi, color: '#fff', fontSize: 16 },

  afaqiCta: {
    marginTop: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
  },
  afaqiCtaLabel: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.4 },
  afaqiCtaText:  { fontFamily: font.semi, fontSize: 15 },

  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    marginTop: space.md,
    opacity: 0.6,
    textAlign: 'center',
  },

  fab: { position: 'absolute', top: space.md, right: space.lg },

  backBtn: {
    marginTop: space.xl,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.sm,
  },
  backBtnText: { fontFamily: font.semi, color: '#fff', fontSize: 15 },
  banner:      { padding: space.md, borderRadius: radius.sm, marginBottom: space.md },
  bannerText:  { fontFamily: font.regular, fontSize: 14 },
})
