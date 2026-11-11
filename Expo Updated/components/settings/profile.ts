import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_USER } from '@/components/wallet';

/* Device-local, non-sensitive display profile. Never store credentials here. */
export type Profile = { name: string; username: string };
type State = { profile: Profile; loading: boolean; error: string | null };

const KEY = 'atherchain.profile.v1';
export const DEFAULT_PROFILE: Profile = { name: DEFAULT_USER.name, username: 'atherchain_demo' };
export const NAME_MAX = 40;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

export type ProfileErrors = { name?: string; username?: string };

export function normalizeProfile(input: Profile): Profile {
  return {
    name: input.name.trim().replace(/\s+/g, ' '),
    username: input.username.trim().replace(/^@/, '').toLowerCase(),
  };
}

export function validateProfile(input: Profile): ProfileErrors {
  const p = normalizeProfile(input);
  const e: ProfileErrors = {};
  if (!p.name) e.name = 'Name cannot be blank.';
  else if (p.name.length > NAME_MAX) e.name = `Keep it under ${NAME_MAX} characters.`;
  if (!p.username) e.username = 'Username cannot be blank.';
  else if (p.username.length < USERNAME_MIN || p.username.length > USERNAME_MAX)
    e.username = `Use ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  else if (!/^[a-z0-9_.]+$/.test(p.username)) e.username = 'Letters, numbers, dots and underscores only.';
  return e;
}

let state: State = { profile: DEFAULT_PROFILE, loading: true, error: null };
const listeners = new Set<() => void>();
const emit = (next: Partial<State>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

let started = false;
function load() {
  if (started) return;
  started = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return emit({ loading: false });
      const parsed = JSON.parse(raw) as Partial<Profile>;
      const candidate = { name: String(parsed?.name ?? ''), username: String(parsed?.username ?? '') };
      if (Object.keys(validateProfile(candidate)).length) {
        return emit({ loading: false, error: 'Your saved profile is invalid. Please edit and save it again.' });
      }
      emit({ profile: normalizeProfile(candidate), loading: false, error: null });
    })
    .catch(() => emit({ loading: false, error: 'Could not read your saved profile. Showing defaults.' }));
}

function subscribe(l: () => void) {
  listeners.add(l);
  load();
  return () => listeners.delete(l);
}
const snapshot = () => state;

export function useProfile(): State {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export async function saveProfile(input: Profile): Promise<void> {
  const errs = validateProfile(input);
  const first = errs.name ?? errs.username;
  if (first) throw new Error(first);
  const p = normalizeProfile(input);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    throw new Error('Could not save on this device. Try again.');
  }
  emit({ profile: p, error: null });
}
