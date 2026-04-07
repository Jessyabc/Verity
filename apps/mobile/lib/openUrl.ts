/**
 * Safe URL opener — wraps Linking.openURL so errors are caught silently.
 *
 * In Expo Go the promise sometimes rejects even when the system browser
 * successfully opens the URL, producing a visible red error overlay.
 * Catching unconditionally prevents the false-positive error while still
 * allowing the OS to handle the link.
 */
import { Linking } from 'react-native'

export async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url)
  } catch {
    // The URL may still have opened — swallow the error silently.
  }
}
