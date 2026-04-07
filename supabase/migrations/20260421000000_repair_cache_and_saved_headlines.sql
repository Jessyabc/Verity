-- Repair drift when older migrations (20260412–20260414) were not applied on a remote project.
-- Safe to run multiple times (idempotent).

-- ─── company_research_cache: columns expected by mobile + Edge functions ─────
alter table public.company_research_cache
  add column if not exists synthesis text,
  add column if not exists company_narrative text,
  add column if not exists media_narrative text,
  add column if not exists factual_gaps jsonb default '[]'::jsonb;

-- ─── saved_headlines: knowledge bank (per-user saved research links) ─────────
create table if not exists public.saved_headlines (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  company_slug text        not null,
  title        text        not null,
  url          text        not null,
  source       text,
  snippet      text,
  published_at text,
  saved_at     timestamptz not null default now(),
  unique (user_id, company_slug, url)
);

alter table public.saved_headlines
  add column if not exists narrative_type text default 'media';

-- Normalize null narrative_type on legacy rows
update public.saved_headlines
  set narrative_type = 'media'
  where narrative_type is null;

alter table public.saved_headlines
  alter column narrative_type set default 'media';

alter table public.saved_headlines enable row level security;

drop policy if exists "users own their saved headlines" on public.saved_headlines;
create policy "users own their saved headlines"
  on public.saved_headlines for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists saved_headlines_user_slug_idx
  on public.saved_headlines (user_id, company_slug);

comment on table public.saved_headlines is 'User-saved headlines from company research (company vs media narrative)';
