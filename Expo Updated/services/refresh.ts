const listeners = new Set<() => void>();

/** Notify already-mounted screens after a confirmed server mutation. */
export function refreshBackendData() {
  listeners.forEach(listener => listener());
}

export function onBackendRefresh(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
