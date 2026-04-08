# Verity iOS — App Store finish checklist

Print this page (or export to PDF from your editor’s Markdown preview). Items below are **your** steps with Apple, App Store Connect, and account credentials—nothing here runs automatically.

---

## 1. Apple accounts

- [ ] **Apple Developer Program** enrolled (paid membership).
- [ ] Know your **Apple ID** (email) used for Developer + App Store Connect.
- [ ] Know your **Team ID** (Apple Developer → Membership, or [developer.apple.com/account](https://developer.apple.com/account)).

---

## 2. App ID & bundle identifier

- [ ] In **Apple Developer → Identifiers**, App ID matches **`ios.bundleIdentifier`** in [`app.config.ts`](./app.config.ts) (e.g. `com.jessyabc.verity`).
- [ ] Same bundle ID used when you create the app in **App Store Connect**.

---

## 3. App Store Connect

- [ ] **New App** created (iOS), bundle ID selected, SKU set.
- [ ] Note **App Store Connect App ID** (numeric) for EAS Submit — see Expo docs if unsure where to find it.
- [ ] **Agreements, Tax, and Banking** completed if required for paid apps or IAP later.

---

## 4. EAS — credentials you must fill in

Edit [`eas.json`](./eas.json) under `submit.production.ios`:

- [ ] `appleId` — your Apple ID email  
- [ ] `ascAppId` — App Store Connect numeric app ID  
- [ ] `appleTeamId` — your Apple Developer Team ID  

Reference: [EAS Submit — iOS](https://docs.expo.dev/submit/ios/)

---

## 5. Build & submit (terminal, from `apps/mobile`)

```bash
cd apps/mobile
eas login
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

- [ ] First build: allow EAS to create/manage **distribution cert** and **App Store provisioning profile** when prompted (or configure in `eas credentials`).

---

## 6. TestFlight

- [ ] Build appears in App Store Connect → **TestFlight**.
- [ ] **Internal testing** (no review) or **External testing** (Beta App Review) as needed.
- [ ] Install via TestFlight on a real device and smoke-test auth, deep links, and core flows.

---

## 7. App Privacy & compliance

- [ ] **App Privacy** questionnaire in App Store Connect matches what the app collects (e.g. account/email via Supabase).
- [ ] **Export compliance** — you already set `ITSAppUsesNonExemptEncryption: false` in config; confirm it’s still accurate.
- [ ] **Age rating** questionnaire completed.

---

## 8. Store listing (required for App Store release)

- [ ] **Screenshots** for required device sizes.
- [ ] **Description**, **keywords**, **support URL**, **marketing URL** (if any).
- [ ] **Privacy Policy URL** (required for many apps).
- [ ] **App icon** 1024×1024 — see comments in [`app.config.ts`](./app.config.ts) (`assets/images/icon.png`).  
  *Note: Apple expects a fully opaque app icon; avoid transparency on the store icon.*

---

## 9. Supabase (production)

- [ ] **Auth → URL configuration**: redirect URLs include production magic-link / OAuth callbacks, e.g. **`verity://auth-callback`** (must match `scheme` in `app.config.ts` and your app code).
- [ ] Production **`EXPO_PUBLIC_*`** (and any secrets) set for EAS builds / production — never commit secrets to git.

---

## 10. Versioning

- [ ] **`version`** in `app.config.ts` updated for each **user-facing** release you want on the store.
- [ ] iOS **build number** — your production profile uses EAS **autoIncrement**; otherwise bump manually when Apple rejects a binary.

---

## Quick links

| Resource | URL |
|----------|-----|
| EAS Submit iOS | https://docs.expo.dev/submit/ios/ |
| EAS Build iOS | https://docs.expo.dev/build/setup/ |
| App Store Connect Help | https://developer.apple.com/help/app-store-connect/ |

---

*Generated for the Verity mobile app (`apps/mobile`). Update this file if your bundle ID, team, or flow changes.*
