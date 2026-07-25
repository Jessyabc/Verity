/**
 * “What changed” card — bullets from deterministic research diffs after Refresh.
 */

import { StyleSheet, Text, View } from 'react-native'

import { font, radius, space } from '@/constants/theme'
import type { AdaptiveBrandTokens } from '@/hooks/useAdaptiveBrand'
import type { ResearchChangeSummary } from '@/lib/researchCache'
import { formatAgo } from '@/lib/format'

type Props = {
  summary: ResearchChangeSummary
  brand: AdaptiveBrandTokens
}

export function WhatChangedCard({ summary, brand }: Props) {
  const bullets = summary.bullets.filter((b) => b.trim().length > 0)
  if (bullets.length === 0) return null

  const since =
    summary.previous_fetched_at != null ? formatAgo(summary.previous_fetched_at) : null

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: 'rgba(47, 180, 176, 0.10)',
          borderColor: 'rgba(47, 180, 176, 0.28)',
        },
      ]}
    >
      <Text style={[styles.title, { color: brand.onNavy }]}>What changed</Text>
      {since ? (
        <Text style={[styles.since, { color: brand.onNavyMuted }]}>
          Compared to prior research ({since})
        </Text>
      ) : null}
      <View style={styles.list}>
        {bullets.map((b, i) => (
          <View key={`${i}-${b.slice(0, 24)}`} style={styles.row}>
            <Text style={[styles.bullet, { color: brand.tealLight }]}>•</Text>
            <Text style={[styles.text, { color: brand.onNavyMuted }]}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    gap: 4,
  },
  title: {
    fontFamily: font.semi,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  since: {
    fontFamily: font.regular,
    fontSize: 12,
    marginBottom: 4,
  },
  list: { gap: 6, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: { fontFamily: font.semi, fontSize: 14, lineHeight: 20 },
  text: { flex: 1, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
})
