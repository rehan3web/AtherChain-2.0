import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { ToastStack } from './ToastStack';
import { activeHost, addToast, registerHost, removeToast, ROOT_TOAST_HOST, TOAST_DURATION, type ToastInput, type ToastItem } from './toast-model';
import { ActionsContext, useToast } from './ToastContext';
export { useToast } from './ToastContext';

const StateContext = createContext<{ toasts: ToastItem[]; host: string }>({ toasts: [], host: ROOT_TOAST_HOST });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [hosts, setHosts] = useState<string[]>([]);
  const [paused, pause] = useState(false);
  const sequence = useRef(0);
  const showToast = useCallback((input: ToastInput) => {
    const id = ++sequence.current;
    setToasts(current => addToast(current, { ...input, id, expiresAt: Date.now() + TOAST_DURATION }));
    AccessibilityInfo.announceForAccessibility([input.title, input.body].filter(Boolean).join('. '));
    return id;
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(current => removeToast(current, id)), []);
  const dismissAll = useCallback(() => setToasts([]), []);
  const register = useCallback((id: string) => setHosts(current => registerHost(current, id)), []);
  const unregister = useCallback((id: string) => setHosts(current => current.filter(host => host !== id)), []);
  useEffect(() => {
    if (paused) return;
    const timers = toasts.map(toast => setTimeout(() => dismissToast(toast.id), Math.max(0, toast.expiresAt - Date.now())));
    return () => timers.forEach(clearTimeout);
  }, [toasts, paused, dismissToast]);
  const actions = useMemo(() => ({ showToast, dismissToast, dismissAll, register, unregister, pause }), [showToast, dismissToast, dismissAll, register, unregister]);
  const state = useMemo(() => ({ toasts, host: activeHost(hosts) }), [toasts, hosts]);
  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>
        <View style={styles.fill}>
          {children}
          <ToastHost id={ROOT_TOAST_HOST} />
        </View>
      </StateContext.Provider>
    </ActionsContext.Provider>
  );
}

function ToastHost({ id }: { id: string }) {
  const { toasts, host } = useContext(StateContext);
  const { dismissToast, pause } = useToast();
  return host === id && toasts.length ? <ToastStack toasts={toasts} onDismiss={dismissToast} onPauseChange={pause} modal={id !== ROOT_TOAST_HOST} /> : null;
}

/** Native Modals are separate windows: display the same queue in the topmost one. */
export function ToastSurface({ children }: { children: ReactNode }) {
  const id = useId();
  const { register, unregister } = useToast();
  useLayoutEffect(() => {
    register(id);
    return () => unregister(id);
  }, [id, register, unregister]);
  return <View style={styles.fill}>{children}<ToastHost id={id} /></View>;
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
