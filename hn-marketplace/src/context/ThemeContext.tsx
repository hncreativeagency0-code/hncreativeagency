import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
interface ThemeCtx { mode: ThemeMode; isDark: boolean; setMode: (m: ThemeMode) => void; toggle: () => void }
const Ctx = createContext<ThemeCtx>(null!);

// Respect a host page's explicit theme (data-theme on <html>) before the OS preference
const systemDark = () => {
  const host = document.documentElement.getAttribute('data-theme');
  return host ? host === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try { return (localStorage.getItem('hn-theme') as ThemeMode) || 'system'; } catch { return 'system'; }
  });
  const [isDark, setIsDark] = useState(() => (mode === 'system' ? systemDark() : mode === 'dark'));

  useEffect(() => {
    const apply = () => {
      const dark = mode === 'system' ? systemDark() : mode === 'dark';
      setIsDark(dark);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem('hn-theme', m); } catch { /* storage blocked */ }
  };

  return <Ctx.Provider value={{ mode, isDark, setMode, toggle: () => setMode(isDark ? 'light' : 'dark') }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
