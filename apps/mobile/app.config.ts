import type { ExpoConfig } from 'expo/config'

/**
 * Verity — Expo / TestFlight
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
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.jessyabc.verity',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#ffffff',
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
  plugins: ['expo-router'],
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
