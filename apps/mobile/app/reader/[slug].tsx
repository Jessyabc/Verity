/**
 * Full research reader — long-form view of a company's research digest.
 *
 * Accessed by tapping "Read full analysis →" on the company profile.
 * Shows every research item with its full snippet, source classification,
 * and a prominent "Ask Afaqi" CTA at the bottom.
 */

import FontAwesome from '@expo/vector-icons/FontAwesome'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { VerityMark } from '@/components/VerityMark'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { fetchResearchCacheRow, type CompanyResearchRow, type ResearchNewsItem } from '@/lib/researchCache'
import { classifyItem } from '@/lib/headlineGrouping'
import { formatAgo, formatUnknownError } from '@/lib/format'
import { openUrl } from '@/lib/openUrl'
import { font, radius, space } from '@/constants/theme'

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

const TIER_COLORS: Record<'official' | 'external', string> = {
  official: '#0f766e',
  external: '#475569',
}

const TIER_LABELS: Record<'official' | 'external', string> = {
  official: 'OFFICIAL',
  external: 'EXTERNAL',
}

function SourceItem({
  item,
  colors,
}: {
  item: ResearchNewsItem
  colors: ReturnType<typeof useVerityPalette>
}) {
  const tier = classifyItem(item)
  return (
    <Pressable
      style={[styles.sourceItem, { borderTopColor: colors.stroke }]}
      onPress={() => void openUrl(item.url)}
    >
      <View style={[styles.tierBar, { backgroundColor: TIER_COLORS[tier] }]} />
      <View style={styles.sourceBody}>
        <View style={styles.sourceTopRow}>
          <View style={[styles.tierPill, { backgroundColor: TIER_COLORS[tier] }]}>
            <Text style={styles.tierPillText}>{TIER_LABELS[tier]}</Text>
          </View>
          {item.published_at ? (
            <Text style={[styles.sourceMeta, { color: colors.inkSubtle }]}>
              {formatAgo(item.published_at)}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.sourceTitle, { color: colors.accent }]} numberOfLines={3}>
          {item.title}
        </Text>
        {item.snippet ? (
          <Text style={[styles.sourceSnippet, { color: colors.inkMuted }]}>
            {item.snippet}
          </Text>
        ) : null}
        <Text style={[styles.sourceDomain, { color: colors.inkSubtle }]} numberOfLines={1}>
          {item.source ?? safeHostname(item.url)} ↗
        </Text>
      </View>
    </Pressable>
  )
}

