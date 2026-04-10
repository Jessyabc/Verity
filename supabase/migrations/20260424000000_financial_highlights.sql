-- Add financial_highlights to company_research_cache for the Key Financial Highlights card.
-- Stores structured per-quarter metrics: { period, period_end, metrics: [{label, value, yoy}] }

alter table public.company_research_cache
  add column if not exists financial_highlights jsonb default null;

comment on column public.company_research_cache.financial_highlights is
  'Structured key financial metrics from the most recent quarter, extracted by the financial highlights Perplexity call. Shape: { period: string, period_end: string|null, metrics: [{label, value, yoy}] }';
