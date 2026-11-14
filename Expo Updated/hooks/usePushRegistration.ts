import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { userApi } from '@/services/api';
import { refreshBackendData } from '@/services/refresh';
import { useToast } from '@/components/toast/ToastProvider';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
    }),
  });
}

export function usePushRegistration(signedIn: boolean) {
  const { showToast } = useToast();
  useEffect(() => {
    if (!signedIn || Platform.OS === 'web') return;
    let cancelled = false;
    let registered: string | null = null;
    let registering = false;
    let asked = false;
    let lastOpened: string | null = null;
    const register = async () => {
      if (registering || cancelled || Constants.executionEnvironment === 'storeClient') return;
      registering = true;
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'AtherChain', importance: Notifications.AndroidImportance.HIGH,
          });
        }
        let permissions = await Notifications.getPermissionsAsync();
        if (!cancelled && permissions.status !== 'granted' && permissions.canAskAgain && !asked) {
          asked = true;
          permissions = await Notifications.requestPermissionsAsync();
        }
        if (permissions.status !== 'granted') return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        if (!projectId) throw new Error('Push delivery needs the Expo EAS project ID in the native build configuration.');
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!cancelled && token !== registered) {
          await userApi.registerPushToken(token);
          registered = token;
        }
      } catch (cause) {
        if (!cancelled) showToast({ kind: 'error', title: 'Push registration unavailable', body: cause instanceof Error ? cause.message : 'Please retry.' });
      } finally {
        registering = false;
      }
    };
    const refresh = () => refreshBackendData(['notifications', 'wallet', 'stats', 'transactions', 'mining', 'referral', 'profile']);
    const open = (response: Notifications.NotificationResponse | null) => {
      if (cancelled || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const id = response.notification.request.identifier;
      if (lastOpened === id) return;
      lastOpened = id;
      refresh();
      const data = response.notification.request.content.data ?? {};
      // Only known destinations: never navigate to arbitrary server-provided URLs.
      if (data.type === 'mining_complete') router.push('/(tabs)/search');
      else if ((data.type === 'support_reply' || data.ticketId) && /^[A-Za-z0-9_-]+$/.test(String(data.ticketId ?? ''))) {
        router.push({ pathname: '/ticket/[id]', params: { id: String(data.ticketId) } });
      } else router.push('/notifications');
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    };
    void register();
    const active = AppState.addEventListener('change', state => { if (state === 'active') void register(); });
    const received = Notifications.addNotificationReceivedListener(refresh);
    const opened = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    return () => { cancelled = true; active.remove(); received.remove(); opened.remove(); };
  }, [signedIn, showToast]);
}
