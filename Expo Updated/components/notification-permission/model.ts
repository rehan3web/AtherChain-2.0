export type NotificationPermission = { granted: boolean; canAskAgain: boolean };
export type NotificationAdapter = {
  enabled: boolean;
  read: () => Promise<NotificationPermission>;
  request: () => Promise<NotificationPermission>;
  openSettings: () => Promise<void>;
};
export type NotificationGateState = {
  phase: 'checking' | 'blocked' | 'allowed';
  busy: boolean;
  error: string | null;
};

/** Native permission is always authoritative; no permission flag is persisted. */
export function createNotificationPermissionStore(adapter: NotificationAdapter) {
  let state: NotificationGateState = { phase: adapter.enabled ? 'checking' : 'allowed', busy: false, error: null };
  let operation: Promise<void> | null = null;
  let started = false;
  let refreshQueued = false;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<NotificationGateState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const perform = (work: () => Promise<void>, error: string): Promise<void> => {
    if (!adapter.enabled) return Promise.resolve();
    if (operation) return operation;
    publish({ busy: true, error: null });
    operation = Promise.resolve().then(work).catch(() => {
      publish({ phase: 'blocked', error });
    }).finally(() => {
      operation = null;
      publish({ busy: false });
      // A fast return from Settings must not lose the foreground permission check.
      if (refreshQueued) {
        refreshQueued = false;
        void check(false);
      }
    });
    return operation;
  };
  const check = (prompt: boolean) => perform(async () => {
    let permission = await adapter.read();
    if (!permission.granted && prompt && permission.canAskAgain) permission = await adapter.request();
    publish({ phase: permission.granted ? 'allowed' : 'blocked' });
  }, 'Could not check notification permission. Please try again.');
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start: () => {
      if (started) return operation ?? Promise.resolve();
      started = true;
      return check(true);
    },
    retry: () => check(false),
    refresh: () => {
      if (operation) { refreshQueued = true; return operation; }
      return check(false);
    },
    openSettings: () => perform(
      async () => {
        // A stale gate must not send an already-authorized user back to Settings.
        const permission = await adapter.read();
        if (permission.granted) {
          publish({ phase: 'allowed' });
          return;
        }
        await adapter.openSettings();
      },
      'Could not open Settings. Open your phone settings, choose this app, and enable notifications.',
    ),
  };
}
