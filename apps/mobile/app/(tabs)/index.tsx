import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput,
} from 'react-native'

import { Text, View } from '@/components/Themed'
import { useAuth } from '@/contexts/AuthContext'
import { searchCompanies, type SearchCompanyRow } from '@/lib/companySearch'
import { isSupabaseConfigured } from '@/lib/supabase'

export default function HomeScreen() {
  const { user, signOut } = useAuth()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<SearchCompanyRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (!isSupabaseConfigured()) return
    setLoading(true)
    setSearchError(null)
    try {
      const data = await searchCompanies(q, 25)
      setRows(data)
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verity</Text>
      <Text style={styles.email}>{user?.email ?? '—'}</Text>
      <Pressable style={styles.outlineBtn} onPress={() => void signOut()}>
        <RNText style={styles.outlineBtnText}>Sign out</RNText>
      </Pressable>

      <Text style={styles.section}>Company search</Text>
      <Text style={styles.hint}>Uses the same search_companies RPC as the web app (requires sign-in).</Text>
      <TextInput
        style={styles.input}
        placeholder="Name, ticker, or slug…"
        placeholderTextColor="#888"
        value={query}
        onChangeText={setQuery}
        onSubmitEditing={() => void runSearch(query)}
        returnKeyType="search"
      />
      <Pressable style={styles.primaryBtn} onPress={() => void runSearch(query)}>
        <RNText style={styles.primaryBtnText}>Search</RNText>
      </Pressable>

      {loading ? <ActivityIndicator style={styles.spinner} /> : null}
      {searchError ? <RNText style={styles.err}>{searchError}</RNText> : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        style={styles.list}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No results yet — try a query or leave blank for newest.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowMeta}>
              {item.ticker ?? '—'} · {item.slug}
            </Text>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  email: { marginTop: 6, fontSize: 15, opacity: 0.85 },
  outlineBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#64748b',
  },
  outlineBtnText: { fontSize: 14, fontWeight: '600' },
  section: { marginTop: 28, fontSize: 18, fontWeight: '600' },
  hint: { marginTop: 6, fontSize: 13, opacity: 0.75 },
  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  spinner: { marginTop: 16 },
  err: { marginTop: 8, color: '#b91c1c', fontSize: 14 },
  list: { marginTop: 12, flex: 1 },
  empty: { opacity: 0.6, fontSize: 14, marginTop: 8 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowMeta: { marginTop: 4, fontSize: 13, opacity: 0.75 },
})
