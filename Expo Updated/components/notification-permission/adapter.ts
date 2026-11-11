import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { NotificationAdapter } from './model';

const permission = (result: Notifications.NotificationPermissionsStatus) => ({
  granted: result.granted || result.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
  canAskAgain: result.canAskAgain,
});

export const notificationAdapter: NotificationAdapter = {
  enabled: true,
  read: async () => permission(await Notifications.getPermissionsAsync()),
  request: async () => {
    // Android 13+ needs a notification channel before its system prompt can appear.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('general', {
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    return permission(await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    }));
  },
  openSettings: () => Linking.openSettings(),
};
