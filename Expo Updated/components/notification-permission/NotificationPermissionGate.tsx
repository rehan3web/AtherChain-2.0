import React, { useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { notificationAdapter } from './adapter';
import { createNotificationPermissionStore } from './model';
import { NotificationPermissionScreen } from './NotificationPermissionScreen';

export function NotificationPermissionGate({ children, required = true }: { children: ReactNode; required?: boolean }) {
  const enabled = required && notificationAdapter.enabled;
  const store = useMemo(() => createNotificationPermissionStore({ ...notificationAdapter, enabled }), [enabled]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    if (!enabled) return;
    const listener = AppState.addEventListener('change', next => {
      if (next === 'active') void store.refresh();
    });
    // Android/Expo Go can regain focus without a background -> active event.
    const focus = AppState.addEventListener('focus', () => { void store.refresh(); });
    void store.start();
    return () => { listener.remove(); focus.remove(); };
  }, [store, enabled]);
  useEffect(() => {
    if (!enabled || state.phase !== 'blocked') return;
    // Native Settings can publish the new permission after the resume event.
    // Read only while the blocking screen is visible and the app is active.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void store.refresh();
    }, 1500);
    return () => clearInterval(timer);
  }, [store, state.phase, enabled]);
  if (state.phase === 'allowed') return children;
  return <NotificationPermissionScreen state={state}
    onAllow={() => { void store.openSettings(); }}
    onRetry={() => { void store.retry(); }} />;
}
