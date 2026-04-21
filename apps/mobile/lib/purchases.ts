/**
 * RevenueCat purchase utilities.
 *
 * Drop-in ready — wire EXPO_PUBLIC_REVENUECAT_API_KEY into EAS / .env.local
 * and every function here becomes live.  Until the key is present all calls
 * return safe defaults so the app builds and runs without crashing.
 *
 * Setup checklist (one-time):
 *  1. app.revenuecat.com → new project → connect iOS app (bundle ID: com.jessyabc.verity)
 *  2. Create entitlement ID: "verity_pro"
 *  3. Create products in App Store Connect (IDs below) with 14-day free trial
 *  4. Link those products to RevenueCat packages inside the "default" offering
 *  5. Copy the Public SDK Key → EXPO_PUBLIC_REVENUECAT_API_KEY in EAS secrets
 *  6. Set EXPO_PUBLIC_OWNER_EMAIL to your own email → lifetime access in dev
 *     (also grant yourself a Promotional Entitlement in RevenueCat dashboard)
 */

import { Platform } from 'react-native'
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases'

type PurchasesModule = typeof import('react-native-purchases')
type PurchasesUIModule = typeof import('react-native-purchases-ui')

async function loadPurchases(): Promise<PurchasesModule> {
  return await import('react-native-purchases')
}

async function loadPurchasesUI(): Promise<PurchasesUIModule> {
  return await import('react-native-purchases-ui')
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** RevenueCat entitlement ID — must match what you create in the RC dashboard */
export const ENTITLEMENT_ID = 'verity_pro'

/**
 * Product identifiers — must match EXACTLY what you create in App Store Connect.
 * Subscriptions → Verity Premium group → these two product IDs.
 */
export const PRODUCT_MONTHLY_ID  = 'com.jessyabc.verity.premium_monthly'
export const PRODUCT_ANNUAL_ID   = 'com.jessyabc.verity.premium_annual'

/** Display prices shown in the UI (CAD). Hardcoded to avoid RC dependency for display. */
export const PRICE_MONTHLY_CAD   = '$15.00'
export const PRICE_ANNUAL_CAD    = '$150.00'
export const ANNUAL_SAVINGS_CAD  = '$30'
export const TRIAL_DAYS          = 14

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * `active`   — valid subscription or owner bypass → full app access
 * `inactive` — no active entitlement (new user or expired) → show paywall
 * `unknown`  — RC not configured, network error, or still loading → allow through
 */
export type EntitlementStatus = 'active' | 'inactive' | 'unknown'

// ─── Internal helpers ─────────────────────────────────────────────────────────

const RC_API_KEY   = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? ''
const OWNER_EMAIL  = process.env.EXPO_PUBLIC_OWNER_EMAIL ?? ''

function isConfigured(): boolean {
  return Boolean(RC_API_KEY) && Platform.OS !== 'web'
}

// ─── SDK initialisation ───────────────────────────────────────────────────────

/**
 * Call once after the authenticated Supabase user is known.
 * Uses the Supabase UUID as the RevenueCat App User ID so entitlements
 * survive reinstalls and follow the user across devices.
 */
export function initPurchases(userId: string): void {
  if (!isConfigured()) return
  try {
    // Fire-and-forget; keep caller sync for convenience.
    // Lazy import prevents launch-time TurboModule crashes if RevenueCat is misconfigured.
    void (async () => {
      const mod = await loadPurchases()
      const Purchases = mod.default
      Purchases.setLogLevel(__DEV__ ? mod.LOG_LEVEL.DEBUG : mod.LOG_LEVEL.ERROR)
      Purchases.configure({ apiKey: RC_API_KEY, appUserID: userId })
    })()
  } catch {
    // Non-fatal: SDK may already be configured from a previous call
  }
}

// ─── Owner bypass ─────────────────────────────────────────────────────────────

/**
 * Returns true when the signed-in email matches EXPO_PUBLIC_OWNER_EMAIL.
 * Grants unconditional active status so the developer always has full access
 * without consuming a real subscription or going through StoreKit.
 *
 * For the "real dogfood" path, also grant yourself a Promotional Entitlement
 * in the RevenueCat dashboard — that goes through the identical code path
 * as a paying subscriber and is the recommended primary method.
 */
export function isOwnerAccount(email: string | null | undefined): boolean {
  return Boolean(
    OWNER_EMAIL &&
    email &&
    email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim(),
  )
}

// ─── Entitlement check ────────────────────────────────────────────────────────

/**
 * Returns the current entitlement status for the signed-in user.
 * Owner email always returns 'active'.
 * RC not configured returns 'unknown' (safe — does not block the app).
 */
export async function getEntitlementStatus(
  email?: string | null,
): Promise<EntitlementStatus> {
  if (isOwnerAccount(email)) return 'active'
  if (!isConfigured()) return 'unknown'
  try {
    const mod = await loadPurchases()
    const Purchases = mod.default
    const info: CustomerInfo = await Purchases.getCustomerInfo()
    return info.entitlements.active[ENTITLEMENT_ID] ? 'active' : 'inactive'
  } catch {
    return 'unknown'
  }
}

// ─── Offerings ────────────────────────────────────────────────────────────────

/** Fetches the current RevenueCat offering (monthly + annual packages). */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!isConfigured()) return null
  try {
    const mod = await loadPurchases()
    const Purchases = mod.default
    const offerings = await Purchases.getOfferings()
    return offerings.current ?? null
  } catch {
    return null
  }
}

