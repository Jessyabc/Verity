import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useColorScheme as useSystemColorScheme } from 'react-native'

const STORAGE_KEY = 'verity.mobile.theme'

export type ThemePreference = 'light' | 'dark' | 'system'

type Ctx = {
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  resolvedScheme: 'light' | 'dark'
  hydrated: boolean
}

const ThemePreferenceContext = createContext<Ctx | null>(null)

async function readStored(): Promise<ThemePreference> {
  try {
    const v = await AsyncStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // ignore
  }
  return 'system'
}

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('system')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    void readStored().then((p) => {
      setPreferenceState(p)
      setHydrated(true)
    })
  }, [])

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p)
    void AsyncStorage.setItem(STORAGE_KEY, p)
  }, [])

  const resolvedScheme: 'light' | 'dark' =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference

  const value = useMemo(
    () => ({ preference, setPreference, resolvedScheme, hydrated }),
    [preference, setPreference, resolvedScheme, hydrated],
  )

  return (
    <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>
  )
}

export function useThemePreference(): Ctx {
  const ctx = useContext(ThemePreferenceContext)
  if (!ctx) {
    throw new Error('useThemePreference must be used within ThemePreferenceProvider')
  }
  return ctx
}
