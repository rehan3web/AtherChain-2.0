import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, StatusBar, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts,
} from '@expo-google-fonts/dm-sans';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { ThemeProvider, useTheme } from '@/hooks/useTheme';
import { useColors } from '@/hooks/useColors';
import { ToastProvider, useToast } from '@/components/toast/ToastProvider';
import { loadDemoSession, useDemoSession } from '@/components/onboarding/session';
import { NotificationPermissionGate } from '@/components/notification-permission/NotificationPermissionGate';
import { usePushRegistration } from '@/hooks/usePushRegistration';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
// Native entry waits for the real OS notification grant.
const REQUIRE_NOTIFICATION_PERMISSION = true;

function RootLayoutNav() {
  const c = useColors();
  const entry = useDemoSession();
  usePushRegistration(entry.entered);
  useEffect(() => {
    if (entry.ready && entry.blocked && !entry.entered) router.replace('/account-banned');
  }, [entry.ready, entry.blocked, entry.entered]);
  const { scheme, error } = useTheme();
  const { showToast } = useToast();
  useEffect(() => {
    if (error) showToast({ kind: 'error', title: 'Theme preference', body: error });
  }, [error, showToast]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    void SystemUI.setBackgroundColorAsync(c.background).catch(() => {
      if (!cancelled) showToast({ kind: 'error', title: 'System appearance', body: 'Could not update the system background. Please reload the app.' });
    });
    return () => { cancelled = true; };
  }, [c.background, showToast]);
  if (!entry.ready) return (
    <View testID="entry-loading" style={{ flex: 1, backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      {entry.error ? <>
        <Text accessibilityRole="alert" style={{ fontFamily: 'DMSans_400Regular', color: c.walletError, textAlign: 'center' }}>{entry.error}</Text>
        <Pressable testID="entry-retry" disabled={entry.pending} onPress={() => { void loadDemoSession(); }}
          accessibilityRole="button" accessibilityLabel="Retry opening app"
          style={{ paddingHorizontal: 24, paddingVertical: 16, borderRadius: 28, backgroundColor: c.walletInk }}>
          <Text style={{ color: c.walletOnInk, fontFamily: 'DMSans_600SemiBold' }}>Retry</Text>
        </Pressable>
      </> : <ActivityIndicator color={c.walletInk} />}
    </View>
  );
  return (
    <>
    <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} hidden={false} />
    <Stack screenOptions={{ statusBarStyle: scheme === 'dark' ? 'light' : 'dark', statusBarHidden: false, headerBackTitle: 'Back', contentStyle: { backgroundColor: c.background }, headerStyle: { backgroundColor: c.background }, headerTintColor: c.foreground }}>
      <Stack.Protected guard={!entry.entered} redirectTo="/">
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="signup" options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: false }} />
        <Stack.Screen name="account-banned" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack.Protected>
      {/* Help remains available before login, including from the banned screen. */}
      <Stack.Screen name="help" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="ticket/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Protected guard={entry.entered} redirectTo="/onboarding">
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="statistics" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="news" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="referral" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="transactions" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="scan" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="kyc" options={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="sessions" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="twofa" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="passkeys" options={{ headerShown: false, animation: 'slide_from_right' }} />
      <Stack.Screen name="change-password" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack.Protected>
    </Stack>
    </>
  );
}

function ThemedApp() {
  const { ready } = useTheme();
  const c = useColors();
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if ((fontsLoaded || fontError) && ready) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, ready]);

  if ((!fontsLoaded && !fontError) || !ready) return null;

  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: c.background }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.background }}>
            <KeyboardProvider>
              <ToastProvider><NotificationPermissionGate required={REQUIRE_NOTIFICATION_PERMISSION}><RootLayoutNav /></NotificationPermissionGate></ToastProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return <ThemeProvider><ThemedApp /></ThemeProvider>;
}
