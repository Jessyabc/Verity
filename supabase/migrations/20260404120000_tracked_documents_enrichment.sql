-- AI enrichment (Phase 4) — written by service-role scripts; authenticated read via existing RLS

alter table public.tracked_documents
  add column if not exists summary_text text,
  add column if not exists lenses_json jsonb not null default '[]'::jsonb,
  add column if not exists enrichment_status text,
  add column if not exists enrichment_detail text,
  add column if not exists enrichment_model text,
  add column if not exists enrichment_method text,
  add column if not exists enriched_at timestamptz,
  add column if not exists enrichment_input_hash text;

comment on column public.tracked_documents.enrichment_status is 'pending | ok | skipped | error';
comment on column public.tracked_documents.enrichment_method is 'pdf_responses | text_responses | image_vision | pdf_parse_fallback';
