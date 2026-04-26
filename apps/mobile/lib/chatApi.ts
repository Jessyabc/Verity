/**
 * Client-side helpers for Afaqi conversation and message persistence.
 *
 * Conversations are keyed by (user_id, slug). A user can have many conversations
 * per company; each conversation is a separate chat thread.
 */

import { supabase } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Conversation = {
  id: string
  user_id: string
  slug: string
  title: string | null
  last_message_at: string
  created_at: string
}

export type ConversationCompanyRow = {
  slug: string
  name: string
  ticker: string | null
}

export type ChatMessageRow = {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  sources_json: AfaqiSourceRow[] | null
  extra_context_slugs: string[] | null
  created_at: string
}

export type AfaqiSourceRow = {
  title: string
  url: string
  source?: string
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

/** Returns all conversations for a user + company slug, newest first. */
export async function fetchConversations(slug: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_id, slug, title, last_message_at, created_at')
    .eq('slug', slug)
    .order('last_message_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Conversation[]
}

/** Returns all conversations for the signed-in user across all slugs, newest first. */
export async function fetchAllConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_id, slug, title, last_message_at, created_at')
    .order('last_message_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Conversation[]
}

/** Best-effort lookup of company display info for slugs. */
export async function fetchConversationCompaniesBySlugs(
  slugs: string[],
): Promise<ConversationCompanyRow[]> {
  const clean = [...new Set(slugs)].filter(Boolean)
  if (clean.length === 0) return []

  const { data, error } = await supabase
    .from('companies')
    .select('slug, name, ticker')
    .in('slug', clean)

  if (error) throw error
  return (data ?? []) as ConversationCompanyRow[]
}

/** Creates a new conversation and returns it. */
export async function createConversation(
  userId: string,
  slug: string,
): Promise<Conversation> {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, slug })
    .select('id, user_id, slug, title, last_message_at, created_at')
    .single()

  if (error) throw error
  return data as Conversation
}

/** Deletes a conversation and all messages (DB cascade). */
export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.from('conversations').delete().eq('id', conversationId)
  if (error) throw error
}

/**
 * Persists a user message to the DB before invoking the Edge Function.
 *
 * This is the safety net: if the Edge Function call later fails (network drop,
 * OpenAI timeout, server error) the user's question still survives, so the
 * conversation isn't silently truncated on next reload. The Edge Function is
 * told via `userMessageId` not to re-insert the same row.
 */
export async function insertUserMessage(
  conversationId: string,
  userId: string,
  content: string,
): Promise<ChatMessageRow> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content,
      sources_json: null,
      extra_context_slugs: null,
    })
    .select('id, conversation_id, role, content, sources_json, extra_context_slugs, created_at')
    .single()

  if (error) throw error
  return data as ChatMessageRow
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20

/**
 * Loads the most recent `PAGE_SIZE` messages for a conversation.
 * Returns messages in ascending order (oldest first) for display.
 */
export async function fetchMessages(conversationId: string): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, role, content, sources_json, extra_context_slugs, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (error) throw error
  return ((data ?? []) as ChatMessageRow[]).reverse()
}

/**
 * Loads the next page of older messages (lazy load on scroll-to-top).
 * `before` is the `created_at` of the oldest currently-loaded message.
 * Returns messages in ascending order.
 */
export async function fetchOlderMessages(
  conversationId: string,
  before: string,
): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, role, content, sources_json, extra_context_slugs, created_at')
    .eq('conversation_id', conversationId)
    .lt('created_at', before)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (error) throw error
  return ((data ?? []) as ChatMessageRow[]).reverse()
}
