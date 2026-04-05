import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'

import { View } from '@/components/Themed'
import { useAuth } from '@/contexts/AuthContext'

/** Route target for email magic links (`verity://auth-callback`). Session is applied in AuthProvider. */
export default function AuthCallbackScreen() {
  const { user, initialized, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!initialized || loading) return
    if (user) router.replace('/(tabs)')
    else router.replace('/(auth)/sign-in')
  }, [user, initialized, loading, router])

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" />
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
