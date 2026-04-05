import { StyleSheet } from 'react-native'

import { Text, View } from '@/components/Themed'

/** Placeholder: sync with web `user_watchlist` in a follow-up. */
export default function WatchlistScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Watchlist</Text>
      <Text style={styles.body}>
        This tab is a stub. The web app syncs tickers to Supabase (`user_watchlist`); wire a FlatList here when you
        want parity on mobile.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.85,
  },
})
