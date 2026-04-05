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
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export default function CompanyScreen() {
  const { slug: slugParam } = useLocalSearchParams<{ slug: string }>()
  const slug = typeof slugParam === 'string' ? slugParam : slugParam?.[0] ?? ''
  const navigation = useNavigation()
  const router = useRouter()
  const colors = useVerityPalette()
  const { user } = useAuth()

  const [company, setCompany] = useState<CompanyRow | null>(null)
  const [documents, setDocuments] = useState<DbTrackedDocument[]>([])
  const [research, setResearch] = useState<CompanyResearchRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [researchBusy, setResearchBusy] = useState(false)
  const [onWatchlist, setOnWatchlist] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setDocuments(bundle.documents)
      setResearch(r)
      setOnWatchlist(wl.includes(slug))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [slug, user])

  useEffect(() => {
    void load()
  }, [load])

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

  const runResearchRefresh = async () => {
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

  const styles = buildStyles(colors)

  if (!slug) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <Text style={styles.muted}>Missing company.</Text>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[styles.muted, { marginTop: space.md }]}>Loading company…</Text>
      </View>
    )
  }

  if (!company) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas, padding: space.xl }]}>
        <Text style={styles.kicker}>COMPANY</Text>
        <Text style={styles.h1}>Not found</Text>
        <Text style={styles.body}>
          This slug is not in your Supabase companies table yet.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.canvas }]}
      contentContainerStyle={styles.scrollInner}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.accent} />
      }
    >
      {error ? (
        <View style={[styles.banner, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.bannerText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
        <Text style={[styles.kicker, { color: colors.inkSubtle }]}>COMPANY</Text>
        <View style={styles.heroRow}>
          <CompanyLogo name={company.name} ticker={company.ticker} size="lg" />
          <View style={styles.heroText}>
            <Text style={[styles.h1, { color: colors.ink }]}>{company.name}</Text>
            {company.ticker ? (
              <Text style={[styles.ticker, { color: colors.inkMuted }]}>
                {company.ticker}
                {company.exchange ? ` · ${company.exchange}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
        {company.tagline ? (
          <Text style={[styles.tagline, { color: colors.inkMuted }]}>{company.tagline}</Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={[
              styles.secondaryBtn,
              { borderColor: colors.stroke },
              onWatchlist && { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            ]}
            onPress={() => void toggleWatchlist()}
          >
            <Text
              style={[
                styles.secondaryBtnText,
                { color: colors.accent },
              ]}
            >
              {onWatchlist ? '★ On watchlist' : '☆ Add to watchlist'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Tracked documents</Text>
        <Text style={[styles.meta, { color: colors.inkSubtle }]}>
          Latest from `tracked_documents` (same as web company profile).
        </Text>
        {documents.length === 0 ? (
          <Text style={[styles.muted, { marginTop: space.md }]}>
            No documents yet — add monitor URLs in admin / web so monitoring can discover files.
          </Text>
        ) : (
          documents.map((doc) => (
            <Pressable
              key={doc.id}
              style={[styles.docRow, { borderTopColor: colors.stroke }]}
              onPress={() => void Linking.openURL(doc.canonical_url)}
            >
              <Text style={[styles.docTitle, { color: colors.accent }]} numberOfLines={2}>
                {shortDocumentTitle(doc)}
              </Text>
              {doc.summary_text ? (
                <Text style={[styles.newsSnippet, { color: colors.inkMuted }]} numberOfLines={2}>
                  {doc.summary_text}
                </Text>
              ) : null}
              <Text style={[styles.newsMeta, { color: colors.inkSubtle }]}>
                {formatAgo(doc.last_checked_at ?? doc.first_seen_at)}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
        <View style={styles.rowBetween}>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>Research & news</Text>
          <Pressable
            style={[styles.refreshBtn, { backgroundColor: colors.accent }]}
            onPress={() => void runResearchRefresh()}
            disabled={researchBusy}
          >
            {researchBusy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.refreshBtnText}>Refresh</Text>
            )}
          </Pressable>
        </View>
        <Text style={[styles.meta, { color: colors.inkSubtle }]}>
          {research
            ? `Updated ${formatAgo(research.fetched_at)}${research.model ? ` · ${research.model}` : ''}`
            : 'No cached research yet — tap Refresh (uses your session, same as web).'}
        </Text>
        {research?.error ? (
          <Text style={[styles.warn, { color: colors.amber }]}>{research.error}</Text>
        ) : null}

        {(research?.items ?? []).length === 0 ? (
          <Text style={[styles.muted, { marginTop: space.md }]}>
            No items in cache. Refresh runs the Perplexity pipeline on the server.
          </Text>
        ) : (
          (research?.items ?? []).map((item, i) => (
            <Pressable
              key={`${item.url}-${i}`}
              style={[styles.newsRow, { borderTopColor: colors.stroke }]}
              onPress={() => void Linking.openURL(item.url)}
            >
              <Text style={[styles.newsTitle, { color: colors.accent }]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.snippet ? (
                <Text style={[styles.newsSnippet, { color: colors.inkMuted }]} numberOfLines={3}>
                  {item.snippet}
                </Text>
              ) : null}
              <Text style={[styles.newsMeta, { color: colors.inkSubtle }]} numberOfLines={1}>
                {item.source ?? safeHostname(item.url)}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  )
}

function buildStyles(colors: ReturnType<typeof useVerityPalette>) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    scrollInner: { padding: space.lg, paddingBottom: space.xxl },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    muted: { fontFamily: font.regular, fontSize: 15, color: colors.inkMuted },
    kicker: {
      fontFamily: font.medium,
      fontSize: 11,
      letterSpacing: 1.8,
      marginBottom: space.sm,
    },
    h1: { fontFamily: font.semi, fontSize: 24, letterSpacing: -0.5 },
    body: {
      fontFamily: font.regular,
      fontSize: 15,
      lineHeight: 22,
      color: colors.inkMuted,
      marginTop: space.md,
      textAlign: 'center',
    },
    ticker: { fontFamily: font.medium, fontSize: 14, marginTop: 4 },
    tagline: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: space.md },
    card: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: space.lg,
      marginBottom: space.lg,
    },
    heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginTop: space.sm },
    heroText: { flex: 1, minWidth: 0 },
    actions: { marginTop: space.lg },
    secondaryBtn: {
      alignSelf: 'flex-start',
      paddingVertical: space.sm + 2,
      paddingHorizontal: space.lg,
      borderRadius: radius.sm,
      borderWidth: 1,
    },
    secondaryBtnText: { fontFamily: font.semi, fontSize: 14 },
    sectionTitle: { fontFamily: font.semi, fontSize: 18 },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.md,
    },
    refreshBtn: {
      paddingVertical: space.sm,
      paddingHorizontal: space.md,
      borderRadius: radius.sm,
      minWidth: 88,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshBtnText: { fontFamily: font.semi, fontSize: 14, color: '#fff' },
    meta: { fontFamily: font.regular, fontSize: 13, marginTop: space.sm },
    warn: { fontFamily: font.regular, fontSize: 13, marginTop: space.sm },
    newsRow: {
      paddingVertical: space.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: space.sm,
    },
    newsTitle: { fontFamily: font.semi, fontSize: 15, lineHeight: 20 },
    newsSnippet: { fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: space.xs },
    newsMeta: { fontFamily: font.regular, fontSize: 12, marginTop: space.xs },
    docRow: {
      paddingVertical: space.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      marginTop: space.sm,
    },
    docTitle: { fontFamily: font.semi, fontSize: 15, lineHeight: 20 },
    primaryBtn: {
      marginTop: space.xl,
      backgroundColor: colors.accent,
      paddingVertical: space.md,
      paddingHorizontal: space.xl,
      borderRadius: radius.sm,
    },
    primaryBtnText: { fontFamily: font.semi, color: '#fff', fontSize: 15 },
    banner: { padding: space.md, borderRadius: radius.sm, marginBottom: space.md },
    bannerText: { fontFamily: font.regular, fontSize: 14 },
  })
}
