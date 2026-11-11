import React from 'react';
import { Tabs } from 'expo-router';
import { GlassDock } from '@/components/navigation/GlassDock';
import { useColors } from '@/hooks/useColors';

export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs
      tabBar={(props) => <GlassDock {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.background }, tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 } }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarButtonTestID: 'dock-index' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet', tabBarButtonTestID: 'dock-wallet' }} />
      <Tabs.Screen name="search" options={{ title: 'Mining', tabBarButtonTestID: 'dock-mining' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarButtonTestID: 'dock-settings' }} />
      <Tabs.Screen name="you" options={{ href: null }} />
      <Tabs.Screen name="saved" options={{ href: null }} />
    </Tabs>
  );
}
