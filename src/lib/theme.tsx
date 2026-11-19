import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

const media = () => window.matchMedia('(prefers-color-scheme: dark)');

interface ThemeValue {
  preference: ThemePreference;
  resolved: SiteTheme;
  setPreference: (value: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<ThemePreference>(readPreference);
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && media().matches);

  useEffect(() => {
    const query = media();
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.classList.toggle('ivory', resolved === 'ivory');
  }, [resolved]);

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

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
