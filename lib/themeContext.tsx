'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (next: Theme) => void;
  resolvedTheme: ResolvedTheme;
};

const STORAGE_KEY = 'theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

// Sem nada salvo o padrão é CLARO (não 'system'): o onboarding é claro fixo e o app
// escurecia logo depois em quem tem o SO no escuro. 'system' segue válido se salvo.
function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'light';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  if (theme === 'system') html.removeAttribute('data-theme');
  else html.setAttribute('data-theme', theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR: começa no padrão claro, igual ao que o script anti-FOUC do layout já
  // aplicou no <html>; o useEffect abaixo ajusta pra preferência salva.
  const [theme, setThemeState] = useState<Theme>('light');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');

  // Carrega tema persistido + system preference no mount.
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    setSystemTheme(getSystemTheme());
    applyTheme(stored);

    document.documentElement.style.transition =
      'background-color 0.2s ease, color 0.2s ease';

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage indisponível (modo privado, quota cheia) — segue sem persistir.
    }
    applyTheme(next);
  }, []);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
