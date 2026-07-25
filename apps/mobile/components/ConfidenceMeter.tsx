/**
 * Compact confidence meter — thin progress bar from low → high evidence confidence.
 * Used under the company research "Updated …" timestamp.
 */

import { StyleSheet, View } from 'react-native'

import type { ResearchConfidence } from '@/lib/researchFreshness'
import {
  confidenceLabel,
  confidenceMeterColor,
  confidenceMeterValue,
} from '@/lib/researchFreshness'

type Props = {
  confidence: ResearchConfidence
  /** Track / rail color behind the fill */
  trackColor?: string
  width?: number
}

export function ConfidenceMeter({
  confidence,
  trackColor = 'rgba(255,255,255,0.14)',
  width = 112,
}: Props) {
  const fill = confidenceMeterValue(confidence)
  const color = confidenceMeterColor(confidence)

  return (
    <View
      style={[styles.track, { width, backgroundColor: trackColor }]}
      accessibilityRole="progressbar"
      accessibilityLabel={confidenceLabel(confidence)}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fill * 100) }}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(fill * 100)}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 7,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
})
