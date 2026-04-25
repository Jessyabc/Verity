/**
 * Saved Links — BRAND styling; company headers use multi-source logos (Clearbit / favicons, not SEC-only).
 */

import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'

import Ionicons from '@expo/vector-icons/Ionicons'
import { CompanyLogo } from '@/components/CompanyLogo'
import { useSidebar } from '@/components/Sidebar'
import { VerityMark } from '@/components/VerityMark'
import { useAuth } from '@/contexts/AuthContext'
import { font, radius, space } from '@/constants/theme'
import { useAdaptiveBrand } from '@/hooks/useAdaptiveBrand'
import { buildCompanyLogoCandidates } from '@/lib/companyLogo'
import { formatAgo, formatUnknownError } from '@/lib/format'
import { openUrl } from '@/lib/openUrl'
import { fetchAllSavedHeadlines, unsaveHeadline, type SavedHeadlineRow } from '@/lib/savedHeadlines'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import {
  fetchCompaniesForSlugs,
  fetchSourceBaseUrlsBySlugs,
  type WatchlistCompanyRow,
} from '@/lib/watchlistApi'

type NarrativeGroup = {
  type: 'company' | 'media'
  label: string
  items: SavedHeadlineRow[]
}

type CompanySection = {
  slug: string
  companyName: string
  ticker: string | null
  logoCandidates: string[]
  narratives: NarrativeGroup[]
  data: NarrativeGroup[]
}

function slugToName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildSections(
  rows: SavedHeadlineRow[],
  companyBySlug: Map<string, WatchlistCompanyRow>,
  sourceBySlug: Map<string, string[]>,
): CompanySection[] {
  const bySlug = new Map<string, SavedHeadlineRow[]>()
  for (const row of rows) {
    const arr = bySlug.get(row.company_slug) ?? []
    arr.push(row)
    bySlug.set(row.company_slug, arr)
  }

  const sections: CompanySection[] = []
  for (const [slug, items] of bySlug.entries()) {
    const co = companyBySlug.get(slug)
    const companyItems = items.filter((i) => i.narrative_type === 'company')
    const mediaItems = items.filter((i) => i.narrative_type !== 'company')

    const narratives: NarrativeGroup[] = []
    if (companyItems.length > 0) {
      narratives.push({ type: 'company', label: 'Company Narrative', items: companyItems })
    }
    if (mediaItems.length > 0) {
      narratives.push({ type: 'media', label: 'Media & Analyst', items: mediaItems })
    }

    sections.push({
      slug,
      companyName: co?.name ?? slugToName(slug),
      ticker: co?.ticker ?? null,
      logoCandidates: buildCompanyLogoCandidates({
        explicit: co?.logo_url,
        sourceBaseUrls: sourceBySlug.get(slug) ?? [],
      }),
      narratives,
      data: narratives,
    })
  }
  return sections
}

