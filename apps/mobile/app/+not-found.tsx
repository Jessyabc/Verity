import { Link, Stack } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { VerityMark } from '@/components/VerityMark'
import { font, space } from '@/constants/theme'
import { useAdaptiveBrand } from '@/hooks/useAdaptiveBrand'

export default function NotFoundScreen() {
  const brand = useAdaptiveBrand()
  const insets = useSafeAreaInsets()

  return (
    <>
      <Stack.Screen options={{ title: 'Page not found', headerShown: false }} />
      <View
        style={[
          styles.container,
          {
            backgroundColor: brand.navy,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        <VerityMark size={48} />
        <Text style={[styles.title, { color: brand.onNavy }]}>Page not found</Text>
        <Text style={[styles.body, { color: brand.onNavyMuted }]}>
          This page does not exist or has been moved.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: brand.tealLight }]}>Go to watchlist</Text>
        </Link>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  title: { fontFamily: font.semi, fontSize: 22, letterSpacing: -0.3, marginTop: space.lg },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  link: { marginTop: space.sm },
  linkText: { fontFamily: font.semi, fontSize: 15 },
})
