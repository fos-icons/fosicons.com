import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useClientValue } from './hydration';

export type SiteTheme = 'light' | 'dark' | 'ivory';
export type ThemePreference = 'system' | SiteTheme;
const KEY = 'fos-theme';

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'light' || value === 'dark' || value === 'ivory' ? value : 'system';
  } catch {
    return 'system';
  }
}


interface ThemeValue {
  preference: ThemePreference;
  resolved: SiteTheme;
  setPreference: (value: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The page was prerendered for the system theme; the inline script in
  // index.html has already applied the saved one to <html> before paint.
  const saved = useClientValue(readPreference, 'system');
  const [chosen, setPref] = useState<ThemePreference | null>(null);
  const preference = chosen ?? saved;
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  // True only for the render that hydrates prerendered HTML, whose theme is a
  // placeholder: leave <html> as the inline script set it until the real one.
  const hydrating = useClientValue(() => false, true);
  useEffect(() => {
    if (hydrating) return;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.classList.toggle('ivory', resolved === 'ivory');
  }, [resolved, hydrating]);

  const setPreference = useCallback((value: ThemePreference) => {
    setPref(value);
    try {
      if (value === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      // Storage may be blocked; the choice still applies for this visit.
    }
  }, []);

  const value = useMemo(() => ({ preference, resolved, setPreference }), [preference, resolved, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}

/** Whether a media query matches; false in the prerendered HTML (and while hydrating it). */
export function useMediaQuery(query: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return useClientValue(() => window.matchMedia(query).matches, false, subscribe);
}
