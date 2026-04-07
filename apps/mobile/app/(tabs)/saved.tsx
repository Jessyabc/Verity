/**
 * Saved Links — your personal research library.
 *
 * Organised by company. Inside each company, two sub-sections:
 *   • Company Narrative  — links from official IR / filings
 *   • Media & Analyst    — links from news / analysts
 *
 * Only manually saved items appear here (bookmark icon on each headline).
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

import { useSidebar } from '@/components/Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { fetchAllSavedHeadlines, unsaveHeadline, type SavedHeadlineRow } from '@/lib/savedHeadlines'
import { openUrl } from '@/lib/openUrl'
import { formatAgo } from '@/lib/format'
import { font, radius, space } from '@/constants/theme'

type NarrativeGroup = {
  type: 'company' | 'media'
  label: string
  items: SavedHeadlineRow[]
}

type CompanySection = {
  slug: string
  companyName: string
  narratives: NarrativeGroup[]
  // SectionList requires a `data` array — we use the NarrativeGroup as items
  data: NarrativeGroup[]
}

function slugToName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildSections(rows: SavedHeadlineRow[]): CompanySection[] {
  // Group by company
  const bySlug = new Map<string, SavedHeadlineRow[]>()
  for (const row of rows) {
    const arr = bySlug.get(row.company_slug) ?? []
    arr.push(row)
    bySlug.set(row.company_slug, arr)
  }

  const sections: CompanySection[] = []
  for (const [slug, items] of bySlug.entries()) {
    const companyItems = items.filter((i) => i.narrative_type === 'company')
    const mediaItems   = items.filter((i) => i.narrative_type !== 'company') // default → media

    const narratives: NarrativeGroup[] = []
    if (companyItems.length > 0) {
      narratives.push({ type: 'company', label: 'Company Narrative', items: companyItems })
    }
    if (mediaItems.length > 0) {
      narratives.push({ type: 'media', label: 'Media & Analyst', items: mediaItems })
    }

    sections.push({
      slug,
      companyName: slugToName(slug),
      narratives,
      data: narratives,
    })
  }
  return sections
}

// ─── Single headline row ─────────────────────────────────────────────────────

function HeadlineRow({
  item,
  onUnsave,
  colors,
}: {
  item: SavedHeadlineRow
  onUnsave: (id: string) => void
  colors: ReturnType<typeof useVerityPalette>
}) {
  return (
    <View style={[styles.headlineRow, { borderTopColor: colors.stroke }]}>
      <Pressable style={styles.headlineBody} onPress={() => void openUrl(item.url)}>
        <Text style={[styles.headlineTitle, { color: colors.accent }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.snippet ? (
          <Text style={[styles.headlineSnippet, { color: colors.inkMuted }]} numberOfLines={2}>
            {item.snippet}
          </Text>
        ) : null}
        <Text style={[styles.headlineMeta, { color: colors.inkSubtle }]} numberOfLines={1}>
          {item.source ?? item.url}
          {item.saved_at ? ` · ${formatAgo(item.saved_at)}` : ''}
        </Text>
      </Pressable>
      <Pressable
        style={styles.unsaveBtn}
        onPress={() => onUnsave(item.id)}
        hitSlop={10}
      >
        <Text style={[styles.unsaveIcon, { color: colors.accent }]}>✦</Text>
      </Pressable>
    </View>
  )
}

// ─── Narrative sub-section ───────────────────────────────────────────────────

function NarrativeBlock({
  group,
  onUnsave,
  colors,
}: {
  group: NarrativeGroup
  onUnsave: (id: string) => void
  colors: ReturnType<typeof useVerityPalette>
}) {
  const dotColor = group.type === 'company' ? '#0f766e' : '#475569'
  return (
    <View style={styles.narrativeBlock}>
      <View style={styles.narrativeHeader}>
        <View style={[styles.narrativeDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.narrativeLabel, { color: colors.inkSubtle }]}>
          {group.label.toUpperCase()}
        </Text>
      </View>
      {group.items.map((item) => (
        <HeadlineRow
          key={item.id}
          item={item}
          onUnsave={onUnsave}
          colors={colors}
        />
      ))}
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const colors   = useVerityPalette()
  const { user } = useAuth()
  const { open: openSidebar } = useSidebar()

  const [sections, setSections] = useState<CompanySection[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) { setSections([]); setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const rows = await fetchAllSavedHeadlines()
      setSections(buildSections(rows))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(useCallback(() => { void load() }, [load]))

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
      // silent
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      {/* Header */}
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
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Saved Links</Text>
        <View style={{ width: 40 }} />
      </View>

      {error ? (
        <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>No saved links yet</Text>
          <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
            Open a company profile, run research, and tap ✧ on any headline to save it here.
            Links are grouped by company and narrative type.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(group) => `${group.type}`}
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
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>
                {section.companyName}
              </Text>
              <Text style={[styles.sectionArrow, { color: colors.accent }]}>→</Text>
            </Pressable>
          )}
          renderItem={({ item: group }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke },
              ]}
            >
              <NarrativeBlock
                group={group}
                onUnsave={handleUnsave}
                colors={colors}
              />
            </View>
          )}
          SectionSeparatorComponent={() => <View style={{ height: space.md }} />}
          ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        />
      )}
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
  err:         { fontFamily: font.regular, fontSize: 14, marginHorizontal: space.lg, marginTop: space.sm },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    marginBottom: space.xs,
    marginTop: space.md,
  },
  sectionTitle: { fontFamily: font.semi, fontSize: 16, letterSpacing: -0.2 },
  sectionArrow: { fontFamily: font.regular, fontSize: 14 },

  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },

  narrativeBlock:  { paddingBottom: space.xs },
  narrativeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  narrativeDot:  { width: 6, height: 6, borderRadius: 3 },
  narrativeLabel:{ fontFamily: font.medium, fontSize: 10, letterSpacing: 1.4 },

  headlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  headlineBody:    { flex: 1, minWidth: 0 },
  headlineTitle:   { fontFamily: font.semi, fontSize: 14, lineHeight: 20 },
  headlineSnippet: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 3 },
  headlineMeta:    { fontFamily: font.regular, fontSize: 11, marginTop: space.xs },
  unsaveBtn:       { paddingTop: 2 },
  unsaveIcon:      { fontSize: 16 },

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
