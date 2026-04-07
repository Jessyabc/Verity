import React from 'react'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import { BlurView } from 'expo-blur'
import { Tabs } from 'expo-router'
import { Platform, StyleSheet } from 'react-native'

import { useClientOnlyValue } from '@/components/useClientOnlyValue'
import { useThemePreference } from '@/contexts/ThemePreferenceContext'
import { useVerityPalette } from '@/hooks/useVerityPalette'
import { font } from '@/constants/theme'

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name']
  color: string
}) {
  return <FontAwesome size={22} style={{ marginBottom: -1 }} {...props} />
}

export default function TabLayout() {
  const colors = useVerityPalette()
  const { resolvedScheme } = useThemePreference()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.inkSubtle,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.stroke,
            backgroundColor: 'transparent',
            elevation: 0,
          },
          default: {
            backgroundColor: colors.surfaceSolid,
            borderTopColor: colors.stroke,
            elevation: 8,
          },
        }),
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              tint={resolvedScheme === 'dark' ? 'dark' : 'light'}
              intensity={resolvedScheme === 'dark' ? 38 : 58}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        tabBarLabelStyle: { fontFamily: font.medium, fontSize: 11 },
        headerShown: useClientOnlyValue(false, true),
        headerStyle: {
          backgroundColor: colors.surfaceSolid,
          borderBottomWidth: StyleSheet.hairlineWidth,
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
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  )
}
