/**
 * Watchlist tab — your companies with persistent research summaries.
 *
 * Layout:
 *  - Per-company cards showing the latest research summary from company_research_cache.
 *  - Tapping a company opens the full profile.
 *  - Research summaries update silently; no manual refresh needed.
 */

import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { supabase } from '@/lib/supabase'
import {
  deleteWatchlistSlug,
  fetchCompaniesForSlugs,
  fetchWatchlistSlugs,
  type WatchlistCompanyRow,
} from '@/lib/watchlistApi'
import { font, radius, space } from '@/constants/theme'

type ResearchItem = {
  title: string
  snippet: string | null
  source: string | null
}

type ResearchCacheRow = {
  slug: string
  items: ResearchItem[]
  fetched_at: string
}

async function fetchResearchForSlugs(slugs: string[]): Promise<Map<string, ResearchCacheRow>> {
  if (slugs.length === 0) return new Map()
  const { data, error } = await supabase
    .from('company_research_cache')
    .select('slug, items, fetched_at')
    .in('slug', slugs)
  if (error) throw error
  const map = new Map<string, ResearchCacheRow>()
  for (const row of (data ?? []) as ResearchCacheRow[]) map.set(row.slug, row)
  return map
}

// ─── Company card ─────────────────────────────────────────────────────────

type CompanyCardProps = {
  company: WatchlistCompanyRow
  research: ResearchCacheRow | undefined
  colors: ReturnType<typeof useVerityPalette>
  onPress: () => void
  onRemove: () => void
}

function CompanyCard({ company, research, colors, onPress, onRemove }: CompanyCardProps) {
  const topItems = research?.items?.slice(0, 2) ?? []

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceSolid,
          borderColor: colors.stroke,
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      {/* Company header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardMeta}>
          <Text style={[styles.cardName, { color: colors.ink }]} numberOfLines={1}>
            {company.name}
          </Text>
          {company.ticker ? (
            <Text style={[styles.cardTicker, { color: colors.inkMuted }]}>
              {company.ticker}
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

      {/* Research summary items */}
      {topItems.length > 0 ? (
        <View style={styles.researchItems}>
          {topItems.map((item, i) => (
            <View
              key={i}
              style={[styles.researchItem, { borderLeftColor: colors.accent }]}
            >
              <Text style={[styles.researchTitle, { color: colors.ink }]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.snippet ? (
                <Text style={[styles.researchSnippet, { color: colors.inkMuted }]} numberOfLines={2}>
                  {item.snippet}
                </Text>
              ) : null}
            </View>
          ))}
          {research?.fetched_at ? (
            <Text style={[styles.researchAge, { color: colors.inkSubtle }]}>
              Updated {formatAge(research.fetched_at)}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.noResearch, { color: colors.inkSubtle }]}>
          No research yet — open profile to refresh
        </Text>
      )}
    </Pressable>
  )
}

function formatAge(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const h = Math.floor(d / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Main screen ─────────────────────────────────────────────────────────

export default function WatchlistScreen() {
  const router  = useRouter()
  const insets  = useSafeAreaInsets()
  const colors  = useVerityPalette()
  const { user } = useAuth()

  const [companies, setCompanies]     = useState<WatchlistCompanyRow[]>([])
  const [research, setResearch]       = useState<Map<string, ResearchCacheRow>>(new Map())
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) { setCompanies([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const slugs    = await fetchWatchlistSlugs(supabase)
      const cos      = await fetchCompaniesForSlugs(supabase, slugs)
      const rMap     = await fetchResearchForSlugs(slugs)
      setCompanies(cos)
      setResearch(rMap)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  // Silently refresh research every 10 minutes while tab is visible
  useEffect(() => {
    if (!user || companies.length === 0) return
    const t = setInterval(() => {
      void fetchResearchForSlugs(companies.map((c) => c.slug))
        .then(setResearch)
        .catch(() => {})
    }, 10 * 60 * 1000)
    return () => clearInterval(t)
  }, [user, companies])

  const remove = async (slug: string) => {
    try {
      await deleteWatchlistSlug(supabase, slug)
      setCompanies((prev) => prev.filter((c) => c.slug !== slug))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas, paddingTop: insets.top + space.sm }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: colors.inkSubtle }]}>WATCHLIST</Text>
        <Text style={[styles.title, { color: colors.ink }]}>Your companies</Text>
      </View>

      {error ? (
        <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : companies.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>Nothing here yet</Text>
          <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
            Search for companies and add them to your watchlist — their research will appear here.
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/')}
          >
            <Text style={styles.emptyBtnText}>Discover companies</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(c) => c.slug}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl }}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
          renderItem={({ item }) => (
            <CompanyCard
              company={item}
              research={research.get(item.slug)}
              colors={colors}
              onPress={() => router.push(`/company/${item.slug}`)}
              onRemove={() => void remove(item.slug)}
            />
          )}
        />
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  header:  { paddingHorizontal: space.lg, marginBottom: space.lg },
  kicker:  { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8, marginBottom: space.xs },
  title:   { fontFamily: font.semi, fontSize: 28, letterSpacing: -0.6 },
  err:     { fontFamily: font.regular, fontSize: 14, marginHorizontal: space.lg },

  // Card
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
    marginBottom: space.md,
  },
  cardMeta:   { flex: 1 },
  cardName:   { fontFamily: font.semi, fontSize: 17, letterSpacing: -0.3 },
  cardTicker: { fontFamily: font.medium, fontSize: 13, marginTop: 2 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: { fontSize: 12 },

  // Research
  researchItems: { gap: space.sm },
  researchItem:  {
    borderLeftWidth: 2,
    paddingLeft: space.sm,
  },
  researchTitle:   { fontFamily: font.semi, fontSize: 13, lineHeight: 17 },
  researchSnippet: { fontFamily: font.regular, fontSize: 13, lineHeight: 17, marginTop: 2 },
  researchAge:     { fontFamily: font.regular, fontSize: 11, marginTop: space.xs },
  noResearch:      { fontFamily: font.regular, fontSize: 13, fontStyle: 'italic', marginTop: space.xs },

  // Empty state
  empty: {
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.xl,
    marginTop: space.md,
  },
  emptyTitle: { fontFamily: font.semi, fontSize: 18 },
  emptyBody:  { fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: space.sm },
  emptyBtn: {
    marginTop: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  emptyBtnText: { fontFamily: font.semi, color: '#fff', fontSize: 15 },
})
