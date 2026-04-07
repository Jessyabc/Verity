import { Image } from 'react-native'

/** Layered Verity “V” — swap `assets/images/verity-mark.png` with final brand artwork. */
export function VerityMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/verity-mark.png')}
      accessibilityLabel="Verity"
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  )
}
