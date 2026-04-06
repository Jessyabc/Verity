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
import { useEffect } from 'react'
import 'react-native-reanimated'

import { useColorScheme } from '@/components/useColorScheme'
import { verityNavigationTheme } from '@/constants/navigationTheme'
import { AuthProvider } from '@/contexts/AuthContext'
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

  return <RootLayoutNav />
}

function RootLayoutNav() {
  const colorScheme = useColorScheme()
  const navTheme = verityNavigationTheme(colorScheme)

  return (
    <AuthProvider>
      <ThemeProvider value={navTheme}>
        <AuthAwareStack />
      </ThemeProvider>
    </AuthProvider>
  )
}

function AuthAwareStack() {
  useProtectedSession()
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      <Stack.Screen
        name="company/[slug]"
        options={{
          headerShown: true,
          headerBackTitle: 'Back',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="reader/[slug]"
        options={{
          headerShown: true,
          headerBackTitle: 'Back',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="chat/[slug]"
        options={{
          headerShown: true,
          headerBackTitle: 'Back',
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
