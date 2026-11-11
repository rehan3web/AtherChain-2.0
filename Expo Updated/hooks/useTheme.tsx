import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '@/constants/colors';

export type ThemeMode = 'light' | 'dark';
export type ThemePreference = ThemeMode | 'system';
export const THEME_STORAGE_KEY = 'atherchain-theme-v1';

type ThemeContextValue = {
  scheme: ThemeMode;
  preference: ThemePreference;
  ready: boolean;
  saving: boolean;
  error: string | null;
  toggleTheme: () => Promise<void>;
  setTheme: (mode: ThemePreference) => Promise<void>;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const scheme: ThemeMode = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void AsyncStorage.getItem(THEME_STORAGE_KEY).then(value => {
      if (cancelled) return;
      if (value === 'light' || value === 'dark' || value === 'system') setPreference(value);
      else if (value !== null) setError('Saved theme could not be read. Choose an appearance again.');
    }).catch(() => {
      if (!cancelled) setError('Could not load your saved theme. You can still change it below.');
    }).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!ready || Platform.OS !== 'web') return;
    document.documentElement.style.colorScheme = scheme;
    document.documentElement.style.backgroundColor = colors[scheme].background;
    document.body.style.backgroundColor = colors[scheme].background;
  }, [ready, scheme]);

  const setTheme = async (next: ThemePreference) => {
    if (!ready || pending.current) return;
    pending.current = true;
    const previous = preference;
    setPreference(next);
    setSaving(true);
    setError(null);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      if (mounted.current) {
        setPreference(previous);
        setError('Could not save your theme. Please try again.');
      }
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const toggleTheme = () => setTheme(scheme === 'dark' ? 'light' : 'dark');

  return <ThemeContext.Provider value={{ scheme, preference, ready, saving, error, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
