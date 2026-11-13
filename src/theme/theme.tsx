import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { prefs } from '@/lib/storage';

import { darkColors, lightColors, type ColorRoles } from './tokens';

// Light and dark from day one (§5.1): follows the system unless the user picks one in Settings.

export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

export type Theme = {
  scheme: Scheme;
  mode: ThemeMode;
  colors: ColorRoles;
  setMode: (mode: ThemeMode) => void;
};

const PREF_KEY = 'theme.mode';

function savedMode(): ThemeMode {
  const value = prefs.getString(PREF_KEY);
  return value === 'light' || value === 'dark' ? value : 'system';
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children, initialMode }: { children: ReactNode; initialMode?: ThemeMode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(() => initialMode ?? savedMode());
  const setMode = useCallback((next: ThemeMode) => {
    if (next === 'system') prefs.remove(PREF_KEY);
    else prefs.set(PREF_KEY, next);
    setModeState(next);
  }, []);

  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo<Theme>(
    () => ({ scheme, mode, colors: scheme === 'dark' ? darkColors : lightColors, setMode }),
    [scheme, mode, setMode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return theme;
}
