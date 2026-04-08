/**
 * Afaqi chat screen for a specific conversation thread.
 *
 * Capabilities:
 *  - Loads persisted message history from DB on mount (lazy loads older messages on scroll-to-top)
 *  - Sends only the new message to the Edge Function (history is managed server-side)
 *  - Adapts the context pill to show all companies active in the current context
 *  - Supports cross-company research and live Perplexity answers transparently
 */

import { FunctionsHttpError } from '@supabase/supabase-js'
import { useLocalSearchParams, useNavigation } from 'expo-router'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { FlatList } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/contexts/AuthContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { fetchResearchCacheRow } from '@/lib/researchCache'
import { openUrl } from '@/lib/openUrl'
import { supabase } from '@/lib/supabase'
import { font, radius, space } from '@/constants/theme'
import { fetchMessages, fetchOlderMessages, type ChatMessageRow } from '@/lib/chatApi'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AfaqiSource = {
  title: string
  url: string
  source?: string
}

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: AfaqiSource[]
  /** DB row timestamp — used as the cursor for lazy loading older messages. */
  createdAt?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeHostname(url: string): string {
  try { return new URL(url).hostname } catch { return url }
}

function rowToMessage(row: ChatMessageRow): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    sources: row.sources_json ?? undefined,
    createdAt: row.created_at,
  }
}

async function formatInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context
    if (res && typeof res === 'object' && 'json' in res && typeof res.json === 'function') {
      try {
        const body = (await (res as Response).clone().json()) as { error?: string; message?: string }
        if (typeof body?.error === 'string') return body.error
        if (typeof body?.message === 'string') return body.message
      } catch { /* fall through */ }
    }
  }
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UserBubble({ msg, colors }: { msg: Message; colors: ReturnType<typeof useVerityPalette> }) {
  return (
    <View style={styles.userBubbleRow}>
      <View style={[styles.userBubble, { backgroundColor: colors.accent }]}>
        <Text style={styles.userBubbleText}>{msg.content}</Text>
      </View>
    </View>
  )
}

