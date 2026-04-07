-- Split narrative columns and factual gaps for the company profile hero section.
-- narrative_type on saved_headlines lets the Saved screen bucket links by source.

alter table public.company_research_cache
  add column if not exists company_narrative text,
  add column if not exists media_narrative   text,
  add column if not exists factual_gaps      jsonb default '[]'::jsonb;

alter table public.saved_headlines
  add column if not exists narrative_type text default 'media'
    check (narrative_type in ('company', 'media'));
