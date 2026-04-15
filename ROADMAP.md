# Verity — iOS App Roadmap & Submission Checklist

Scope: iOS App Store launch and post-launch hardening.
Website is out of scope until the app ships.

Legend:
- [x] Done — code is merged and working
- [ ] Pending code — needs implementation
- [A] Action required — your manual step (no code needed)
- [!] Blocker — nothing after this can ship without it

---

## Phase 1 — Dashboard UX  [COMPLETE]

### [x] Time-aware greeting in the watchlist header
File: `apps/mobile/app/(tabs)/index.tsx`
Renders "Good morning, Alex" (or plain "Good morning") under the Watchlist title.
Derives first name from email local-part; falls back gracefully for UUIDs.

### [x] Auto-loaded portfolio digest
Files: `apps/mobile/hooks/useWatchlistDigest.ts`, `apps/mobile/lib/watchlistDigest.ts`
On mount, fetches the last cached digest row from `watchlist_digest` — no button press required.
Silently regenerates in the background if stale (>6h or watchlist changed).
Polls every 8 seconds while `is_generating` is true.
Re-checks every 30 minutes and on every app foreground event.

### [x] Manual refresh button on digest card
Added `refresh()` to `useWatchlistDigest` hook.
Tapping Refresh fires `generate-watchlist-digest` edge function (Perplexity, persists to DB),
optimistically marks card as "Updating…", and starts polling immediately.

---

## Phase 2 — Monetization  [CODE COMPLETE — EXTERNAL SETUP REQUIRED]

14-day free trial. Full paywall on expiry (Option A — everything locked).
$15.00 CAD / month   or   $150.00 CAD / year   (save $30/yr).
No existing users — no grandfathering needed.

### [x] RevenueCat purchase utilities
File: `apps/mobile/lib/purchases.ts`
Initialises RevenueCat SDK with the user's Supabase UUID as the App User ID.
Exposes: `initPurchases`, `getEntitlementStatus`, `getOfferings`, `purchasePackage`, `restorePurchases`.
Entitlement ID: `premium`
Product IDs: `com.jessyabc.verity.premium_monthly` / `com.jessyabc.verity.premium_annual`
Owner email bypass: if `EXPO_PUBLIC_OWNER_EMAIL` matches signed-in email → always `active`.
Safe defaults: returns `unknown` (allows through) when RC not configured or network fails.

### [x] Entitlement context
File: `apps/mobile/contexts/EntitlementContext.tsx`
Provides `{ status, loading, refresh }` app-wide.
Statuses: `active` | `inactive` | `unknown`
Re-checks on foreground. Initialises RC on first authenticated load.

### [x] Entitlement gate hook
File: `apps/mobile/hooks/useEntitlementGate.ts`
Runs after auth gate. Redirects to `/paywall` when `status === 'inactive'`.
Safe: skips if already on paywall, auth-callback, or auth screens.

### [x] Paywall screen
File: `apps/mobile/app/paywall.tsx`
Full-screen modal, not dismissible (gestureEnabled: false).
Shows: value props, monthly/annual plan cards, "Start 14-day free trial" CTA,
"Restore purchases" link, Privacy Policy link, Terms of Use link,
auto-renewal disclosure. Apple review requirements fully met.
Annual card has "Save $30/yr" badge. Annual is pre-selected by default.

### [x] Wired into navigation
File: `apps/mobile/app/_layout.tsx`
`EntitlementProvider` wraps the app (inside `AuthProvider`).
`useEntitlementGate()` called in `AuthAwareStack` alongside `useProtectedSession()`.
Paywall registered as `fullScreenModal` Stack.Screen.

### [x] package.json dependency
`react-native-purchases: ^8.2.2` added.
IMPORTANT: This is a native module. Requires a dev build to test.
Cannot run in Expo Go. Run: `eas build --platform ios --profile development`

### [x] app.config.ts plugin
`'react-native-purchases'` added to plugins array.

---

### [A] REQUIRED — RevenueCat account setup
URL: https://app.revenuecat.com

1. Create a new Project → iOS App
   - Bundle ID: com.jessyabc.verity
2. Under Entitlements → Create entitlement
   - Identifier: premium
3. Under Products → Add products
   - Monthly: com.jessyabc.verity.premium_monthly
   - Annual:  com.jessyabc.verity.premium_annual
   (These must exist in App Store Connect first — see below)
4. Under Offerings → Default offering → Add packages
   - Add monthly package → link to monthly product
   - Add annual package → link to annual product
