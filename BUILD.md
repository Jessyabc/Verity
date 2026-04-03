# Verity Monitor — implementation status

**Plan reference:** `.cursor/plans/company_monitor_v1_brief_2264b68e.plan.md`

**Product framing:** [`docs/PRODUCT.md`](docs/PRODUCT.md)

## Persistence

- **Pilot data (bundled):** [`src/data/pilot-universe.ts`](src/data/pilot-universe.ts)
- **Watchlist:** [`WatchlistProvider`](src/contexts/WatchlistProvider.tsx) — `localStorage` per user id
- **Read / unread (updates):** [`ReadUpdatesProvider`](src/contexts/ReadUpdatesProvider.tsx) — `localStorage` per user id
- **Supabase (optional):** Auth + future sync; apply [`supabase/migrations`](supabase/migrations/) for `companies`, `company_sources`, `tracked_documents`, `fetch_logs`

## Phase 0 — Product framing

- [x] Locked stack: Vite, React 19, TypeScript, Tailwind v4, React Router v7
- [x] ICP + disclaimers + positioning: [`docs/PRODUCT.md`](docs/PRODUCT.md)
- [x] Pilot company list: **10** issuers in [`pilot-universe.ts`](src/data/pilot-universe.ts)

## Phase 1 — Core foundations

- [x] Repo scaffold + `npm run build` / `npm run dev`
- [x] Global design system, app shell, routes, mock + Supabase auth path
- [x] Env pattern: [`.env.example`](.env.example)
- [x] CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
- [x] Deploy: [`vercel.json`](vercel.json), [`public/_redirects`](public/_redirects)

## Phase 2 — Source discovery + profiles (local + DB schema)

- [x] Search, company profile, coverage transparency UI
- [x] Watchlist + read/unread for pilot update ids
- [x] Supabase schema for companies/sources/documents/logs: [`supabase/migrations`](supabase/migrations/)
- [x] Wire UI to read `tracked_documents` / company sources when `VITE_SUPABASE_*` present (company profile, dashboard, update detail for UUID ids)

## Phase 3 — Monitoring + change detection

- [x] URL normalization + SHA-256 helpers: [`src/lib/monitoring`](src/lib/monitoring/)
- [x] One-shot worker: `npm run monitor:once` — [`scripts/monitor-once.ts`](scripts/monitor-once.ts) + [`scripts/pilot-urls.json`](scripts/pilot-urls.json) (robots gate → GET → hash → upsert)
- [x] Scheduled GitHub Action: [`.github/workflows/monitor-schedule.yml`](.github/workflows/monitor-schedule.yml) — set secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (same values as local `.env` for scripts)

## Phase 4 — Document enrichment (OpenAI)

- [x] Migration: `summary_text`, `lenses_json`, `enrichment_*` columns on `tracked_documents`
- [x] Script: `npm run enrich:once` — [`scripts/enrich-documents-once.ts`](scripts/enrich-documents-once.ts)
  - **PDF:** OpenAI **Responses API** + uploaded file (`user_data`) — native PDF understanding (replaces a separate LlamaParse step).
  - **Fallback:** `pdf-parse` extracts text → `OPENAI_TEXT_MODEL` if the PDF path fails.
  - **HTML:** strip tags → text model.
  - **Images** (png/jpeg/webp/gif): same document model with `input_image` (GPT vision).
- [x] UI: live document detail + dashboard / company cards show summary when present
- [ ] Email notifications (later)

**Env:** copy [`.env.example`](.env.example) → `.env.local` and set `OPENAI_*` plus Supabase service role. Scripts load `.env.local` then `.env` (see [`scripts/load-env.ts`](scripts/load-env.ts)). Optional: `PERPLEXITY_API_KEY` (server-side only — not `VITE_*`) for company research (below).

**Optional GitHub Action:** run enrichment on demand — [`.github/workflows/enrich-once.yml`](.github/workflows/enrich-once.yml) (add `OPENAI_API_KEY` to repo secrets).

## Phase 5 — Company research & news (Perplexity)

- [x] Migration [`company_research_cache`](supabase/migrations/20260405120000_company_research_cache.sql) — cached JSON items + `fetched_at`
- [x] Scripts: `npm run research:company -- <slug>` · `npm run research:watchlist` (`WATCHLIST_SLUGS`, `WATCHLIST_FROM_DB=true` + `user_watchlist`, or `ALL_PILOT=1`)
- [x] Edge Function [`supabase/functions/research-company`](supabase/functions/research-company/index.ts) — browser **Refresh** calls Perplexity with the key on the server (deploy + set secrets)
- [x] UI: **Company profile** (research card), **Dashboard** (refresh watchlist), **Settings** (weekend preference note)
- [x] CI: [weekdays](.github/workflows/research-weekdays.yml) Mon–Fri `08:00 UTC` · [weekends](.github/workflows/research-weekends.yml) optional (uncomment schedule + run manually)

**Deploy Edge Function:** `supabase functions deploy research-company` and set secrets `PERPLEXITY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Edge Functions → Secrets).

**GitHub:** add `PERPLEXITY_API_KEY`. Workflows set `WATCHLIST_FROM_DB=true` so research uses distinct slugs from `user_watchlist` (synced from the app). Optional secret `WATCHLIST_SLUGS` is a fallback when no rows exist yet. Adjust weekday cron UTC to match your “~8am” locally.

## Commands

```bash
cp .env.example .env.local   # add VITE_* and optional service role for scripts
npm run dev
npm run build
npm run monitor:once        # needs SUPABASE_SERVICE_ROLE_KEY + migration applied
npm run enrich:once         # needs OPENAI_API_KEY + enrichment migration applied
npm run research:watchlist  # PERPLEXITY_API_KEY + WATCHLIST_FROM_DB or WATCHLIST_SLUGS + research cache migration
npm run research:company -- microsoft
```

## Deploy

See Phase 1; set `VITE_SUPABASE_*` in the host’s env for production auth.

**Scheduled monitoring:** In the GitHub repo → **Settings → Secrets and variables → Actions**, add `SUPABASE_URL` (project API URL, same as `VITE_SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY`. The workflow [`monitor-schedule.yml`](.github/workflows/monitor-schedule.yml) runs every six hours and on demand (**Actions → Monitor once → Run workflow**).

## Next steps

1. Apply [`supabase/migrations`](supabase/migrations/) to your Verity Supabase project (monitoring, enrichment, and `company_research_cache`).
2. Copy `.env.example` → `.env.local`, add Supabase + `OPENAI_API_KEY`, then run `npm run monitor:once` and `npm run enrich:once`.
3. Deploy [`research-company`](supabase/functions/research-company/index.ts) Edge Function; add `PERPLEXITY_API_KEY` to GitHub; apply `user_watchlist` migration so app + `WATCHLIST_FROM_DB` jobs see watchlist rows; enable [`research-weekdays.yml`](.github/workflows/research-weekdays.yml).
4. Optional: schedule [`monitor-schedule.yml`](.github/workflows/monitor-schedule.yml) and [`enrich-once.yml`](.github/workflows/enrich-once.yml) with matching secrets.
