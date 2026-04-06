-- Knowledge bank: per-user saved research headlines.
-- Users bookmark individual headlines from company research for future reference.

create table public.saved_headlines (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  company_slug text        not null,
  title        text        not null,
  url          text        not null,
  source       text,
  snippet      text,
  published_at text,
  saved_at     timestamptz not null default now(),
  unique (user_id, company_slug, url)
);

alter table public.saved_headlines enable row level security;

create policy "users own their saved headlines"
  on public.saved_headlines for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index saved_headlines_user_slug_idx
  on public.saved_headlines (user_id, company_slug);
