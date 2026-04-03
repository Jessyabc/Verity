# Supabase

1. Create a project (separate from other products, per product strategy).
2. Paste SQL from [`migrations/`](migrations/) into **SQL Editor** in order, or use the Supabase CLI: `supabase db push` (with CLI linked to this project).
3. Add `VITE_*` keys to the web app and **service role** only in `.env` / `.env.local` for `npm run monitor:once`, `npm run enrich:once`, and `npm run research:watchlist` (never expose service role in the browser). Enrichment needs `OPENAI_API_KEY`; company research needs `PERPLEXITY_API_KEY` (see `.env.example`).
4. Deploy Edge Function `research-company` for in-app **Refresh** (`supabase functions deploy research-company`; set `PERPLEXITY_API_KEY` + service role in function secrets).
