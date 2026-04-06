-- Broader company universe: SEC registrant metadata + server-side search for the app.

alter table public.companies
  add column if not exists cik text unique,
  add column if not exists universe_source text not null default 'manual';

comment on column public.companies.cik is 'SEC Central Index Key (string digits), when sourced from SEC';
comment on column public.companies.universe_source is 'manual | sec | pilot_import — how the row was created';

create index if not exists companies_created_at_idx on public.companies (created_at desc);
create index if not exists companies_universe_source_idx on public.companies (universe_source);

-- Server-side search (avoids loading entire universe into the browser).
create or replace function public.search_companies(p_query text, p_limit integer default 50)
returns setof public.companies
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
  q text := trim(coalesce(p_query, ''));
begin
  if q = '' then
    return query
      select *
      from public.companies
      order by created_at desc nulls last
      limit lim;
    return;
  end if;

  return query
    select *
    from public.companies
    where
      position(lower(q) in lower(name)) > 0
      or position(lower(q) in lower(slug)) > 0
      or (ticker is not null and position(lower(q) in lower(ticker)) > 0)
      or (cik is not null and position(lower(q) in lower(cik)) > 0)
    order by
      case when ticker is not null and lower(ticker) = lower(q) then 0 else 1 end,
      char_length(name),
      name
    limit lim;
end;
$$;

comment on function public.search_companies(text, integer) is 'Authenticated company lookup for Search; empty query returns newest rows';

grant execute on function public.search_companies(text, integer) to authenticated;
