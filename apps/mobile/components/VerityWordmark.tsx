import { Image, type ImageStyle, type StyleProp } from 'react-native'

/** Full Verity logotype (symbol + VERITY) for in-app headers. */
export function VerityWordmark({
  height = 28,
  style,
}: {
  height?: number
  style?: StyleProp<ImageStyle>
}) {
  const aspect = 687 / 1024
  return (
    <Image
      source={require('@/assets/images/verity-wordmark.png')}
      accessibilityLabel="Verity"
      style={[{ height, width: Math.round(height / aspect) }, style]}
      resizeMode="contain"
    />
  )
}
