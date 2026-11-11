import { createContext, useContext } from 'react';
import type { ToastInput } from './toast-model';

export type ToastActions = {
  showToast: (input: ToastInput) => number;
  dismissToast: (id: number) => void;
  dismissAll: () => void;
  register: (id: string) => void;
  unregister: (id: string) => void;
  pause: (paused: boolean) => void;
};
export const ActionsContext = createContext<ToastActions | null>(null);

export function useToast() {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error('useToast must be used inside ToastProvider');
  return actions;
}