5. Copy the Public SDK Key (starts with appl_)
6. Add to EAS secrets: EXPO_PUBLIC_REVENUECAT_API_KEY = appl_xxxx
7. Add to local .env.local: EXPO_PUBLIC_REVENUECAT_API_KEY=appl_xxxx

### [A] REQUIRED — Owner / developer account
1. In RevenueCat dashboard → Customers → search your Supabase user UUID
2. Grant Entitlement → select "premium" → Duration: Lifetime
   This gives you the real subscriber experience for testing.
3. Also set EXPO_PUBLIC_OWNER_EMAIL=your@email.com in EAS secrets and .env.local
   This is the code-level safety net (bypasses RC entirely if RC is unreachable).

### [A] REQUIRED — App Store Connect subscription products
URL: https://appstoreconnect.apple.com → Your App → Subscriptions

1. Create Subscription Group
   - Name: Verity Premium
   - Reference Name: verity_premium
2. Add Monthly product
   - Product ID: com.jessyabc.verity.premium_monthly
   - Duration: 1 Month
   - Price: $15.00 CAD (Tier 15 CAD)
   - Introductory Offer: Free Trial, 14 Days
   - Localisation: add English (Canada) display name + description
3. Add Annual product
   - Product ID: com.jessyabc.verity.premium_annual
   - Duration: 1 Year
   - Price: $150.00 CAD (Tier 150 CAD)
   - Introductory Offer: Free Trial, 14 Days
   - Localisation: add English (Canada) display name + description
4. Submit both products for review (Apple reviews subscription products separately)

---

## Phase 3 — App Store Submission  [ACTION REQUIRED]

Everything in this phase is manual — no code changes needed.

### [A] [!] Apple Developer Program
- Confirm paid membership is active at developer.apple.com/account
- Note your Team ID (shown on Membership page)
- Confirm the Apple ID email you use for App Store Connect

### [A] [!] App ID & Bundle Identifier
- In Apple Developer → Identifiers → App IDs
- Confirm App ID exists for: com.jessyabc.verity
- If missing, create it. Enable: In-App Purchase capability
- This must match `ios.bundleIdentifier` in app.config.ts (it does: com.jessyabc.verity)

### [A] [!] App Store Connect — App Record
- Confirm the app record exists at appstoreconnect.apple.com
- If missing: New App → iOS → Bundle ID: com.jessyabc.verity → set SKU
- Note the numeric App Store Connect App ID (shown in App Information)

### [A] [!] EAS credentials — fill in eas.json
File: `apps/mobile/eas.json`
Under `submit.production.ios`:
- appleId:    your Apple ID email (e.g. you@icloud.com)
- ascAppId:   numeric App Store Connect App ID (e.g. 1234567890)
- appleTeamId: your Team ID from developer.apple.com/account (e.g. ABCDE12345)

### [A] [!] Supabase — production redirect URL
Dashboard → Authentication → URL Configuration → Redirect URLs
Add: verity://auth-callback
This must be present or magic link sign-in fails on real devices.

### [A] [!] EAS secrets — production environment variables
In EAS dashboard (expo.dev) → Project → Secrets → Add for production profile:
- EXPO_PUBLIC_SUPABASE_URL
- EXPO_PUBLIC_SUPABASE_ANON_KEY
- EXPO_PUBLIC_REVENUECAT_API_KEY
- EXPO_PUBLIC_OWNER_EMAIL
Never put these in committed files.

### [A] App icon — verify opacity
File: `apps/mobile/assets/images/icon.png`
Must be 1024×1024 px with NO transparency (solid background only).
Apple rejects transparent App Store icons at review time.
Check in Preview / Photoshop that there is no alpha channel.

### [A] Screenshots — required sizes
Upload to App Store Connect → App Store → iOS App → Screenshots.
Required device:
- 6.9" (iPhone 16 Pro Max) — mandatory as of 2024
Also upload for:
- 6.5" (iPhone 14 Plus / 15 Plus) — recommended
- 12.9" iPad Pro — required if supportsTablet: true (it is true in app.config.ts)
Minimum 3 screenshots per device size. Maximum 10.
Tools: simulator screenshot, Rottenwood, Previewed, AppLaunchpad.

### [A] Store listing copy
In App Store Connect → App Store → iOS App:
- Name: Verity (max 30 chars)
- Subtitle: Monitor company disclosures (max 30 chars, optional)
- Description: write your store description (max 4000 chars)
- Keywords: up to 100 chars, comma-separated, no spaces after commas
  Suggested: investor,filings,SEC,IR,research,earnings,watchlist,disclosure
