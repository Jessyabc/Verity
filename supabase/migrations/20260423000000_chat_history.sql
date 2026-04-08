-- Per-company chat conversations and messages (Afaqi persistent history)
--
-- conversations: one row per chat thread (user × company)
-- chat_messages: individual turns, ordered by created_at
--
-- History is loaded server-side by the afaqi-chat Edge Function; clients only
-- send the new message and receive the assistant reply.

create table public.conversations (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  slug        text        not null,
  title       text,                          -- first user message, truncated (set on first send)
  last_message_at timestamptz default now(), -- kept up-to-date for list ordering
  created_at  timestamptz default now()
);

create index conversations_user_slug_idx
  on public.conversations (user_id, slug, last_message_at desc);

comment on table public.conversations is
  'One row per Afaqi chat thread; a user can have many threads per company slug.';

alter table public.conversations enable row level security;

create policy conversations_own on public.conversations
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());


create table public.chat_messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.conversations(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  role            text        not null check (role in ('user', 'assistant')),
  content         text        not null,
  sources_json    jsonb,                     -- AfaqiSource[] from assistant turns
  extra_context_slugs text[],               -- slugs of additional companies fetched for this turn
  created_at      timestamptz default now()
);

create index chat_messages_conv_created_idx
  on public.chat_messages (conversation_id, created_at);

comment on table public.chat_messages is
  'Individual turns in an Afaqi conversation. Loaded by the Edge Function for LLM history context.';

alter table public.chat_messages enable row level security;

create policy chat_messages_own on public.chat_messages
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
