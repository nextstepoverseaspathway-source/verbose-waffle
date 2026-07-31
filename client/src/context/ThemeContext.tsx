/**
 * Theme provider — manages light/dark/system preference and reflects it on
 * the document root via `data-theme`, which the CSS variables key off.
 */
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'sst_theme';

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemeMode) ?? 'system',
  );
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const apply = () => {
      const r = mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
      setResolved(r);
      document.documentElement.setAttribute('data-theme', r);
    };
    apply();

    // React to OS changes while in "system" mode.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => mode === 'system' && apply();
    mq.addEventListener?.('change', listener);
    return () => mq.removeEventListener?.('change', listener);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, m);
    setModeState(m);
  };

  const toggle = () => setMode(resolved === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
