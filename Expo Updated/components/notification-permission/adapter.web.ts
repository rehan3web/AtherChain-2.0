import type { NotificationAdapter } from './model';

const mobileOnly = async (): Promise<never> => {
  throw new Error('Notification permission is managed only in the mobile app.');
};

/** Deliberate product scope: the browser preview never requires phone permissions. */
export const notificationAdapter: NotificationAdapter = {
  enabled: false,
  read: mobileOnly,
  request: mobileOnly,
  openSettings: mobileOnly,
};
