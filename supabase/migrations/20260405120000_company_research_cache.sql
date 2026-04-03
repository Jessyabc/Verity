-- Cached Perplexity research / news per pilot slug (service role + Edge Function write; authenticated read)

create table public.company_research_cache (
  slug text primary key,
  company_name text not null,
  ticker text,
  items jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  error text,
  model text
);

create index company_research_cache_fetched_at_idx on public.company_research_cache (fetched_at desc);

comment on table public.company_research_cache is 'News/research snapshot from Perplexity; refreshed on schedule or manual/Edge invoke';

alter table public.company_research_cache enable row level security;

create policy company_research_cache_select_authenticated on public.company_research_cache
  for select to authenticated using (true);
