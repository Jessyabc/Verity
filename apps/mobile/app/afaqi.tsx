/**
 * Afaqi — all conversations grouped by company slug.
 * Portfolio summary conversations (`__portfolio__`) are always pinned first.
 */
import { useNavigation, useRouter } from 'expo-router'
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
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
import { font, radius, space } from '@/constants/theme'
import {
  createConversation,
  fetchAllConversations,
  fetchConversationCompaniesBySlugs,
  type Conversation,
} from '@/lib/chatApi'

const PORTFOLIO_SLUG = '__portfolio__'

type Section = {
  slug: string
  title: string
  subtitle: string | null
  data: Conversation[]
  /** Used for sorting sections (portfolio pinned separately). */
  sortKey: string
}

function safeDate(iso: string | null | undefined): Date | null {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

function formatWhen(iso: string): string {
  const d = safeDate(iso)
  if (!d) return '—'
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AfaqiAllConversationsScreen() {
  const navigation = useNavigation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [companyMap, setCompanyMap] = useState<Map<string, { name: string; ticker: string | null }>>(new Map())
  const [creating, setCreating] = useState(false)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Afaqi',
      headerTintColor: colors.accent,
      headerStyle: { backgroundColor: colors.surfaceSolid },
      headerTitleStyle: { fontFamily: font.semi, color: colors.ink, fontSize: 17 },
    })
  }, [navigation, colors])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchAllConversations()
      // Hide conversations that never had an exchange — title is set only after
      // the first user/assistant pair, so untitled threads are placeholder-only.
      const withExchanges = rows.filter((r) => typeof r.title === 'string' && r.title.trim().length > 0)
      setConversations(withExchanges)

      const slugs = withExchanges
        .map((r) => r.slug)
        .filter((s): s is string => typeof s === 'string' && s.length > 0 && s !== PORTFOLIO_SLUG)

      const companies = await fetchConversationCompaniesBySlugs(slugs)
      const map = new Map<string, { name: string; ticker: string | null }>()
      for (const c of companies) map.set(c.slug, { name: c.name, ticker: c.ticker })
      setCompanyMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const startNewPortfolioConversation = useCallback(async () => {
    if (creating) return
    if (!user) {
      router.push(`/chat/${PORTFOLIO_SLUG}`)
      return
    }
    setCreating(true)
    setError(null)
    try {
      // The DB will enforce auth + user_id ownership via RLS.
      // We only need to provide the user_id for inserts.
      const convo = await createConversation(user.id, PORTFOLIO_SLUG)
      router.push(`/chat/${PORTFOLIO_SLUG}/${convo.id}`)
    } catch (e) {
      // Fallback: if create fails (e.g. missing user_id), go to the portfolio list
      // where the user can create a new convo via the existing FAB.
      setError(e instanceof Error ? e.message : 'Could not create conversation')
      router.push(`/chat/${PORTFOLIO_SLUG}`)
    } finally {
      setCreating(false)
    }
  }, [creating, router, user])

  const sections: Section[] = useMemo(() => {
    const bySlug = new Map<string, Conversation[]>()
    for (const c of conversations) {
      const list = bySlug.get(c.slug) ?? []
      list.push(c)
      bySlug.set(c.slug, list)
    }

    const out: Section[] = []
    for (const [slug, list] of bySlug.entries()) {
      const top = list[0]
      const sortKey = top?.last_message_at ?? top?.created_at ?? ''
      if (slug === PORTFOLIO_SLUG) {
        out.push({
          slug,
          title: 'Your portfolio',
          subtitle: 'Watchlist summary chat',
          data: list,
          sortKey,
        })
        continue
      }
      const company = companyMap.get(slug)
      const title = company?.name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
      out.push({
        slug,
        title,
        subtitle: company?.ticker ?? null,
        data: list,
        sortKey,
      })
    }

    out.sort((a, b) => {
      if (a.slug === PORTFOLIO_SLUG && b.slug !== PORTFOLIO_SLUG) return -1
      if (b.slug === PORTFOLIO_SLUG && a.slug !== PORTFOLIO_SLUG) return 1
      // newest section first
      return String(b.sortKey).localeCompare(String(a.sortKey))
    })

    return out
  }, [conversations, companyMap])

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: 'rgba(185,28,28,0.15)' }]}>
          <Text style={[styles.errorText, { color: colors.ink }]}>{error}</Text>
        </View>
      ) : null}

      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>No conversations yet</Text>
          <Text style={[styles.emptyBody, { color: colors.inkSubtle }]}>
            Start a conversation from a company page or the watchlist summary.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: pressed ? colors.accentSoft : colors.accent, opacity: creating ? 0.7 : 1 },
            ]}
            onPress={() => void startNewPortfolioConversation()}
            disabled={creating}
            accessibilityRole="button"
            accessibilityLabel="Start a new portfolio conversation"
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>+ New portfolio conversation</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl + 92 }}
          stickySectionHeadersEnabled={false}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.stroke }]} />
          )}
          renderSectionHeader={({ section }) => {
            const isPortfolio = section.slug === PORTFOLIO_SLUG
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.sectionHeader,
                  isPortfolio
                    ? {
                        backgroundColor: pressed ? colors.accentSoft : 'transparent',
                        borderLeftColor: colors.accent,
                        borderLeftWidth: 3,
                      }
                    : {
                        backgroundColor: pressed ? colors.accentSoft : 'transparent',
                        borderTopColor: colors.stroke,
                        borderTopWidth: StyleSheet.hairlineWidth,
                      },
                ]}
                onPress={() => router.push(`/chat/${section.slug}`)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${section.title} conversations`}
              >
                <View style={styles.sectionHeaderText}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.ink },
                      isPortfolio && { color: colors.accent },
                    ]}
                    numberOfLines={1}
                  >
                    {section.title}
                  </Text>
                  {section.subtitle ? (
                    <Text style={[styles.sectionSubtitle, { color: colors.inkSubtle }]} numberOfLines={1}>
                      {section.subtitle}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.sectionHint, { color: colors.inkSubtle }]}>
                  See all
                </Text>
              </Pressable>
            )
          }}
          renderItem={({ item, section }) => (
            <Pressable
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? colors.accentSoft : colors.canvas,
                },
              ]}
              onPress={() => router.push(`/chat/${section.slug}/${item.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Open conversation ${item.title ?? ''}`}
            >
              <View style={[styles.rowRail, { backgroundColor: colors.stroke }]} />
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.inkMuted }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.inkSubtle }]}>
                  {formatWhen(item.last_message_at)}
                </Text>
              </View>
              <Text style={[styles.rowChevron, { color: colors.inkSubtle }]}>›</Text>
            </Pressable>
          )}
        />
      )}

      {/* New portfolio conversation FAB */}
      {sections.length > 0 ? (
        <Pressable
          style={[
            styles.fab,
            {
              backgroundColor: creating ? colors.accentSoft : colors.accent,
              bottom: insets.bottom + space.xl,
            },
          ]}
          onPress={() => void startNewPortfolioConversation()}
          disabled={creating}
          accessibilityRole="button"
          accessibilityLabel="Start a new portfolio conversation"
        >
          {creating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.fabText}>+ New portfolio chat</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  errorBanner: {
    margin: space.md,
    padding: space.md,
    borderRadius: radius.sm,
  },
  errorText: { fontFamily: font.regular, fontSize: 14 },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  emptyTitle: { fontFamily: font.semi, fontSize: 18 },
  emptyBody: { fontFamily: font.regular, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  primaryBtn: {
    marginTop: space.md,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: font.semi, fontSize: 15, color: '#ffffff' },

  sectionHeader: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
  },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  sectionTitle: { fontFamily: font.bold, fontSize: 19, letterSpacing: -0.4 },
  sectionSubtitle: { fontFamily: font.medium, fontSize: 12, marginTop: 1, letterSpacing: 0.2 },
  sectionHint: { fontFamily: font.medium, fontSize: 12, paddingBottom: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.xl + space.xs,
    paddingRight: space.lg,
    paddingVertical: space.sm + 2,
    gap: space.sm,
  },
  rowRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: space.lg + space.sm,
    width: StyleSheet.hairlineWidth,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: font.regular, fontSize: 14 },
  rowMeta: { fontFamily: font.regular, fontSize: 11, marginTop: 1 },
  rowChevron: { fontFamily: font.regular, fontSize: 18 },

  separator: { height: 0, marginLeft: 0 },

  fab: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  fabText: { fontFamily: font.semi, fontSize: 15, color: '#fff' },
})

