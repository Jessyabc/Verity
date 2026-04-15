/**
 * Paywall screen — full-screen modal, not dismissible.
 *
 * Shown when the user has no active entitlement (new user or expired trial).
 * On successful purchase or restore, refreshes the entitlement context and
 * navigates back to the main tab stack.
 *
 * Apple review requirements met here:
 *  ✓ Price displayed clearly in local currency
 *  ✓ Trial duration stated in the CTA ("14-day free trial")
 *  ✓ "Then $X/period" disclosure beneath the CTA
 *  ✓ "Restore purchases" link
 *  ✓ Privacy Policy link
 *  ✓ Terms of Use link
 *  ✓ "Subscription auto-renews. Cancel anytime." disclosure
 */

import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import { StatusBar } from 'expo-status-bar'
import { useRouter } from 'expo-router'
import type { PurchasesPackage } from 'react-native-purchases'

import { VerityWordmark } from '@/components/VerityWordmark'
import { BRAND } from '@/constants/brand'
import { font, radius, space } from '@/constants/theme'
import { openUrl } from '@/lib/openUrl'
import { useEntitlement } from '@/contexts/EntitlementContext'
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  PRODUCT_MONTHLY_ID,
  PRODUCT_ANNUAL_ID,
  PRICE_MONTHLY_CAD,
  PRICE_ANNUAL_CAD,
  ANNUAL_SAVINGS_CAD,
  TRIAL_DAYS,
} from '@/lib/purchases'

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIVACY_URL = 'https://verity.so/privacy'
const TERMS_URL   = 'https://verity.so/terms'

