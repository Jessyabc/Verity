-- What-changed memory: live change_summary on cache + append-only snapshots.

alter table public.company_research_cache
  add column if not exists change_summary jsonb,
  add column if not exists research_version integer not null default 0,
  add column if not exists previous_fetched_at timestamptz;

comment on column public.company_research_cache.change_summary is
  'Deterministic diff vs previous refresh: bullets, source/gap/metric deltas';
comment on column public.company_research_cache.research_version is
  'Increments on each successful research refresh';
comment on column public.company_research_cache.previous_fetched_at is
  'fetched_at of the prior live row (for UI age labels)';

create table if not exists public.company_research_snapshots (
  id uuid primary key default gen_random_uuid(),
  slug text not null references public.company_research_cache (slug) on delete cascade,
  research_version integer not null,
  fetched_at timestamptz not null,
  model text,
  payload jsonb not null default '{}'::jsonb,
  change_summary jsonb,
  created_at timestamptz not null default now(),
  unique (slug, research_version)
);

create index if not exists company_research_snapshots_slug_fetched_at_idx
  on public.company_research_snapshots (slug, fetched_at desc);

comment on table public.company_research_snapshots is
  'Append-only research card history (keep last N per slug in app logic)';

alter table public.company_research_snapshots enable row level security;

drop policy if exists company_research_snapshots_select_authenticated
  on public.company_research_snapshots;

create policy company_research_snapshots_select_authenticated
  on public.company_research_snapshots
  for select to authenticated
  using (true);
