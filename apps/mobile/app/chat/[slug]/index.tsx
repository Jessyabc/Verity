/**
 * Conversation list for a company's Afaqi chat.
 * Accessed from the company profile — shows all past threads for this company.
 * Tapping a row opens that conversation; the "+" button starts a new one.
 */

import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font, radius, space } from '@/constants/theme'
import {
  createConversation,
  deleteConversation,
  fetchConversations,
  type Conversation,
} from '@/lib/chatApi'

function formatDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ConversationListScreen() {
  const { slug: slugParam } = useLocalSearchParams<{ slug: string }>()
  const slug = typeof slugParam === 'string' ? slugParam : slugParam?.[0] ?? ''
  const navigation = useNavigation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { user } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Afaqi · Conversations',
      headerTintColor: colors.accent,
      headerStyle: { backgroundColor: colors.surfaceSolid },
      headerTitleStyle: { fontFamily: font.semi, color: colors.ink, fontSize: 17 },
    })
  }, [navigation, colors])

  const load = useCallback(async () => {
    if (!slug) return
    setError(null)
    try {
      const list = await fetchConversations(slug)
      setConversations(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { void load() }, [load])

  const startNewConversation = useCallback(async () => {
    if (!user || creating) return
    setCreating(true)
    try {
      const convo = await createConversation(user.id, slug)
      router.push(`/chat/${slug}/${convo.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create conversation')
    } finally {
      setCreating(false)
    }
  }, [user, slug, creating, router])

  const openConversation = useCallback((id: string) => {
    router.push(`/chat/${slug}/${id}`)
  }, [slug, router])

  const confirmDeleteConversation = useCallback(
    (item: Conversation) => {
      Alert.alert(
        'Delete conversation?',
        'This thread and all messages will be removed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await deleteConversation(item.id)
                  setConversations((prev) => prev.filter((c) => c.id !== item.id))
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Could not delete')
                }
              })()
            },
          },
        ],
      )
    },
    [],
  )

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

      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: colors.ink }]}>No conversations yet</Text>
          <Text style={[styles.emptyBody, { color: colors.inkSubtle }]}>
            {"Start a new conversation to ask Afaqi about this company's research."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + space.xxl + 64 }]}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.stroke }]} />
          )}
          renderItem={({ item }) => (
            <Swipeable
              friction={2}
              overshootRight={false}
              renderRightActions={() => (
                <View style={styles.swipeDeleteWrap}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.swipeDeleteBtn,
                      { opacity: pressed ? 0.85 : 1 },
                    ]}
                    onPress={() => confirmDeleteConversation(item)}
                  >
                    <Text style={styles.swipeDeleteLabel}>Delete</Text>
                  </Pressable>
                </View>
              )}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? colors.accentSoft : colors.canvas },
                ]}
                onPress={() => openConversation(item.id)}
              >
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                    {item.title ?? 'New conversation'}
                  </Text>
                  <Text style={[styles.rowDate, { color: colors.inkSubtle }]}>
                    {formatDate(item.last_message_at)}
                  </Text>
                </View>
                <Text style={[styles.rowChevron, { color: colors.inkSubtle }]}>›</Text>
              </Pressable>
            </Swipeable>
          )}
        />
      )}

      {/* New conversation FAB */}
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: creating ? colors.accentSoft : colors.accent,
            bottom: insets.bottom + space.xl,
          },
        ]}
        onPress={() => void startNewConversation()}
        disabled={creating || !user}
      >
        {creating ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.fabText}>+ New conversation</Text>
        )}
      </Pressable>
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

  listContent: { paddingTop: space.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    gap: space.sm,
  },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: font.medium, fontSize: 15 },
  rowDate: { fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  rowChevron: { fontFamily: font.regular, fontSize: 22 },

  swipeDeleteWrap: {
    justifyContent: 'center',
  },
  swipeDeleteBtn: {
    backgroundColor: '#b91c1c',
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    flex: 1,
    marginVertical: StyleSheet.hairlineWidth,
  },
  swipeDeleteLabel: {
    fontFamily: font.semi,
    fontSize: 14,
    color: '#fff',
  },

  separator: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },

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
