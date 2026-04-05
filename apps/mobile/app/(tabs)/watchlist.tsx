import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
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
import {
  deleteWatchlistSlug,
  fetchCompaniesForSlugs,
  fetchWatchlistSlugs,
  type WatchlistCompanyRow,
} from '@/lib/watchlistApi'
import { supabase } from '@/lib/supabase'
import { font, radius, space } from '@/constants/theme'

export default function WatchlistScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { user } = useAuth()
  const [rows, setRows] = useState<WatchlistCompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const slugs = await fetchWatchlistSlugs(supabase)
      const companies = await fetchCompaniesForSlugs(supabase, slugs)
      setRows(companies)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load]),
  )

  const remove = async (slug: string) => {
    try {
      await deleteWatchlistSlug(supabase, slug)
      setRows((prev) => prev.filter((r) => r.slug !== slug))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const styles = buildStyles(colors)

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas, paddingTop: insets.top + space.sm }]}>
      <View style={styles.hero}>
        <Text style={[styles.kicker, { color: colors.inkSubtle }]}>WATCHLIST</Text>
        <Text style={[styles.h1, { color: colors.ink }]}>Your companies</Text>
        <Text style={[styles.lede, { color: colors.inkMuted }]}>
          Synced with Supabase `user_watchlist` — same rows as the web app for signed-in users.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : null}
      {error ? <Text style={[styles.err, { color: colors.danger }]}>{error}</Text> : null}

      {!loading && rows.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>Nothing here yet</Text>
          <Text style={[styles.emptyBody, { color: colors.inkMuted }]}>
            Add companies from a company profile, or build your list on the web — it will show up here.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/')}
          >
            <Text style={styles.primaryBtnText}>Go to search</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.slug}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xl }}
        renderItem={({ item }) => (
          <View style={[styles.row, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
            <Pressable
              style={styles.rowMain}
              onPress={() => router.push(`/company/${item.slug}`)}
            >
              <Text style={[styles.rowTitle, { color: colors.ink }]}>{item.name}</Text>
              <Text style={[styles.rowMeta, { color: colors.inkMuted }]}>
                {(item.ticker ?? '—') + ' · ' + item.slug}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.removeBtn, { borderColor: colors.stroke }]}
              onPress={() => void remove(item.slug)}
              hitSlop={8}
            >
              <Text style={[styles.removeBtnText, { color: colors.danger }]}>Remove</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  )
}

function buildStyles(colors: ReturnType<typeof useVerityPalette>) {
  return StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: space.lg },
    hero: { marginBottom: space.lg },
    kicker: { fontFamily: font.medium, fontSize: 11, letterSpacing: 1.8, marginBottom: space.xs },
    h1: { fontFamily: font.semi, fontSize: 28, letterSpacing: -0.6 },
    lede: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: space.sm },
    list: { flex: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radius.md,
      borderWidth: 1,
      marginBottom: space.sm,
      overflow: 'hidden',
    },
    rowMain: { flex: 1, padding: space.md },
    rowTitle: { fontFamily: font.semi, fontSize: 16 },
    rowMeta: { fontFamily: font.regular, fontSize: 13, marginTop: 4 },
    removeBtn: {
      paddingHorizontal: space.md,
      paddingVertical: space.md,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: colors.stroke,
    },
    removeBtnText: { fontFamily: font.semi, fontSize: 13 },
    emptyCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: space.xl,
      marginTop: space.md,
    },
    emptyTitle: { fontFamily: font.semi, fontSize: 18 },
    emptyBody: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: space.sm },
    primaryBtn: {
      marginTop: space.lg,
      paddingVertical: space.md,
      borderRadius: radius.sm,
      alignItems: 'center',
    },
    primaryBtnText: { fontFamily: font.semi, color: '#fff', fontSize: 15 },
    err: { fontFamily: font.regular, fontSize: 14, marginTop: space.sm },
  })
}
