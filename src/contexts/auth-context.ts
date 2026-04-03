import { createContext } from 'react'

export type User = {
  id: string
  email: string
  name?: string
}

export type AuthState = {
  user: User | null
  /** False until first Supabase `getSession` finishes; true immediately in mock mode. */
  authInitialized: boolean
  signIn: (email: string, name?: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
