import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

const CHANNEL_ID = "mining";
const TAG_IMMEDIATE = "mining-ready";
const TAG_REMINDER  = "mining-reminder";

async function isGranted(): Promise<boolean> {
  if (Platform.OS === "web") {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }
  if (!Device.isDevice) return false;
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

async function setupChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Mining Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

function webNotify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try { new Notification(title, { body, icon: "/favicon.ico" }); } catch {}
}

export async function scheduleMiningReadyNotifications(timeLeftSeconds: number) {
  if (!(await isGranted())) return;

  if (Platform.OS === "web") {
    if (timeLeftSeconds <= 0) {
      webNotify("⛏️ Claim Your AT", "Your mining cycle is complete — claim your rewards now!");
    } else {
      setTimeout(() => {
        webNotify("⛏️ Claim Your AT", "Your mining cycle is complete — claim your rewards now!");
      }, timeLeftSeconds * 1000);

      setTimeout(() => {
        webNotify("⏳ Claim Waiting", "Your AT rewards are still waiting for you!");
      }, (timeLeftSeconds + 7200) * 1000);

      setTimeout(() => {
        webNotify("⏳ Claim Waiting", "Don't miss out — your mined AT is ready to collect!");
      }, (timeLeftSeconds + 14400) * 1000);
    }
    return;
  }

  await setupChannel();

  await Notifications.cancelAllScheduledNotificationsAsync();

  const immediateDelay = Math.max(0, timeLeftSeconds);

  await Notifications.scheduleNotificationAsync({
    identifier: TAG_IMMEDIATE,
    content: {
      title: "⛏️ Claim Your AT",
      body: "Your mining cycle is complete — claim your rewards now!",
      sound: true,
      data: { type: "mining_ready" },
    },
    trigger: immediateDelay > 0
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: immediateDelay }
      : null,
  });

  await Notifications.scheduleNotificationAsync({
    identifier: `${TAG_REMINDER}_1`,
    content: {
      title: "⏳ Claim Waiting",
      body: "Your AT rewards are still waiting for you!",
      sound: true,
      data: { type: "mining_reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: immediateDelay + 7200,
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: `${TAG_REMINDER}_2`,
    content: {
      title: "⏳ Claim Waiting",
      body: "Don't miss out — your mined AT is ready to collect!",
      sound: true,
      data: { type: "mining_reminder" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: immediateDelay + 14400,
    },
  });
}

export async function cancelMiningNotifications() {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(TAG_IMMEDIATE);
    await Notifications.cancelScheduledNotificationAsync(`${TAG_REMINDER}_1`);
    await Notifications.cancelScheduledNotificationAsync(`${TAG_REMINDER}_2`);
  } catch {}
}