- Support URL: must be a live URL (e.g. https://verity.so/support or mailto:)
- Marketing URL: optional (e.g. https://verity.so)
- Privacy Policy URL: required — https://verity.so/privacy (must be live before submission)

### [A] Privacy Policy & Terms of Use — live URLs required
Both https://verity.so/privacy and https://verity.so/terms are referenced in:
- The sign-in screen
- The paywall screen
These must resolve to real pages before App Store review.
Minimum privacy policy must disclose: email collection via Supabase Auth.
If you don't have a site yet: publish a simple static page or use a hosted
privacy policy generator (iubenda, Termly, etc.).

### [A] Age rating questionnaire
App Store Connect → Your App → App Information → Age Rating → Edit
Answer these honestly for Verity:
- Unrestricted Web Access: YES (opens IR pages, SEC filings, external URLs)
  → This will result in 17+ rating. This is normal and expected for finance apps.
- Infrequent/Mild Mature Themes: NO
- All other violence/content categories: NO
Expected result: 17+ — appears normally in the App Store.

### [A] Export compliance
In App Store Connect → Your App → Compliance:
- Uses Non-Exempt Encryption: NO
This matches `ITSAppUsesNonExemptEncryption: false` already set in app.config.ts.

### [A] App Privacy questionnaire (Data Collection)
App Store Connect → Your App → App Privacy → Get Started
Verity collects:
- Email Address (via Supabase Auth) → Used for authentication, linked to user
- User ID (Supabase UUID) → Used for watchlist, digest, chat history, linked to user
- Purchase History (via RevenueCat / App Store) → handled automatically by Apple
Do NOT declare: location, contacts, photos, health, financial data beyond subscriptions.

### [A] Agreements, Tax, and Banking
App Store Connect → Agreements, Tax, and Banking
Required for paid apps and in-app purchases.
Complete the Paid Applications agreement before submitting a build with IAP.
Banking details are required to receive subscription revenue.

### [A] TestFlight — smoke test before submission
1. Run `eas build --platform ios --profile production` from apps/mobile
2. Run `eas submit --platform ios --profile production`
3. Wait for build to process in App Store Connect (~10-30 min)
4. Add yourself as Internal Tester in TestFlight
5. Install on a real iPhone (not simulator)
6. Test these flows:
   - Sign up with email → receive magic link → tap link → opens app → signed in
   - Watchlist: add a company, see it in the list
   - Digest card: shows greeting and summary
   - Paywall: appears on fresh account, shows both plan cards
   - Purchase: use Sandbox Apple ID to test purchase flow end to end
   - Restore: sign out, sign in, verify entitlement restored
   - Sign out and sign back in

### [A] Sandbox Apple ID for purchase testing
In App Store Connect → Users and Access → Sandbox Testers → Add sandbox tester
Use this fake Apple ID to test purchases without real charges in TestFlight.
Sandbox users get the 14-day trial compressed to a few minutes for testing.

---

## Phase 4 — Production Hardening  [PENDING CODE]

Do this before a public launch. Not blocking for a private beta.

### [ ] SecureStore — replace AsyncStorage for session tokens
File: `apps/mobile/lib/supabase.ts`
Install: `expo-secure-store`
Replace `AsyncStorage` with a SecureStore adapter in the `getAuthStorage()` native branch.
Requires a dev build (not Expo Go).
Existing users will be signed out on first upgrade — acceptable, note in release notes.
Priority: HIGH — financial research app, session tokens must be encrypted at rest.

### [ ] Rate limiting on edge functions
Files: `supabase/functions/_shared/rateLimit.ts` (new), new migration
New `user_invocations` table with composite key (user_id, function_name, window_start).
Call `checkRateLimit()` at the top of each edge function handler, return HTTP 429 if exceeded.
Limits to implement:
- research-company:          5 calls / 1 hour
- generate-watchlist-digest: 3 calls / 1 hour
- watchlist-brief:           5 calls / 10 min
- afaqi-chat:               10 calls / 1 min
- afaqi-tts:                20 calls / 1 min

### [ ] Data retention — prune fetch_logs and research cache
New migration with pg_cron jobs:
- Prune fetch_logs older than 90 days (weekly Sunday 03:00 UTC)
- Prune company_research_cache older than 30 days where slug not in any watchlist
Requires: enable pg_cron extension in Supabase Dashboard → Database → Extensions (Pro plan).

### [ ] GDPR account deletion flow
New: `supabase/functions/delete-account/index.ts`
Calls `supabase.auth.admin.deleteUser(userId)` → cascades all user-owned rows.
Modify: `apps/mobile/app/profile.tsx` — add two-step "Delete my account" confirmation.

### [ ] Database indexes + query timeouts
New migration:
- `fetch_logs(ran_at DESC)`
- `tracked_documents(company_id, last_checked_at DESC NULLS LAST)`
- `conversations(user_id, last_message_at DESC)`
- `authenticated` role: `statement_timeout = '8s'`
- `service_role`:       `statement_timeout = '30s'`

---

## Phase 5 — Operational Maturity  [PENDING]

Do this after first paying users. Not blocking for launch.

### [ ] Structured logging in edge functions
New: `supabase/functions/_shared/logger.ts`
JSON stdout logger: `log({ level, fn, userId, msg, ...extras })`
Replace bare console.error calls in all edge functions.
Enables: Logflare query UI + webhook alerts on level:error entries.

### [A] Logflare webhook alert
No code needed. In Supabase Dashboard → Edge Functions → Logs (Logflare):
Create an alert on `level:error` → webhook to Slack/email.
Notifies you when monitoring cron fails or edge functions crash.

### [ ] Test scaffolding — Vitest (web) + Jest (mobile)
Root package.json: add vitest, add test script.
vite.config.ts: add test block with jsdom environment.
apps/mobile/package.json: add test script using Expo's jest config.
First tests to write (highest value):
1. `apps/mobile/lib/purchases.ts` — isOwnerAccount(), getEntitlementStatus() with mocked RC
2. `apps/mobile/hooks/useWatchlistDigest.ts` — isDigestStale() edge cases
3. `apps/mobile/lib/format.ts` — getGreeting(), formatAgo()
4. `supabase/functions/watchlist-brief/` — prompt-building with mocked OpenAI

### [A] GitHub Actions failure alerts
Files: `.github/workflows/monitor-schedule.yml`, `.github/workflows/research-weekdays.yml`
Add `if: failure()` step using slackapi/slack-github-action or email action.
Add SLACK_WEBHOOK_URL to GitHub repository secrets.
Notifies you when the 6-hourly monitoring cron or weekday research job fails silently.

### [ ] CI test step
File: `.github/workflows/ci.yml`
Add `npm run test` step after lint, before build.
Prevents broken test suite from shipping to production.

---

## Versioning Reference

Current version: 1.0.0 (set in apps/mobile/app.config.ts)
Build number: auto-incremented by EAS on each production build (autoIncrement: true in eas.json)

Before each App Store submission:
- Bump `version` in app.config.ts for user-facing changes (e.g. 1.0.0 → 1.1.0)
- Build number increments automatically — no manual change needed

---

## Quick-Reference Commands

All commands run from `apps/mobile/`

```bash
# Authenticate EAS CLI
eas login

# Development build (required for RevenueCat, SecureStore)
eas build --platform ios --profile development

# Production build
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios --profile production

# Check build status
eas build:list --platform ios
```

---

## Key File Index

| File | Purpose |
|---|---|
| `apps/mobile/app.config.ts` | Bundle ID, scheme, plugins, EAS project ID |
| `apps/mobile/eas.json` | Build profiles, Apple credentials (fill in!) |
| `apps/mobile/.env.example` | All env var keys with documentation |
| `apps/mobile/lib/purchases.ts` | RevenueCat SDK wrapper |
| `apps/mobile/contexts/EntitlementContext.tsx` | Subscription status provider |
| `apps/mobile/hooks/useEntitlementGate.ts` | Paywall redirect logic |
| `apps/mobile/app/paywall.tsx` | Paywall screen |
| `apps/mobile/lib/supabase.ts` | Supabase client (needs SecureStore upgrade) |
| `supabase/functions/` | Edge functions (research, digest, chat, TTS) |
| `.github/workflows/` | Monitoring cron, research cron, CI |

---

## What You Need Before First TestFlight Build

1. RevenueCat account + SDK key → EXPO_PUBLIC_REVENUECAT_API_KEY in EAS secrets
2. App Store Connect subscription products created (both product IDs)
3. eas.json filled in (appleId, ascAppId, appleTeamId)
4. Supabase redirect URL added (verity://auth-callback)
5. All EAS production secrets set
6. Paid Applications agreement signed in App Store Connect
7. Privacy Policy live at https://verity.so/privacy