function AssistantBubble({ msg, colors }: { msg: Message; colors: ReturnType<typeof useVerityPalette> }) {
  return (
    <View style={styles.assistantRow}>
      <View style={styles.assistantAvatar}>
        <Text style={[styles.avatarText, { color: colors.accent }]}>A</Text>
      </View>
      <View style={styles.assistantContent}>
        <View style={[styles.assistantBubble, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
          <Text style={[styles.assistantText, { color: colors.ink }]}>{msg.content}</Text>
        </View>
        {msg.sources && msg.sources.length > 0 ? (
          <View style={styles.sourcesRow}>
            {msg.sources.map((s, i) => (
              <Pressable
                key={i}
                style={[styles.sourceChip, { borderColor: colors.stroke, backgroundColor: colors.accentSoft }]}
                onPress={() => void openUrl(s.url)}
              >
                <Text style={[styles.sourceChipText, { color: colors.accent }]} numberOfLines={1}>
                  {s.source ?? safeHostname(s.url)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

function TypingIndicator({ colors }: { colors: ReturnType<typeof useVerityPalette> }) {
  return (
    <View style={styles.assistantRow}>
      <View style={styles.assistantAvatar}>
        <Text style={[styles.avatarText, { color: colors.accent }]}>A</Text>
      </View>
      <View style={[styles.assistantBubble, { backgroundColor: colors.surfaceSolid, borderColor: colors.stroke }]}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    </View>
  )
}

function LoadMoreIndicator({ colors }: { colors: ReturnType<typeof useVerityPalette> }) {
  return (
    <View style={styles.loadMoreRow}>
      <ActivityIndicator size="small" color={colors.accent} />
    </View>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ChatScreen() {
  const { slug: slugParam, conversationId: convParam } = useLocalSearchParams<{
    slug: string
    conversationId: string
  }>()
  const slug = typeof slugParam === 'string' ? slugParam : slugParam?.[0] ?? ''
  const conversationId = typeof convParam === 'string' ? convParam : convParam?.[0] ?? ''

  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const colors = useVerityPalette()
  const { user } = useAuth()

  const [companyName, setCompanyName] = useState<string>(slug)
  /** Extra company names loaded into context during this session (for context pill). */
  const [extraCompanyNames, setExtraCompanyNames] = useState<string[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyReady, setHistoryReady] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasOlderMessages, setHasOlderMessages] = useState(false)

  const listRef = useRef<FlatList>(null)

  useLayoutEffect(() => {
    navigation.setOptions({
      title: `Afaqi · ${companyName}`,
      headerTintColor: colors.accent,
      headerStyle: { backgroundColor: colors.surfaceSolid },
      headerTitleStyle: { fontFamily: font.semi, color: colors.ink, fontSize: 17 },
    })
  }, [navigation, companyName, colors])

  // Load company name + initial message history
  useEffect(() => {
    if (!slug || !conversationId) return

    void (async () => {
      try {
        // Load company name from research cache
        const r = await fetchResearchCacheRow(slug)
        if (r?.company_name) setCompanyName(r.company_name)
      } catch { /* non-critical */ }

      try {
        const rows = await fetchMessages(conversationId)
        if (rows.length > 0) {
          setMessages(rows.map(rowToMessage))
          // If we got a full page back, there might be older messages
          setHasOlderMessages(rows.length >= 20)
        } else {
          // Fresh conversation — seed a welcome message (not persisted to DB)
          const itemCount = (await fetchResearchCacheRow(slug))?.items?.length ?? 0
          const compName = (await fetchResearchCacheRow(slug))?.company_name ?? slug
          setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: itemCount > 0
              ? `I have ${itemCount} research source${itemCount === 1 ? '' : 's'} loaded for ${compName}. What would you like to explore?`
              : `No research has been run for ${slug} yet. Go back to the company profile and hit "Refresh" first, then return here.`,
          }])
        }
      } catch { /* non-critical */ }

      setHistoryReady(true)
    })()
  }, [slug, conversationId])

  /** Load older messages when the user scrolls to the top. */
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasOlderMessages) return
    const oldest = messages.find((m) => m.createdAt)
    if (!oldest?.createdAt) return

    setLoadingOlder(true)
    try {
      const older = await fetchOlderMessages(conversationId, oldest.createdAt)
      if (older.length === 0) {
        setHasOlderMessages(false)
        return
      }
      setMessages((prev) => [...older.map(rowToMessage), ...prev])
      setHasOlderMessages(older.length >= 20)
    } catch { /* non-critical */ } finally {
      setLoadingOlder(false)
    }
  }, [conversationId, loadingOlder, hasOlderMessages, messages])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || !user) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)

    try {
      const { data, error } = await supabase.functions.invoke('afaqi-chat', {
        body: { slug, conversationId, message: text },
      })

      if (error) throw new Error(await formatInvokeError(error))

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data?.message ?? 'I had trouble processing that.',
        sources: data?.sources ?? [],
      }
      setMessages((prev) => [...prev, assistantMsg])

      // Update context pill if new companies were pulled in
      if (Array.isArray(data?.extraContextSlugs) && data.extraContextSlugs.length > 0) {
        // Slugs are IDs — display them as capitalised labels until we have names
        setExtraCompanyNames((prev) => {
          const next = [...prev]
          for (const s of data.extraContextSlugs as string[]) {
            const label = s.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
            if (!next.includes(label)) next.push(label)
          }
          return next
        })
      }

      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'Unknown error'
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Something went wrong: ${detail}. Please try again.`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, slug, conversationId, user])

  // Context pill label
  const contextLabel = extraCompanyNames.length > 0
    ? `${companyName} + ${extraCompanyNames.join(', ')}`
    : `${companyName} research`

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top + 44}
    >
      {/* Context pill */}
      <View style={[styles.contextPill, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.contextText, { color: colors.accent }]} numberOfLines={1}>
          Context: {contextLabel}
        </Text>
      </View>

      {/* Message list */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: space.xl }]}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0}
        // Scroll-to-top triggers older message load
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={loadingOlder ? <LoadMoreIndicator colors={colors} /> : null}
        onScroll={({ nativeEvent }) => {
          if (nativeEvent.contentOffset.y < 80 && hasOlderMessages && !loadingOlder) {
            void loadOlderMessages()
          }
        }}
        scrollEventThrottle={200}
        renderItem={({ item }) =>
          item.role === 'user' ? (
            <UserBubble msg={item} colors={colors} />
          ) : (
            <AssistantBubble msg={item} colors={colors} />
          )
        }
        ListFooterComponent={loading ? <TypingIndicator colors={colors} /> : null}
        onContentSizeChange={() => {
          if (loading) listRef.current?.scrollToEnd({ animated: true })
        }}
      />

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.surfaceSolid,
            borderTopColor: colors.stroke,
            paddingBottom: insets.bottom + space.sm,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.ink, backgroundColor: colors.canvas }]}
          placeholder={historyReady ? 'Ask about the research…' : 'Loading history…'}
          placeholderTextColor={colors.inkSubtle}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => void sendMessage()}
          returnKeyType="send"
          multiline
          maxLength={500}
          editable={historyReady && !loading}
        />
        <Pressable
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() && !loading ? colors.accent : colors.accentSoft },
          ]}
          onPress={() => void sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },

  contextPill: {
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
    alignItems: 'center',
  },
  contextText: { fontFamily: font.medium, fontSize: 12 },

  listContent: { paddingHorizontal: space.lg, paddingTop: space.md },

  loadMoreRow: {
    alignItems: 'center',
    paddingVertical: space.md,
  },

  // User bubble
  userBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: space.md,
  },
  userBubble: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    borderBottomRightRadius: 4,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
  },
  userBubbleText: { fontFamily: font.regular, fontSize: 15, color: '#fff', lineHeight: 21 },

  // Assistant bubble
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: space.md,
    gap: space.sm,
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(47,74,216,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: { fontFamily: font.bold, fontSize: 13 },
  assistantContent: { flex: 1, minWidth: 0 },
  assistantBubble: {
    borderRadius: radius.lg,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
  },
  assistantText: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },

  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.xs,
  },
  sourceChip: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    maxWidth: 160,
  },
  sourceChipText: { fontFamily: font.medium, fontSize: 11 },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 15,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    maxHeight: 100,
    lineHeight: 21,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendIcon: { fontFamily: font.bold, fontSize: 16, color: '#fff' },
})