function HeadlineRow({
  item,
  brand,
  onUnsave,
}: {
  item: SavedHeadlineRow
  brand: ReturnType<typeof useAdaptiveBrand>
  onUnsave: (id: string) => void
}) {
  return (
    <View style={[styles.headlineRow, { borderTopColor: brand.stroke }]}>
      <Pressable style={styles.headlineBody} onPress={() => void openUrl(item.url)}>
        <Text style={[styles.headlineTitle, { color: brand.tealLight }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.snippet ? (
          <Text style={[styles.headlineSnippet, { color: brand.onNavyMuted }]} numberOfLines={2}>
            {item.snippet}
          </Text>
        ) : null}
        <Text style={[styles.headlineMeta, { color: brand.onNavySubtle }]} numberOfLines={1}>
          {item.source ?? item.url}
          {item.saved_at ? ` · ${formatAgo(item.saved_at)}` : ''}
        </Text>
      </Pressable>
      <Pressable style={styles.unsaveBtn} onPress={() => onUnsave(item.id)} hitSlop={10}>
        <Text style={[styles.unsaveIcon, { color: brand.tealLight }]}>✦</Text>
      </Pressable>
    </View>
  )
}

function NarrativeBlock({
  group,
  brand,
  onUnsave,
}: {
  group: NarrativeGroup
  brand: ReturnType<typeof useAdaptiveBrand>
  onUnsave: (id: string) => void
}) {
  const dotColor = group.type === 'company' ? brand.tealDark : brand.tealLight
  return (
    <View style={styles.narrativeBlock}>
      <View style={styles.narrativeHeader}>
        <View style={[styles.narrativeDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.narrativeLabel, { color: brand.onNavySubtle }]}>
          {group.label.toUpperCase()}
        </Text>
      </View>
      {group.items.map((item) => (
        <HeadlineRow key={item.id} item={item} brand={brand} onUnsave={onUnsave} />
      ))}
    </View>
  )
}

export default function SavedScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  const { open: openSidebar } = useSidebar()
  const brand = useAdaptiveBrand()

  const [sections, setSections] = useState<CompanySection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setSections([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAllSavedHeadlines()
      const slugs = [...new Set(rows.map((r) => r.company_slug))]
      let companyBySlug = new Map<string, WatchlistCompanyRow>()
      let sourceBySlug = new Map<string, string[]>()
      if (isSupabaseConfigured() && slugs.length > 0) {
        const [cos, src] = await Promise.all([
          fetchCompaniesForSlugs(supabase, slugs),
          fetchSourceBaseUrlsBySlugs(supabase, slugs),
        ])
        companyBySlug = new Map(cos.map((c) => [c.slug, c]))
        sourceBySlug = src
      }
      setSections(buildSections(rows, companyBySlug, sourceBySlug))
    } catch (e) {
      setError(formatUnknownError(e))
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(useCallback(() => {
    void load()
  }, [load]))

  const handleUnsave = async (id: string) => {
    try {
      await unsaveHeadline(id)
      setSections((prev) =>
        prev
          .map((s) => ({
            ...s,
            narratives: s.narratives
              .map((n) => ({ ...n, items: n.items.filter((i) => i.id !== id) }))
              .filter((n) => n.items.length > 0),
            data: s.data
              .map((n) => ({ ...n, items: n.items.filter((i) => i.id !== id) }))
              .filter((n) => n.items.length > 0),
          }))
          .filter((s) => s.data.length > 0),
      )
    } catch {
      /* silent */
    }
  }

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
        <Text style={[styles.headerTitle, { color: brand.onNavy }]}>Saved Links</Text>
        <View style={{ width: 8 }} />
      </View>

      {error ? (
        <View style={[styles.errBanner, { backgroundColor: 'rgba(185, 28, 28, 0.25)' }]}>
          <Text style={[styles.err, { color: brand.onNavy }]}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={brand.tealLight} size="large" style={{ marginTop: space.xl }} />
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: brand.onNavy }]}>No saved links yet</Text>
          <Text style={[styles.emptyBody, { color: brand.onNavyMuted }]}>
            Open a company profile, run research, and tap ✧ on any headline to save it here. Links are grouped by
            company and narrative type.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(group) => `${group.type}-${group.items[0]?.id ?? group.label}`}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingBottom: insets.bottom + space.xl,
          }}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => (
            <Pressable
              style={styles.sectionHeader}
              onPress={() => router.push(`/company/${section.slug}`)}
            >
              <CompanyLogo
                name={section.companyName}
                ticker={section.ticker}
                logoCandidates={section.logoCandidates}
                size="sm"
                tone="brand"
              />
              <View style={styles.sectionHeaderText}>
                <Text style={[styles.sectionTitle, { color: brand.onNavy }]} numberOfLines={1}>
                  {section.companyName}
                </Text>
                {section.ticker ? (
                  <Text style={[styles.sectionTicker, { color: brand.onNavyMuted }]} numberOfLines={1}>
                    {section.ticker}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={brand.tealLight} />
            </Pressable>
          )}
          renderItem={({ item: group }) => (
            <BlurView intensity={40} tint={brand.blurTint} style={styles.cardBlur}>
              <View style={[styles.cardInner, { backgroundColor: brand.glassNavy }]}>
                <NarrativeBlock group={group} brand={brand} onUnsave={handleUnsave} />
              </View>
            </BlurView>
          )}
          SectionSeparatorComponent={() => <View style={{ height: space.md }} />}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        />
      )}
    </View>
  )
}

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
  headerTitle: { flex: 1, fontFamily: font.semi, fontSize: 18, letterSpacing: -0.3 },
  errBanner: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
  },
  err: { fontFamily: font.regular, fontSize: 14 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    marginTop: space.sm,
  },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  sectionTitle: { fontFamily: font.semi, fontSize: 17, letterSpacing: -0.2 },
  sectionTicker: { fontFamily: font.medium, fontSize: 12, marginTop: 2 },

  cardBlur: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardInner: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  narrativeBlock: { paddingBottom: space.xs },
  narrativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  narrativeDot: { width: 6, height: 6, borderRadius: 3 },
  narrativeLabel: { fontFamily: font.medium, fontSize: 10, letterSpacing: 1.4 },

  headlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  headlineBody: { flex: 1, minWidth: 0 },
  headlineTitle: { fontFamily: font.semi, fontSize: 14, lineHeight: 20 },
  headlineSnippet: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 3 },
  headlineMeta: { fontFamily: font.regular, fontSize: 11, marginTop: space.xs },
  unsaveBtn: { paddingTop: 2 },
  unsaveIcon: { fontSize: 16 },

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
  },
})
