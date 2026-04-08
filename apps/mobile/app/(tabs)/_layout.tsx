/**
 * Tab group layout — no bottom tab bar.
 * Sidebar + pan-to-open live in root `app/_layout.tsx` (SidebarProvider).
 */
import { Slot } from 'expo-router'

export default function TabLayout() {
  return <Slot />
}
