/**
 * Company profile screen.
 *
 * Design:
 *  - Floating Liquid Glass "+" / "★" FAB pinned top-right — add/remove watchlist.
 *  - Business summary is the primary content card.
 *  - Research is framed as the clear next action, not a settings menu item.
 *  - Tracked documents scroll below.
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
import { fetchResearchCacheRow, type CompanyResearchRow } from '@/lib/researchCache'
import { invokeResearchCompany } from '@/lib/researchRefresh'
import { supabase } from '@/lib/supabase'
import { font, radius, space } from '@/constants/theme'

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

// ─── Research section ─────────────────────────────────────────────────────

type ResearchSectionProps = {
  research: CompanyResearchRow | null
  busy: boolean
  onRefresh: () => void
  colors: ReturnType<typeof useVerityPalette>
}

function ResearchSection({ research, busy, onRefresh, colors }: ResearchSectionProps) {
  const items = research?.items ?? []

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

        {items.slice(0, 5).map((item, i) => (
          <Pressable
            key={`${item.url}-${i}`}
            style={[styles.researchRow, { borderTopColor: colors.stroke }]}
            onPress={() => void Linking.openURL(item.url)}
          >
            <Text style={[styles.researchTitle, { color: colors.accent }]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.snippet ? (
              <Text style={[styles.researchSnippet, { color: colors.inkMuted }]} numberOfLines={2}>
                {item.snippet}
              </Text>
            ) : null}
            <Text style={[styles.researchSource, { color: colors.inkSubtle }]} numberOfLines={1}>
              {item.source ?? safeHostname(item.url)}
            </Text>
          </Pressable>
        ))}

        {/* Research CTA — the next clear action */}
        <Pressable
          style={[
            styles.researchCta,
            { backgroundColor: busy ? colors.accentSoft : colors.accent },
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

        <Text style={[styles.disclaimer, { color: colors.inkSubtle }]}>
          Not investment advice · AI may be incomplete
        </Text>
      </View>
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────

export default function CompanyScreen() {
  const { slug: slugParam } = useLocalSearchParams<{ slug: string }>()
  const slug       = typeof slugParam === 'string' ? slugParam : slugParam?.[0] ?? ''
  const navigation = useNavigation()
  const router     = useRouter()
  const colors     = useVerityPalette()
  const { user }   = useAuth()

  const [company, setCompany]       = useState<CompanyRow | null>(null)
  const [documents, setDocuments]   = useState<DbTrackedDocument[]>([])
  const [research, setResearch]     = useState<CompanyResearchRow | null>(null)
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [researchBusy, setResearchBusy] = useState(false)
  const [onWatchlist, setOnWatchlist]   = useState(false)
  const [error, setError]           = useState<string | null>(null)

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

  // ── Loading / error states ──

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
          {"This company isn't in your database yet. Add it via the admin panel or wait for the next import."}
        </Text>
        <Pressable style={[styles.backBtn, { backgroundColor: colors.accent }]} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  const researchItems = research?.items ?? []
  const summaryText = researchItems[0]?.snippet ?? null

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
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

          {/* Business summary from research */}
          {summaryText ? (
            <Text style={[styles.summary, { color: colors.inkMuted }]} numberOfLines={4}>
              {summaryText}
            </Text>
          ) : company.tagline ? (
            <Text style={[styles.summary, { color: colors.inkMuted }]}>
              {company.tagline}
            </Text>
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

        {/* ── Research — the next action ── */}
        <ResearchSection
          research={research}
          busy={researchBusy}
          onRefresh={() => void runResearch()}
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

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { flex: 1 },
  scrollInner: { padding: space.lg, paddingBottom: space.xxl + 20 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted:     { fontFamily: font.regular, fontSize: 15 },

  // Identity
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    marginBottom: space.lg,
  },
  identityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
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

  // Section
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
  meta:         { fontFamily: font.regular, fontSize: 13, marginTop: space.xs },
  warn:         { fontFamily: font.regular, fontSize: 13, marginTop: space.xs },
  disclaimer:   { fontFamily: font.regular, fontSize: 11, marginTop: space.md, opacity: 0.6, textAlign: 'center' },

  // Documents
  docRow: {
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.xs,
  },
  docTitle:   { fontFamily: font.semi, fontSize: 15, lineHeight: 20 },
  docSnippet: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 4 },
  docMeta:    { fontFamily: font.regular, fontSize: 12, marginTop: space.xs },

  // Research
  researchRow: {
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.sm,
  },
  researchTitle:   { fontFamily: font.semi, fontSize: 15, lineHeight: 20 },
  researchSnippet: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: 4 },
  researchSource:  { fontFamily: font.regular, fontSize: 12, marginTop: 4 },

  // CTA
  researchCta: {
    marginTop: space.lg,
    paddingVertical: space.md + 2,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ctaText: { fontFamily: font.semi, color: '#fff', fontSize: 16 },

  // Floating FAB
  fab: {
    position: 'absolute',
    top: space.md,
    right: space.lg,
  },

  // Not found
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
