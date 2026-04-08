-- In-app feedback from authenticated users.
-- Kept minimal + neutral: message is user-written; no inference or scoring.

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  username text,
  message text not null check (char_length(message) between 1 and 2000),
  platform text,
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_created_at_idx on public.user_feedback (created_at desc);
create index if not exists user_feedback_user_id_idx on public.user_feedback (user_id);

alter table public.user_feedback enable row level security;

-- Users can insert their own feedback rows.
create policy user_feedback_insert_own
on public.user_feedback
for insert
to authenticated
with check (auth.uid() = user_id);

-- No direct select/update/delete from clients by default.
