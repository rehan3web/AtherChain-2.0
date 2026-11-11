export type ToastInput = { kind: 'success' | 'error' | 'info'; title: string; body?: string };
export type ToastItem = ToastInput & { id: number; expiresAt: number };
export const TOAST_DURATION = 6000;
export const ROOT_TOAST_HOST = 'root';

export function addToast(current: ToastItem[], item: ToastItem): ToastItem[] {
  return [item, ...current.filter(previous =>
    previous.kind !== item.kind || previous.title !== item.title || previous.body !== item.body,
  )].slice(0, 3);
}

export function removeToast(current: ToastItem[], id: number): ToastItem[] {
  return current.filter(item => item.id !== id);
}

export function registerHost(current: string[], id: string): string[] {
  return [...current.filter(host => host !== id), id];
}

export function activeHost(hosts: string[]): string {
  return hosts[hosts.length - 1] ?? ROOT_TOAST_HOST;
}
