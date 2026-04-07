import React from 'react'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { Tabs } from 'expo-router'

import { useClientOnlyValue } from '@/components/useClientOnlyValue'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font } from '@/constants/theme'

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name']
  color: string
}) {
  return <FontAwesome size={24} style={{ marginBottom: -1 }} {...props} />
}

export default function TabLayout() {
  const colors = useVerityPalette()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSubtle,
        tabBarStyle: {
          backgroundColor: colors.surfaceSolid,
          borderTopColor: colors.stroke,
        },
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        headerShown: useClientOnlyValue(false, true),
        headerStyle: {
          backgroundColor: colors.surfaceSolid,
          borderBottomWidth: 1,
          borderBottomColor: colors.stroke,
        },
        headerTitleStyle: {
          fontFamily: font.semi,
          fontSize: 17,
          color: colors.ink,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Discover',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="compass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color }) => <TabBarIcon name="star" color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color }) => <TabBarIcon name="bookmark" color={color} />,
        }}
      />
    </Tabs>
  )
}
