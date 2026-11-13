import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { userApi } from '@/services/api';
import { refreshBackendData } from '@/services/refresh';
import { useToast } from '@/components/toast/ToastProvider';

export function usePushRegistration(signedIn: boolean) {
  const { showToast } = useToast();
  useEffect(() => {
    if (!signedIn || Platform.OS === 'web') return;
    let cancelled = false;
    let registered: string | null = null;
    const register = async () => {
      try {
        const permissions = await Notifications.getPermissionsAsync();
        if (permissions.status !== 'granted') return;
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        if (!projectId) throw new Error('Push delivery needs the Expo EAS project ID in the native build configuration.');
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (!cancelled && token !== registered) {
          await userApi.registerPushToken(token);
          registered = token;
        }
      } catch (cause) {
        if (!cancelled) showToast({ kind: 'error', title: 'Push registration unavailable', body: cause instanceof Error ? cause.message : 'Please retry.' });
      }
    };
    void register();
    const active = AppState.addEventListener('change', state => { if (state === 'active') void register(); });
    const received = Notifications.addNotificationReceivedListener(() => refreshBackendData(['notifications', 'wallet', 'stats', 'transactions', 'mining', 'referral', 'profile']));
    const opened = Notifications.addNotificationResponseReceivedListener(() => refreshBackendData(['notifications', 'wallet', 'stats', 'transactions', 'mining', 'referral', 'profile']));
    return () => { cancelled = true; active.remove(); received.remove(); opened.remove(); };
  }, [signedIn, showToast]);
}
