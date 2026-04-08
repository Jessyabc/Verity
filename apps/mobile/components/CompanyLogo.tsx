import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'

import { BRAND } from '@/constants/brand'
import { font, radius } from '@/constants/theme'
import { useVerityPalette } from '@/hooks/useVerityPalette'

const SIZES = { sm: 40, md: 52, lg: 72 } as const

type Size = keyof typeof SIZES

type Props = {
  name: string
  ticker: string | null
  /** Single URL (legacy) */
  logoUrl?: string | null
  /** Try in order until one loads — use with `buildCompanyLogoCandidates` */
  logoCandidates?: string[] | null
  size?: Size
  /** `brand` matches company / watchlist navy surfaces */
  tone?: 'adaptive' | 'brand'
}

export function CompanyLogo({
  name,
  ticker,
  logoUrl,
  logoCandidates,
  size = 'md',
  tone = 'adaptive',
}: Props) {
  const colors = useVerityPalette()
  const [tryIndex, setTryIndex] = useState(0)
  const [failed, setFailed] = useState(false)

  const list =
    logoCandidates?.filter(Boolean).length ?? 0
      ? (logoCandidates ?? []).filter(Boolean)
      : logoUrl?.trim()
        ? [logoUrl.trim()]
        : []

  const listKey = list.join('|')

  useEffect(() => {
    setTryIndex(0)
    setFailed(false)
  }, [listKey])

  const dim = SIZES[size]
  const initials = (ticker?.slice(0, 2) ?? name.slice(0, 2)).toUpperCase()
  const initialSize = size === 'lg' ? 22 : size === 'sm' ? 14 : 17

  const uri = list[tryIndex]
  const hasMore = tryIndex + 1 < list.length

  const fallbackBg = tone === 'brand' ? 'rgba(92, 154, 154, 0.2)' : colors.accentSoft
  const fallbackBorder = tone === 'brand' ? BRAND.stroke : colors.stroke
  const fallbackInk = tone === 'brand' ? BRAND.onNavy : colors.ink
  const imgBorder = tone === 'brand' ? BRAND.stroke : colors.stroke

  if (!uri || failed) {
    return (
      <View
        style={[
          styles.fallback,
          {
            width: dim,
            height: dim,
            borderRadius: radius.md,
            backgroundColor: fallbackBg,
            borderColor: fallbackBorder,
          },
        ]}
      >
        <Text style={[styles.initials, { color: fallbackInk, fontSize: initialSize }]}>{initials}</Text>
      </View>
    )
  }

  return (
    <Image
      source={{ uri }}
      style={[
        styles.image,
        {
          width: dim,
          height: dim,
          borderRadius: radius.md,
          borderColor: imgBorder,
          backgroundColor: tone === 'brand' ? 'rgba(255,255,255,0.06)' : '#fff',
        },
      ]}
      resizeMode="contain"
      accessibilityLabel=""
      onError={() => {
        if (hasMore) {
          setTryIndex((i) => i + 1)
        } else {
          setFailed(true)
        }
      }}
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
  },
})
