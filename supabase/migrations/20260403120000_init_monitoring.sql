-- Verity Monitor — core tracking tables (service role writes; authenticated read)

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  ticker text,
  exchange text,
  tagline text,
  overview text,
  created_at timestamptz not null default now()
);

create table public.company_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  source_key text not null,
  label text not null,
  base_url text not null,
  last_run_at timestamptz,
  last_status text,
  created_at timestamptz not null default now(),
  unique (company_id, source_key)
);

create index company_sources_company_id_idx on public.company_sources (company_id);

create table public.tracked_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  company_source_id uuid references public.company_sources (id) on delete set null,
  canonical_url text not null,
  content_hash text,
  title text,
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz,
  unique (company_id, canonical_url)
);

create index tracked_documents_company_id_idx on public.tracked_documents (company_id);

create table public.fetch_logs (
  id uuid primary key default gen_random_uuid(),
  company_source_id uuid references public.company_sources (id) on delete cascade,
  requested_url text not null,
  ran_at timestamptz not null default now(),
  status text not null,
  http_status int,
  robots_allowed boolean,
  detail text,
  content_hash text
);

create index fetch_logs_company_source_id_idx on public.fetch_logs (company_source_id);

alter table public.companies enable row level security;
alter table public.company_sources enable row level security;
alter table public.tracked_documents enable row level security;
alter table public.fetch_logs enable row level security;

create policy companies_select_authenticated on public.companies
  for select to authenticated using (true);

create policy company_sources_select_authenticated on public.company_sources
  for select to authenticated using (true);

create policy tracked_documents_select_authenticated on public.tracked_documents
  for select to authenticated using (true);

create policy fetch_logs_select_authenticated on public.fetch_logs
  for select to authenticated using (true);
