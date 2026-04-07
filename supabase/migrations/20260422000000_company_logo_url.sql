-- Optional per-company logo; when null, clients may derive a favicon from company_sources.base_url.

alter table public.companies
  add column if not exists logo_url text;

comment on column public.companies.logo_url is 'HTTPS URL for logo or favicon; may be derived from IR base_url (e.g. Google favicon service)';

-- Backfill from the first tracked source hostname (ordered by source_key) when possible.
update public.companies c
set logo_url = v.favicon
from (
  select distinct on (s.company_id)
    s.company_id,
    'https://www.google.com/s2/favicons?domain='
      || substring(s.base_url from '^https?://([^/:]+)')
      || '&sz=128' as favicon
  from public.company_sources s
  where s.base_url ~ '^https?://[^/]+'
    and substring(s.base_url from '^https?://([^/:]+)') is not null
    and length(trim(substring(s.base_url from '^https?://([^/:]+)'))) > 0
  order by s.company_id, s.source_key
) v
where c.id = v.company_id
  and c.logo_url is null;
