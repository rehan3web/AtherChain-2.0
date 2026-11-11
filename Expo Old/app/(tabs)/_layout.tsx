import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function FullBottomTabBar({ state, descriptors, navigation }: any) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const tabs = [
    { name: "index", label: "Home", icon: "home" },
    { name: "node", label: "Node", icon: "cpu" },
    { name: "swap", label: "Swap", icon: "repeat", isCenter: true },
    { name: "wallet", label: "Wallet", icon: "credit-card" },
    { name: "settings", label: "Settings", icon: "settings" },
  ];

  const bottomSafe = isWeb ? 0 : insets.bottom;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          paddingBottom: bottomSafe,
        },
      ]}
    >
      {tabs.map((tab) => {
        const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
        const isFocused = state.index === routeIndex;
        const route = state.routes[routeIndex];

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route?.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(tab.name);
          }
        };

        if (tab.isCenter) {
          return (
            <Pressable key={tab.name} onPress={onPress} style={styles.tabItem}>
              <View
                style={[
                  styles.centerCircle,
                  {
                    backgroundColor: colors.primary,
                    shadowColor: colors.primary,
                  },
                ]}
              >
                <Feather name={tab.icon as any} size={22} color={colors.primaryForeground} />
              </View>
              <Text style={[styles.tabLabel, { color: colors.primary }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable key={tab.name} onPress={onPress} style={styles.tabItem}>
            <View style={styles.iconWrap}>
              <Feather
                name={tab.icon as any}
                size={20}
                color={isFocused ? colors.primary : colors.mutedForeground}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                { color: isFocused ? colors.primary : colors.mutedForeground },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FullBottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="node" />
      <Tabs.Screen name="swap" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="scanner" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingBottom: 4,
  },
  iconWrap: {
    width: 42,
    height: 34,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  centerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
});