const VALUE_PROPS = [
  'Monitor official filings & IR documents',
  'AI research — company narrative vs. media',
  'Afaqi — grounded research assistant with citations',
  'Portfolio digest delivered to your watchlist',
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const insets = useSafeAreaInsets()
  const router  = useRouter()
  const { refresh: refreshEntitlement } = useEntitlement()

  // RevenueCat package objects (null until offerings load or if RC not configured)
  const [monthlyPkg, setMonthlyPkg] = useState<PurchasesPackage | null>(null)
  const [annualPkg,  setAnnualPkg]  = useState<PurchasesPackage | null>(null)
  const [offeringsLoading, setOfferingsLoading] = useState(true)

  // UI state
  const [selectedId, setSelectedId]   = useState<string>(PRODUCT_ANNUAL_ID)
  const [purchasing,  setPurchasing]  = useState(false)
  const [restoring,   setRestoring]   = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    void getOfferings().then((offering) => {
      if (offering) {
        for (const pkg of offering.availablePackages) {
          if (pkg.product.identifier === PRODUCT_MONTHLY_ID) setMonthlyPkg(pkg)
          if (pkg.product.identifier === PRODUCT_ANNUAL_ID)  setAnnualPkg(pkg)
        }
      }
      setOfferingsLoading(false)
    })
  }, [])

  const selectedPkg = selectedId === PRODUCT_ANNUAL_ID ? annualPkg : monthlyPkg
  const busy        = purchasing || restoring

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handlePurchase = async () => {
    if (!selectedPkg) return
    setError(null)
    setPurchasing(true)
    try {
      await purchasePackage(selectedPkg)
      await refreshEntitlement()
      router.replace('/(tabs)')
    } catch (e: unknown) {
      // User-cancelled purchase — StoreKit throws a recognisable error; don't show a message
      const msg = e instanceof Error ? e.message : String(e)
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('cancelled')) {
        setError(msg)
      }
    } finally {
      setPurchasing(false)
    }
  }

  const handleRestore = async () => {
    setError(null)
    setRestoring(true)
    try {
      await restorePurchases()
      await refreshEntitlement()
      router.replace('/(tabs)')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not restore purchases.')
    } finally {
      setRestoring(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: BRAND.navy }]}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={styles.brandBlock}>
          <VerityWordmark height={30} />
          <Text style={[styles.tagline, { color: BRAND.tealLight }]}>
            Company · Media · The Gap
          </Text>
        </View>

        {/* Headline */}
        <Text style={[styles.headline, { color: BRAND.onNavy }]}>
          {TRIAL_DAYS} days free,{'\n'}then your plan.
        </Text>
        <Text style={[styles.subline, { color: BRAND.onNavyMuted }]}>
          Cancel anytime before the trial ends and you won't be charged.
        </Text>

        {/* Value props */}
        <View style={styles.valueList}>
          {VALUE_PROPS.map((prop) => (
            <View key={prop} style={styles.valueRow}>
              <Text style={[styles.valueTick, { color: BRAND.tealLight }]}>✓</Text>
              <Text style={[styles.valueText, { color: BRAND.onNavyMuted }]}>{prop}</Text>
            </View>
          ))}
        </View>

        {/* Plan cards */}
        {offeringsLoading ? (
          <ActivityIndicator
            color={BRAND.tealLight}
            size="large"
            style={{ marginVertical: space.xl }}
          />
        ) : (
          <View style={styles.planRow}>
            {/* ── Monthly ── */}
            <Pressable
              style={({ pressed }) => [
                styles.planCard,
                {
                  borderColor:
                    selectedId === PRODUCT_MONTHLY_ID ? BRAND.tealLight : BRAND.stroke,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => setSelectedId(PRODUCT_MONTHLY_ID)}
              disabled={busy}
              accessibilityLabel="Select monthly plan"
              accessibilityState={{ selected: selectedId === PRODUCT_MONTHLY_ID }}
            >
              <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[styles.planInner, { backgroundColor: BRAND.glassNavy }]}>
                <Text style={[styles.planInterval, { color: BRAND.onNavySubtle }]}>
                  MONTHLY
                </Text>
                <Text style={[styles.planPrice, { color: BRAND.onNavy }]}>
                  {PRICE_MONTHLY_CAD}
                </Text>
                <Text style={[styles.planUnit, { color: BRAND.onNavySubtle }]}>/ month</Text>
              </View>
            </Pressable>

            {/* ── Annual ── */}
            <Pressable
              style={({ pressed }) => [
                styles.planCard,
                {
                  borderColor:
                    selectedId === PRODUCT_ANNUAL_ID ? BRAND.tealLight : BRAND.stroke,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => setSelectedId(PRODUCT_ANNUAL_ID)}
              disabled={busy}
              accessibilityLabel="Select annual plan"
              accessibilityState={{ selected: selectedId === PRODUCT_ANNUAL_ID }}
            >
              <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[styles.planInner, { backgroundColor: BRAND.glassNavy }]}>
                {/* Best value badge */}
                <View style={[styles.badge, { backgroundColor: BRAND.tealDark }]}>
                  <Text style={[styles.badgeText, { color: BRAND.navy }]}>
                    Save {ANNUAL_SAVINGS_CAD}/yr
                  </Text>
                </View>
                <Text style={[styles.planInterval, { color: BRAND.onNavySubtle }]}>
                  ANNUAL
                </Text>
                <Text style={[styles.planPrice, { color: BRAND.onNavy }]}>
                  {PRICE_ANNUAL_CAD}
                </Text>
                <Text style={[styles.planUnit, { color: BRAND.onNavySubtle }]}>/ year</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Error */}
        {error ? (
          <Text style={[styles.errorText, { color: '#f87171' }]} role="alert">
            {error}
          </Text>
        ) : null}

        {/* Primary CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: BRAND.tealDark,
              opacity: pressed || busy || (!selectedPkg && !offeringsLoading) ? 0.7 : 1,
            },
          ]}
          onPress={() => void handlePurchase()}
          disabled={busy || (!selectedPkg && !offeringsLoading)}
          accessibilityLabel={`Start ${TRIAL_DAYS}-day free trial`}
        >
          {purchasing ? (
            <ActivityIndicator color={BRAND.navy} />
          ) : (
            <>
              <Text style={[styles.ctaLabel, { color: BRAND.navy }]}>
                Start {TRIAL_DAYS}-day free trial
              </Text>
              <Text style={[styles.ctaSub, { color: BRAND.navy }]}>
                {selectedId === PRODUCT_ANNUAL_ID
                  ? `Then ${PRICE_ANNUAL_CAD} CAD / year`
                  : `Then ${PRICE_MONTHLY_CAD} CAD / month`}
              </Text>
            </>
          )}
        </Pressable>

        {/* Restore purchases — required by Apple */}
        <Pressable
          style={({ pressed }) => [
            styles.restoreBtn,
            { opacity: pressed || busy ? 0.6 : 1 },
          ]}
          onPress={() => void handleRestore()}
          disabled={busy}
          accessibilityLabel="Restore purchases"
        >
          <Text style={[styles.restoreLabel, { color: BRAND.tealLight }]}>
            {restoring ? 'Restoring…' : 'Restore purchases'}
          </Text>
        </Pressable>

        {/* Legal — required by Apple */}
        <Text style={[styles.legalBody, { color: BRAND.onNavySubtle }]}>
          Subscription auto-renews at the end of each period. Cancel anytime in{' '}
          {Platform.OS === 'ios' ? 'iPhone Settings → Apple ID → Subscriptions' : 'your account settings'}.
        </Text>

        <View style={styles.legalRow}>
          <Pressable onPress={() => void openUrl(PRIVACY_URL)}>
            <Text style={[styles.legalLink, { color: BRAND.tealLight }]}>Privacy Policy</Text>
          </Pressable>
          <Text style={[styles.legalSep, { color: BRAND.onNavySubtle }]}>·</Text>
          <Pressable onPress={() => void openUrl(TERMS_URL)}>
            <Text style={[styles.legalLink, { color: BRAND.tealLight }]}>Terms of Use</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  scroll: {
    paddingHorizontal: space.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  brandBlock: {
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xl,
  },
  tagline: {
    fontFamily: font.medium,
    fontSize: 13,
    letterSpacing: 0.4,
  },

  headline: {
    fontFamily: font.bold,
    fontSize: 30,
    letterSpacing: -0.6,
    lineHeight: 36,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  subline: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: space.xl,
  },

  valueList: {
    gap: space.md,
    marginBottom: space.xl,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  valueTick: {
    fontFamily: font.semi,
    fontSize: 15,
    lineHeight: 22,
    width: 18,
  },
  valueText: {
    flex: 1,
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 22,
  },

  planRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.xl,
  },
  planCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    minHeight: 120,
  },
  planInner: {
    flex: 1,
    padding: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.lg - 1,
  },
  badge: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: font.semi,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  planInterval: {
    fontFamily: font.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  planPrice: {
    fontFamily: font.bold,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  planUnit: {
    fontFamily: font.regular,
    fontSize: 12,
  },

  errorText: {
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: space.md,
    lineHeight: 18,
  },

  cta: {
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
    minHeight: 60,
    justifyContent: 'center',
  },
  ctaLabel: {
    fontFamily: font.semi,
    fontSize: 17,
  },
  ctaSub: {
    fontFamily: font.regular,
    fontSize: 12,
    opacity: 0.8,
  },

  restoreBtn: {
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  restoreLabel: {
    fontFamily: font.medium,
    fontSize: 14,
  },

  legalBody: {
    fontFamily: font.regular,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: space.md,
  },
  legalLink: {
    fontFamily: font.medium,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  legalSep: { fontSize: 12 },
})