// ─── Purchase + restore ───────────────────────────────────────────────────────

/** Initiates a StoreKit purchase flow for the given RC package. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const mod = await loadPurchases()
  const Purchases = mod.default
  const { customerInfo } = await Purchases.purchasePackage(pkg)
  return customerInfo
}

/** Restores previous App Store purchases and returns updated customer info. */
export async function restorePurchases(): Promise<CustomerInfo> {
  const mod = await loadPurchases()
  const Purchases = mod.default
  return Purchases.restorePurchases()
}

// ─── RevenueCat Paywalls UI ────────────────────────────────────────────────────

/**
 * Presents the RevenueCat Paywall (UI SDK).
 *
 * Best-practice: use this as the default paywall surface, because it automatically
 * reflects the current Offering configuration and handles purchase UX.
 *
 * Returns:
 * - 'purchased' when the user completed a purchase in the flow
 * - 'restored' when the user restored purchases
 * - 'cancelled' when the user dismissed the paywall
 * - 'not_configured' when RC is not configured for this build/device (safe)
 */
export async function presentRevenueCatPaywall(): Promise<
  'purchased' | 'restored' | 'cancelled' | 'not_configured'
> {
  if (!isConfigured()) return 'not_configured'
  try {
    const mod = await loadPurchasesUI()
    const PurchasesUI = mod.default
    // Present the default offering paywall configured in RevenueCat.
    const result = await PurchasesUI.presentPaywall()
    // Purchases UI returns a string-ish result on most platforms/versions.
    // Keep this tolerant to minor SDK changes.
    const r = String(result ?? '').toLowerCase()
    if (r.includes('purchased')) return 'purchased'
    if (r.includes('restored')) return 'restored'
    return 'cancelled'
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    // Treat user cancellations as non-errors for UX.
    if (msg.toLowerCase().includes('cancel')) return 'cancelled'
    throw e
  }
}

/**
 * Opens RevenueCat Customer Center (manage subscription, billing, etc.).
 * This is the recommended "Manage subscription" surface when enabled in RevenueCat.
 */
export async function presentCustomerCenter(): Promise<'opened' | 'not_configured'> {
  if (!isConfigured()) return 'not_configured'
  const mod = await loadPurchasesUI()
  const PurchasesUI = mod.default
  await PurchasesUI.presentCustomerCenter()
  return 'opened'
}
