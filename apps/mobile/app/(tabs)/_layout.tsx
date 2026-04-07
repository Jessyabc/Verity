/**
 * Tab group layout — no bottom tab bar.
 * Navigation is handled by the sliding sidebar (swipe from left or hamburger).
 */
import { Slot } from 'expo-router'
import { View } from 'react-native'

import { SidebarProvider, SidebarDrawer } from '@/components/Sidebar'

export default function TabLayout() {
  return (
    <SidebarProvider>
      <View style={{ flex: 1 }}>
        <Slot />
        <SidebarDrawer />
      </View>
    </SidebarProvider>
  )
}
