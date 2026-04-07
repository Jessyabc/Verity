/**
 * Saved — your personal research library.
 *
 * Shows all bookmarked headlines (✦) grouped by company.
 * Tap a headline to open the source. Tap a company name to open its profile.
 * Swipe / tap ✦ again to unsave.
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

import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { fetchAllSavedHeadlines, unsaveHeadline, type SavedHeadlineRow } from '@/lib/savedHeadlines'
import { openUrl } from '@/lib/openUrl'
import { formatAgo } from '@/lib/format'
import { font, radius, space } from '@/constants/theme'

type Section = {
  slug: string
  title: string        // company display name (we derive from slug for now)
  data: SavedHeadlineRow[]
}

function slugToName(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function groupByCompany(rows: SavedHeadlineRow[]): Section[] {
  const map = new Map<string, SavedHeadlineRow[]>()
  for (const row of rows) {
    const arr = map.get(row.company_slug) ?? []
    arr.push(row)
    map.set(row.company_slug, arr)
  }
  return Array.from(map.entries()).map(([slug, data]) => ({
    slug,
    title: slugToName(slug),
    data,
  }))
}

function HeadlineItem({
  item,
  onUnsave,
  colors,
}: {
  item: SavedHeadlineRow
  onUnsave: (id: string) => void
  colors: ReturnType<typeof useVerityPalette>
}) {
  return (
    <View style={[styles.item, { borderTopColor: colors.stroke }]}>
      <Pressable style={styles.itemBody} onPress={() => void openUrl(item.url)}>
        <Text style={[styles.itemTitle, { color: colors.accent }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.snippet ? (
          <Text style={[styles.itemSnippet, { color: colors.inkMuted }]} numberOfLines={2}>
            {item.snippet}
          </Text>
        ) : null}
        <Text style={[styles.itemMeta, { color: colors.inkSubtle }]} numberOfLines={1}>
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

export default function SavedScreen() {
  const router   = useRouter()
  const insets   = useSafeAreaInsets()
  const colors   = useVerityPalette()
  const { user } = useAuth()

  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) { setSections([]); setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAllSavedHeadlines()
      setSections(groupByCompany(rows))
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
          .map((s) => ({ ...s, data: s.data.filter((r) => r.id !== id) }))
          .filter((s) => s.data.length > 0),
      )
    } catch {
      // silent
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas, paddingTop: insets.top + space.sm }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: colors.inkSubtle }]}>KNOWLEDGE BANK</Text>
        <Text style={[styles.title, { color: colors.ink }]}>Saved</Text>
      </View>

      {error ? (
        <Text style={[styles.err, { color: colors.danger }]}>{error}</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : sections.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>Nothing saved yet</Text>
          <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
            Open a company profile, run research, and tap ✧ on any headline to save it here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{
            paddingHorizontal: space.lg,
            paddingBottom: insets.bottom + space.xl,
          }}
          renderSectionHeader={({ section }) => (
            <Pressable
              style={styles.sectionHeader}
              onPress={() => router.push(`/company/${section.slug}`)}
            >
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>
                {section.title}
              </Text>
              <Text style={[styles.sectionArrow, { color: colors.accent }]}>→</Text>
            </Pressable>
          )}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
              <HeadlineItem item={item} onUnsave={handleUnsave} colors={colors} />
            </View>
          )}
          SectionSeparatorComponent={() => <View style={{ height: space.md }} />}
          ItemSeparatorComponent={() => null}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  header:  { paddingHorizontal: space.lg, marginBottom: space.lg },
  kicker:  { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8, marginBottom: space.xs },
  title:   { fontFamily: font.semi, fontSize: 28, letterSpacing: -0.6 },
  err:     { fontFamily: font.regular, fontSize: 14, marginHorizontal: space.lg },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    marginBottom: space.xs,
  },
  sectionTitle: { fontFamily: font.semi, fontSize: 15, letterSpacing: -0.2 },
  sectionArrow: { fontFamily: font.regular, fontSize: 14 },

  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
  itemBody:    { flex: 1, minWidth: 0 },
  itemTitle:   { fontFamily: font.semi, fontSize: 14, lineHeight: 20 },
  itemSnippet: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 3 },
  itemMeta:    { fontFamily: font.regular, fontSize: 11, marginTop: space.xs },
  unsaveBtn:   { paddingTop: 2 },
  unsaveIcon:  { fontSize: 16 },

  empty: {
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.xl,
  },
  emptyTitle: { fontFamily: font.semi, fontSize: 18 },
  emptyBody:  { fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: space.sm },
})
