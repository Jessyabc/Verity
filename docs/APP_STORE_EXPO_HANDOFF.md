# App Store, Expo & TestFlight — release + implementation handoff

Use this doc when continuing work in a **new chat session**. It summarizes product context, repo state, and a concrete path to an **Expo iOS app** on **TestFlight**, while **keeping the existing Vite web app** in the same repository.

---

## Product & stack (snapshot)

- **Name / repo:** Verity Monitor — GitHub `Jessyabc/Verity` (local folder may be `Verity or else`).
- **Web app:** Vite + React 19 + TypeScript + Tailwind v4 + React Router v7. Entry: `npm run dev` / `npm run build`.
- **Backend:** Supabase (Postgres, Auth, RLS, Edge Functions). Migrations live in `supabase/migrations/`.
- **Edge Functions (deploy separately):** `research-company` (Perplexity, session required), `admin-upsert-company` (admin email gate). Shared helpers: `supabase/functions/_shared/`.
- **Scripts (Node, `.env.local`):** `monitor:once`, `enrich:once`, `research:*`, `import:sec-tickers`. See root `BUILD.md` and `.env.example`.
- **Intentionally later:** GitHub Actions secrets / schedules (monitor, research cron, enrich) — user prefers after App Store focus.
- **AI keys:** Stay **server-side** (Edge Functions / scripts). Do **not** ship `OPENAI_API_KEY` or `PERPLEXITY_API_KEY` in the Expo client for general use.

---

## What “done” looks like for v1 mobile

1. **Expo app** in-repo (recommended: monorepo with `apps/mobile` and optional later `apps/web` move).
2. **Supabase Auth** on device with **persistent session** (AsyncStorage or SecureStore pattern per Supabase RN docs).
3. **Deep linking** configured so **magic links / OAuth** return to the app (URL scheme + later Universal Links if needed).
4. **Same API surface as web:** `supabase.from(...).select`, `rpc('search_companies', ...)`, `functions.invoke('research-company', { headers: { Authorization: Bearer session } })` — no secrets in the bundle beyond **anon/publishable** key + **Supabase URL** (both are normal for client apps with RLS).
5. **EAS Build** producing an **iOS binary** uploaded to **App Store Connect** → **TestFlight** internal testing, then external when ready.
6. **App Store listing** basics: privacy policy URL, app description, screenshots, export compliance, sign-in explanation if using account-based features.

---

## Apple & App Store Connect (your side)

You already have **Apple Developer Program**. Typical checklist:

| Step | Notes |
|------|--------|
| **App ID** | Create in Certificates, Identifiers & Profiles; enable capabilities you need (Sign in with Apple if you use it; Push only if you add notifications later). |
| **Bundle identifier** | Stable reverse-DNS, e.g. `com.yourorg.verity` — must match Expo `ios.bundleIdentifier`. |
| **Distribution certificate + provisioning** | EAS can manage this (`eas credentials`) or you upload manually. |
| **App Store Connect** | New app record, same bundle ID, primary language, SKU. |
| **Privacy** | App Privacy questionnaire; link to a **hosted privacy policy** (can be a simple GitHub Pages / Notion / your domain later). |
| **TestFlight** | First build processing can take time; internal testers don’t need review; external needs Beta App Review for first build. |

Keep **Expo’s `app.json` / `app.config.js`** bundle ID and Apple team ID aligned with what you create in Apple’s portal.

---

## Expo & EAS (implementation side)

### Recommended repo layout (next session)

```
apps/
  mobile/          # Expo (create with create-expo-app or expo prebuild path)
packages/
  shared/          # optional: shared types, pure utils, Zod schemas (no React DOM)
```

Root `package.json` **workspaces** (`npm`/`pnpm`) so `mobile` can depend on `shared`. The existing Vite app can stay at repo root **initially** to reduce churn, then move to `apps/web` when convenient.

### Packages to plan for

- **`expo`**, **`expo-router`** (optional but common) or React Navigation.
- **`@supabase/supabase-js`** with **`@react-native-async-storage/async-storage`** (or secure storage where appropriate) for auth session persistence — follow current Supabase React Native guide.
- **`expo-constants`** / **`app.config` extra** for `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (never service role in the app).

### EAS

- Install EAS CLI: `npm i -g eas-cli`.
- `eas login`, `eas build:configure`, then `eas build --platform ios`.
- First iOS build usually uses **cloud** builders; Apple credentials prompted or connected via App Store Connect API key (EAS docs).

### Supabase dashboard (mobile auth)

- Add **redirect URLs** for your app: e.g. `verity://auth-callback` (match Expo scheme) and any `exp://` dev URLs if needed.
- Ensure **Site URL** / redirect allowlist matches what the Expo auth client uses.

---

## Web app (kept, not the current focus)

- Remains buildable from current root (`npm run build`).
- **Vercel / public hosting** can wait; local or ad-hoc preview is enough until “internet” phase.
- **Admin inventory** and **VITE_ADMIN_EMAIL** remain web-oriented unless you replicate admin flows in mobile later.

---

## Verification commands (any session)

```bash
npm run lint && npm run build
```

Supabase functions (from repo root, CLI linked):

```bash
supabase functions deploy research-company
supabase functions deploy admin-upsert-company
```

---

## Master prompt for the next session (copy everything below the line)

---

**MASTER PROMPT — paste into a new Cursor chat**

You are working in the **Verity** repo (`Jessyabc/Verity`): a **Vite + React** web app at the repo root, **Supabase** backend, Edge Functions under `supabase/functions/` (`research-company`, `admin-upsert-company`), migrations under `supabase/migrations/`. Read **`docs/APP_STORE_EXPO_HANDOFF.md`** and **`BUILD.md`** for full context.

**Goal:** Add an **Expo** iOS app suitable for **TestFlight**, in a **monorepo-friendly** layout (e.g. `apps/mobile`), with **npm/pnpm workspaces**. The user **keeps the web app** but wants to **focus on mobile first**; **GitHub Actions** can wait.

**Requirements:**

1. Scaffold **Expo** (TypeScript) under `apps/mobile` (or agreed path); wire **root workspaces** without breaking existing `npm run dev` / `npm run build` at repo root.
2. Integrate **Supabase** client for React Native with **session persistence** and **env** via `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (document in `.env.example` or `apps/mobile/.env.example`).
3. Implement a **minimal first screen flow**: sign-in (email magic link or as per Supabase + Expo best practice), then a **simple home** that proves auth (e.g. show user email) and optionally calls **`search_companies`** or lists a placeholder “watchlist” screen — keep UI small but real.
4. Add **`app.json` / `app.config`** notes for **iOS bundle identifier** placeholder the user can replace; mention **EAS** (`eas.json`) and **deep link scheme** for auth callbacks.
5. Do **not** put **service role**, **OpenAI**, or **Perplexity** keys in the mobile app; server-side stays in Edge Functions / scripts.
6. Match existing code style; run **lint/build** for the web app after changes; add mobile lint if standard for the template.

**Out of scope for this task:** Vercel deploy, GitHub Actions secrets, full feature parity with web, App Store screenshots.

Start by summarizing the plan, then implement step by step.

---

_End of master prompt_
