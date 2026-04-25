import 'react-native-gesture-handler'

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { ThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { SidebarProvider } from '@/components/Sidebar'
import { useColorScheme } from '@/components/useColorScheme'
import { verityNavigationTheme } from '@/constants/navigationTheme'
import { AuthProvider } from '@/contexts/AuthContext'
import { EntitlementProvider } from '@/contexts/EntitlementContext'
import { ThemePreferenceProvider } from '@/contexts/ThemePreferenceContext'
import { useEntitlementGate } from '@/hooks/useEntitlementGate'
import { useProtectedSession } from '@/hooks/useProtectedSession'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(tabs)',
}

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  })

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync()
  }, [loaded])

  if (!loaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemePreferenceProvider>
        <AuthProvider>
          <EntitlementProvider>
            <RootNavigationShell />
          </EntitlementProvider>
        </AuthProvider>
      </ThemePreferenceProvider>
    </GestureHandlerRootView>
  )
}

function RootNavigationShell() {
  const colorScheme = useColorScheme()
  const navTheme = verityNavigationTheme(colorScheme)

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AuthAwareStack />
    </ThemeProvider>
  )
}

function AuthAwareStack() {
  useProtectedSession()
  useEntitlementGate()
  const stackScreenGesture = {
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
    animation: 'slide_from_right' as const,
  }
  return (
    <SidebarProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        <Stack.Screen
          name="profile"
          options={{
            title: 'Account',
            headerBackTitle: 'Back',
            ...stackScreenGesture,
          }}
        />
        <Stack.Screen
          name="company/[slug]"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            ...stackScreenGesture,
          }}
        />
        <Stack.Screen
          name="reader/[slug]"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            ...stackScreenGesture,
          }}
        />
        <Stack.Screen
          name="chat/[slug]/index"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            ...stackScreenGesture,
          }}
        />
        <Stack.Screen
          name="chat/[slug]/[conversationId]"
          options={{
            headerShown: true,
            headerBackTitle: 'Conversations',
            ...stackScreenGesture,
          }}
        />
        <Stack.Screen
          name="afaqi"
          options={{
            headerShown: true,
            headerBackTitle: 'Back',
            ...stackScreenGesture,
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            // Not dismissible — user must subscribe or restore to exit
            gestureEnabled: false,
          }}
        />
      </Stack>
    </SidebarProvider>
  )
}
