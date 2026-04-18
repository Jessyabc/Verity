import type { ExpoConfig } from 'expo/config'

/**
 * Verity — Expo / TestFlight
 *
 * Brand assets (`assets/images/`):
 * - icon.png — 1024×1024 App Store / Play icon (transparent pad around mark).
 * - adaptive-icon.png — Android foreground (1024×1024); use adaptive `backgroundColor` for legibility.
 * - verity-mark.png — symbol-only for compact UI (e.g. FABs).
 * - verity-wordmark.png — symbol + wordmark for in-app headers / splash.
 *
 * Before your first EAS iOS build:
 * - Replace `ios.bundleIdentifier` with your App ID (e.g. com.yourcompany.verity). It must match App Store Connect.
 * - In Apple Developer → Identifiers, create the App ID with the same string.
 * - In Supabase → Authentication → URL configuration, add the magic-link redirect:
 *   - Production-style: verity://auth-callback (must match `scheme` + path used in `Linking.createURL('auth-callback')`)
 *   - Dev: also add Expo Go / dev-client URLs if you test magic links there (see Expo linking docs).
 *
 * EAS: `npm i -g eas-cli` → `eas login` → `eas build:configure` (once) → `eas build --platform ios --profile production`
 */
const config: ExpoConfig = {
  name: 'Verity',
  slug: 'verity-mobile',
  owner: 'jessyabc',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'verity',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0A2540',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.jessyabc.verity',
    // buildNumber is auto-incremented by EAS on each production build.
    // For local development leave this as '1'.
    buildNumber: '1',
    // Minimum iOS version for App Store submission (React Native 0.81 requires 15.1+)
    // @ts-expect-error ExpoConfig typings may omit deploymentTarget; supported at runtime / EAS.
    deploymentTarget: '15.1',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Allow the system browser to open any https:// URL
      LSApplicationQueriesSchemes: ['https', 'http'],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0A2540',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: 'com.jessyabc.verity',
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-audio',
    [
      'expo-router',
      {
        // Required for Expo Head / RSC URL helpers; without it, dev can show missing-origin warnings.
        // Replace with your real web URL when you ship web (or set EXPO_PUBLIC_EXPO_ROUTER_ORIGIN in env).
        origin: process.env.EXPO_PUBLIC_EXPO_ROUTER_ORIGIN ?? 'https://expo.dev',
      },
    ],
    // RevenueCat — handles StoreKit / in-app purchases.
    // Set EXPO_PUBLIC_REVENUECAT_API_KEY in EAS secrets (and locally in .env.local).
    // Requires a native dev build — does NOT work in Expo Go.
    // Run: eas build --platform ios --profile development
    'react-native-purchases',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'a67d7022-0c14-4995-b843-2fe3bf43ce5f',
    },
  },
}

export default config
