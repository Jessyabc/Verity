/**
 * RevenueCat purchase utilities.
 *
 * Drop-in ready — wire EXPO_PUBLIC_REVENUECAT_API_KEY into EAS / .env.local
 * and every function here becomes live.  Until the key is present all calls
 * return safe defaults so the app builds and runs without crashing.
 *
 * Setup checklist (one-time):
 *  1. app.revenuecat.com → new project → connect iOS app (bundle ID: com.jessyabc.verity)
 *  2. Create entitlement ID: "premium"
 *  3. Create products in App Store Connect (IDs below) with 14-day free trial
 *  4. Link those products to RevenueCat packages inside the "default" offering
 *  5. Copy the Public SDK Key → EXPO_PUBLIC_REVENUECAT_API_KEY in EAS secrets
 *  6. Set EXPO_PUBLIC_OWNER_EMAIL to your own email → lifetime access in dev
 *     (also grant yourself a Promotional Entitlement in RevenueCat dashboard)
 */

import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases'
import { Platform } from 'react-native'

// ─── Constants ────────────────────────────────────────────────────────────────

/** RevenueCat entitlement ID — must match what you create in the RC dashboard */
export const ENTITLEMENT_ID = 'premium'

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
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR)
    Purchases.configure({ apiKey: RC_API_KEY, appUserID: userId })
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
    const offerings = await Purchases.getOfferings()
    return offerings.current ?? null
  } catch {
    return null
  }
}

// ─── Purchase + restore ───────────────────────────────────────────────────────

/** Initiates a StoreKit purchase flow for the given RC package. */
export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg)
  return customerInfo
}

/** Restores previous App Store purchases and returns updated customer info. */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases()
}