export default function ReaderScreen() {
  const { slug: slugParam } = useLocalSearchParams<{ slug: string }>()
  const slug      = typeof slugParam === 'string' ? slugParam : slugParam?.[0] ?? ''
  const navigation = useNavigation()
  const router     = useRouter()
  const insets     = useSafeAreaInsets()
  const colors     = useVerityPalette()

  const [research, setResearch] = useState<CompanyResearchRow | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!slug) { setLoading(false); return }
    try {
      const r = await fetchResearchCacheRow(slug)
      setResearch(r)
    } catch (e) {
      setError(formatUnknownError(e))
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { void load() }, [load])

  useLayoutEffect(() => {
    const company = research?.company_name ?? slug
    navigation.setOptions({
      title: company,
      headerBackTitle: 'Back',
      headerBackVisible: false,
      headerTintColor: colors.accent,
      headerStyle: { backgroundColor: colors.surfaceSolid },
      headerTitleStyle: { fontFamily: font.semi, color: colors.ink, fontSize: 17 },
      headerLeft: () => (
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
          style={{ marginLeft: Platform.OS === 'ios' ? 8 : 12, paddingVertical: 6 }}
        >
          <FontAwesome name="list-ul" size={21} color={colors.accent} />
        </Pressable>
      ),
    })
  }, [navigation, research?.company_name, slug, colors])

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    )
  }

  if (error || !research) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas, padding: space.xl }]}>
        <Text style={[styles.errorText, { color: colors.inkMuted }]}>
          {error ?? 'No research available yet. Run research from the company profile.'}
        </Text>
        <Pressable style={[styles.btn, { backgroundColor: colors.accent }]} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  const items = research.items ?? []
  const official = items.filter((i) => classifyItem(i) === 'official')
  const external = items.filter((i) => classifyItem(i) === 'external')

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.canvas }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: space.xl, paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: colors.inkSubtle }]}>RESEARCH DIGEST</Text>
        <Text style={[styles.companyName, { color: colors.ink }]}>
          {research.company_name}
          {research.ticker ? ` · ${research.ticker}` : ''}
        </Text>
        <Text style={[styles.updatedAt, { color: colors.inkSubtle }]}>
          {formatAgo(research.fetched_at)}
          {research.model ? ` · ${research.model}` : ''}
        </Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.stroke }]} />

      {/* Synthesis paragraph */}
      {research.synthesis ? (
        <View style={[styles.synthesisCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
          <Text style={[styles.synthesisKicker, { color: colors.inkSubtle }]}>SUMMARY</Text>
          <Text style={[styles.synthesisText, { color: colors.ink }]}>{research.synthesis}</Text>
        </View>
      ) : null}

      {/* Company narrative */}
      {official.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionMark}>
              <VerityMark size={22} />
            </View>
            <Text style={[styles.sectionLabel, { color: colors.inkSubtle }]}>
              WHAT THE COMPANY SAYS
            </Text>
          </View>
          {official.map((item, i) => (
            <SourceItem key={`off-${i}`} item={item} colors={colors} />
          ))}
        </View>
      ) : null}

      {/* Public narrative */}
      {external.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: TIER_COLORS.external }]} />
            <Text style={[styles.sectionLabel, { color: colors.inkSubtle }]}>
              WHAT THE WORLD SAYS
            </Text>
          </View>
          {external.map((item, i) => (
            <SourceItem key={`ext-${i}`} item={item} colors={colors} />
          ))}
        </View>
      ) : null}

      {items.length === 0 ? (
        <Text style={[styles.empty, { color: colors.inkMuted }]}>
          No research items found. Run research from the company profile.
        </Text>
      ) : null}

      {/* Ask Afaqi CTA */}
      <View style={styles.ctaContainer}>
        <Pressable
          style={[styles.afaqiBtn, { backgroundColor: colors.accent }]}
          onPress={() => router.push(`/chat/${slug}`)}
        >
          <Text style={styles.afaqiLabel}>Afaqi</Text>
          <Text style={styles.afaqiBtnText}>Ask about this research</Text>
        </Pressable>
        <Text style={[styles.disclaimer, { color: colors.inkSubtle }]}>
          Afaqi answers only from the research above · Not investment advice
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen:   { flex: 1 },
  content:  { paddingHorizontal: space.lg },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontFamily: font.regular, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  header: { marginBottom: space.lg },
  kicker:  { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8, marginBottom: space.xs },
  companyName: { fontFamily: font.bold, fontSize: 28, letterSpacing: -0.8, lineHeight: 34 },
  updatedAt:   { fontFamily: font.regular, fontSize: 13, marginTop: space.xs },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: space.xl },

  section: { marginBottom: space.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  sectionDot:   { width: 8, height: 8, borderRadius: 4 },
  sectionMark:  { marginRight: -2 },
  sectionLabel: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8 },

  sourceItem: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.md,
    gap: space.sm,
  },
  tierBar:     { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  sourceBody:  { flex: 1, minWidth: 0 },
  sourceTopRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  tierPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tierPillText: {
    color: '#fff',
    fontFamily: font.medium,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  sourceMeta:    { fontFamily: font.regular, fontSize: 12, color: '#8b919c' },
  sourceTitle:   { fontFamily: font.semi, fontSize: 15, lineHeight: 21 },
  sourceSnippet: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, marginTop: space.xs },
  sourceDomain:  { fontFamily: font.regular, fontSize: 12, marginTop: space.sm },

  synthesisCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    marginBottom: space.xl,
  },
  synthesisKicker: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8, marginBottom: space.sm },
  synthesisText:   { fontFamily: font.regular, fontSize: 16, lineHeight: 26 },

  empty: { fontFamily: font.regular, fontSize: 15, textAlign: 'center', marginTop: space.xl },

  ctaContainer: { marginTop: space.xl },
  afaqiBtn: {
    borderRadius: radius.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.xs,
  },
  afaqiLabel:   { fontFamily: font.medium, fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.4 },
  afaqiBtnText: { fontFamily: font.semi, fontSize: 17, color: '#fff' },

  btn:     { marginTop: space.xl, paddingVertical: space.md, paddingHorizontal: space.xl, borderRadius: radius.sm },
  btnText: { fontFamily: font.semi, color: '#fff', fontSize: 15 },

  disclaimer: {
    fontFamily: font.regular,
    fontSize: 11,
    marginTop: space.md,
    textAlign: 'center',
    opacity: 0.7,
  },
})
