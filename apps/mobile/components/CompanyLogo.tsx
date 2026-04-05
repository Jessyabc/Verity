import { useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font, radius } from '@/constants/theme'

const SIZES = { md: 52, lg: 72 } as const

type Size = keyof typeof SIZES

export function CompanyLogo({
  name,
  ticker,
  logoUrl,
  size = 'md',
}: {
  name: string
  ticker: string | null
  logoUrl?: string | null
  size?: Size
}) {
  const colors = useVerityPalette()
  const [failed, setFailed] = useState(false)
  const dim = SIZES[size]
  const initials = (ticker?.slice(0, 2) ?? name.slice(0, 2)).toUpperCase()
  const initialSize = size === 'lg' ? 22 : 17

  if (!logoUrl?.trim() || failed) {
    return (
      <View
        style={[
          styles.fallback,
          {
            width: dim,
            height: dim,
            borderRadius: radius.md,
            backgroundColor: colors.accentSoft,
            borderColor: colors.stroke,
          },
        ]}
      >
        <Text style={[styles.initials, { color: colors.ink, fontSize: initialSize }]}>{initials}</Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri: logoUrl }}
      style={[
        styles.image,
        {
          width: dim,
          height: dim,
          borderRadius: radius.md,
          borderColor: colors.stroke,
        },
      ]}
      resizeMode="contain"
      accessibilityLabel=""
      onError={() => setFailed(true)}
    />
  )
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  initials: {
    fontFamily: font.semi,
    letterSpacing: -0.5,
  },
  image: {
    borderWidth: 1,
    backgroundColor: '#fff',
  },
})
