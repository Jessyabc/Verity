-- Per-user watchlist for syncing browser state and CI jobs (distinct slugs across all users).

create table public.user_watchlist (
  user_id uuid not null references auth.users (id) on delete cascade,
  company_slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, company_slug)
);

create index user_watchlist_company_slug_idx on public.user_watchlist (company_slug);

alter table public.user_watchlist enable row level security;

create policy user_watchlist_select_own on public.user_watchlist
  for select to authenticated using (auth.uid() = user_id);

create policy user_watchlist_insert_own on public.user_watchlist
  for insert to authenticated with check (auth.uid() = user_id);

create policy user_watchlist_delete_own on public.user_watchlist
  for delete to authenticated using (auth.uid() = user_id);

comment on table public.user_watchlist is 'Company slugs on the signed-in user watchlist; service role reads all rows for batch jobs';
