-- Repair migration: watchlist_digest table was missing in remote DB despite the
-- original migration being recorded. This re-creates the table safely if absent.

create table if not exists public.watchlist_digest (
  user_id         uuid        primary key references auth.users(id) on delete cascade,
  digest_text     text        not null default '',
  sources         jsonb       not null default '[]',
  slugs_snapshot  text[]      not null default '{}',
  generated_at    timestamptz not null default now(),
  model           text,
  is_generating   boolean     not null default false
);

alter table public.watchlist_digest enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'watchlist_digest'
      and policyname = 'users own their digest'
  ) then
    create policy "users own their digest"
      on public.watchlist_digest
      for all
      using  (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create index if not exists watchlist_digest_user_id_idx
  on public.watchlist_digest (user_id);

