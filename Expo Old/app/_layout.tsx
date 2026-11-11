import "react-native-get-random-values";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Application from "expo-application";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LogBox, Platform, ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import { userApi, authApi } from "@/services/api";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

LogBox.ignoreLogs([
  "expo-notifications: Android Push",
  "`expo-notifications` functionality",
]);

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { WalletModeProvider } from "@/contexts/WalletModeContext";
import NotificationGate from "@/app/notification-gate";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const queryClient = new QueryClient();

function ForceUpdateScreen() {
  const colors = useColors();

  const handleUpdate = () => {
    Linking.openURL("https://download.atherchain.com");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 24 }}>
      <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryPale, justifyContent: "center", alignItems: "center", marginBottom: 24 }}>
        <Feather name="arrow-up-circle" size={40} color={colors.primary} />
      </View>
      <Text style={{ fontSize: 22, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center", marginBottom: 12 }}>
        Update Required
      </Text>
      <Text style={{ fontSize: 15, fontFamily: "Inter_500Medium", color: colors.mutedForeground, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
        Your app is not updated. Please update your app. Go to atherchain.com and download the latest version.
      </Text>
      <Pressable
        onPress={handleUpdate}
        style={{ width: "100%", height: 56, borderRadius: 28, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" }}
      >
        <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.primaryForeground }}>
          Download Latest Version
        </Text>
      </Pressable>
    </View>
  );
}

function RootLayoutNav() {
  const { isLoggedIn, isLoading, isBlocked } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colors = useColors();
  const [isVersionAllowed, setIsVersionAllowed] = useState<boolean | 'checking'>('checking');

  useEffect(() => {
    (async () => {
      try {
        const appVersion =
          Application.nativeApplicationVersion ||
          Constants.expoConfig?.version ||
          (Constants.manifest2 as any)?.extra?.expoClient?.version ||
          (Constants.manifest as any)?.version ||
          "1.1.1";
        console.log("📱 App version for whitelist check:", appVersion);
        const res = await authApi.checkVersion(appVersion);
        if (res && res.allowed === false) {
          setIsVersionAllowed(false);
        } else {
          setIsVersionAllowed(true);
        }
      } catch (err) {
        console.error("Failed to check app version:", err);
        setIsVersionAllowed(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (isLoading || isVersionAllowed === 'checking') return;

    if (isBlocked && (segments[0] as any) !== "blocked") {
      router.replace("/blocked" as any);
      return;
    }

    const segment = segments[0] as string | undefined;
    const inAuthGroup = segment === "login" || segment === "register" || segment === "blocked" || segment === "welcome";

    if (!isLoggedIn && !inAuthGroup) {
      router.replace("/welcome" as any);
    } else if (isLoggedIn && inAuthGroup && !isBlocked) {
      router.replace("/(tabs)" as any);
    }
  }, [isLoggedIn, isLoading, segments, isVersionAllowed, isBlocked]);

  // Register Expo push token with backend on login
  useEffect(() => {
    if (!isLoggedIn || isLoading || isVersionAllowed !== true) return;
    if (Platform.OS === "web" || !Device.isDevice) return;

    (async () => {
      try {
        // Android 8+ requires a notification channel
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
            sound: "default",
          });
        }

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync({
          projectId: projectId || "8a5d8327-e345-4274-a180-f47a5d183369",
        });
        if (token) {
          await userApi.registerPushToken(token).catch(() => {});
          console.log("📱 Push token registered:", token);
        }
      } catch (err) {
        console.log("Push token registration skipped:", err);
      }
    })();
  }, [isLoggedIn, isLoading, isVersionAllowed]);

  if (isVersionAllowed === 'checking') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (isVersionAllowed === false) {
    return <ForceUpdateScreen />;
  }

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="receipt" options={{ headerShown: false }} />
      <Stack.Screen name="transactions" options={{ headerShown: false }} />
      <Stack.Screen name="receive" options={{ headerShown: false }} />
      <Stack.Screen name="send" options={{ headerShown: false }} />
      <Stack.Screen name="kyc" options={{ headerShown: false }} />
      <Stack.Screen name="help" options={{ headerShown: false }} />
      <Stack.Screen name="statics" options={{ headerShown: false }} />
      <Stack.Screen name="news" options={{ headerShown: false }} />
      <Stack.Screen name="token-detail" options={{ headerShown: false, presentation: "fullScreenModal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="blocked" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}

function AppWithNotificationGate() {
  const { status, refresh, requestPermission } = useNotificationPermission();
  const [autoRequestDone, setAutoRequestDone] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (status === "undetermined" && !autoRequestDone) {
      requestPermission().then(() => {
        if (!isMounted) return;
        setAutoRequestDone(true);
      });
    } else if (status !== "loading" && !autoRequestDone) {
      setAutoRequestDone(true);
    }
    return () => {
      isMounted = false;
    };
  }, [status, autoRequestDone, requestPermission]);

  if (status === "loading" || (status === "undetermined" && !autoRequestDone)) return null;

  if (status !== "granted") {
    return (
      <NotificationGate
        status={status}
        onRefresh={refresh}
      />
    );
  }

  return <RootLayoutNav />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <WalletModeProvider>
                  <GestureHandlerRootView style={{ flex: 1 }}>
                    <AppWithNotificationGate />
                  </GestureHandlerRootView>
                </WalletModeProvider>
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
