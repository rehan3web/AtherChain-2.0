import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

export type PermissionStatus = "loading" | "granted" | "denied" | "undetermined";

import Constants, { ExecutionEnvironment } from "expo-constants";

export async function checkNotificationPermission(): Promise<PermissionStatus> {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return "granted";
    if (Notification.permission === "granted")  return "granted";
    if (Notification.permission === "denied")   return "denied";
    return "undetermined";
  }
  if (!Device.isDevice) return "granted";
  
  const permissions = await Notifications.getPermissionsAsync();
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  
  if (permissions.granted || permissions.status === "granted") return "granted";
  if (isExpoGo) return "granted"; // Bypass strict gate in Expo Go since push is disabled
  
  if (permissions.status === "denied")  return "denied";
  return "undetermined";
}

export async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (Platform.OS === "web") {
    if (typeof Notification === "undefined") return "granted";
    const result = await Notification.requestPermission();
    return result === "granted" ? "granted" : result === "denied" ? "denied" : "undetermined";
  }
  if (!Device.isDevice) return "granted";
  
  const permissions = await Notifications.requestPermissionsAsync();
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  if (permissions.granted || permissions.status === "granted") return "granted";
  if (isExpoGo) return "granted"; // Bypass strict gate in Expo Go
  
  if (permissions.status === "denied")  return "denied";
  return "undetermined";
}

export function useNotificationPermission() {
  const [status, setStatus] = useState<PermissionStatus>("loading");

  const refresh = async () => {
    const s = await checkNotificationPermission();
    setStatus(s);
  };

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, []);

  return { status, refresh, requestPermission: async () => {
    const s = await requestNotificationPermission();
    setStatus(s);
    return s;
  }};
}
