'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '@/lib/themeContext';

export type ThemeColors = {
  accent: string;
  green: string;
  red: string;
  yellow: string;
  text: string;
  text2: string;
  text3: string;
  border: string;
  border2: string;
  surface: string;
  bg: string;
};

// Defaults do tema claro — usados no SSR/primeira renderização antes do
// useEffect ler os valores reais. Sempre são sobrescritos no client.
const DEFAULT_LIGHT: ThemeColors = {
  accent: '#5B5BD6',
  green: '#00C37A',
  red: '#FF4757',
  yellow: '#FFB800',
  text: '#1A1A1A',
  text2: '#6B6B6B',
  text3: '#B4B4AA',
  border: '#E8E8E2',
  border2: '#F0F0EA',
  surface: '#FFFFFF',
  bg: '#F7F7F5',
};

function readColors(): ThemeColors {
  if (typeof window === 'undefined') return DEFAULT_LIGHT;
  const cs = getComputedStyle(document.documentElement);
  const g = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;
  return {
    accent: g('--accent', DEFAULT_LIGHT.accent),
    green: g('--green', DEFAULT_LIGHT.green),
    red: g('--red', DEFAULT_LIGHT.red),
    yellow: g('--yellow', DEFAULT_LIGHT.yellow),
    text: g('--text', DEFAULT_LIGHT.text),
    text2: g('--text-2', DEFAULT_LIGHT.text2),
    text3: g('--text-3', DEFAULT_LIGHT.text3),
    border: g('--border', DEFAULT_LIGHT.border),
    border2: g('--border-2', DEFAULT_LIGHT.border2),
    surface: g('--surface', DEFAULT_LIGHT.surface),
    bg: g('--bg', DEFAULT_LIGHT.bg),
  };
}

/**
 * Resolve as cores do tema em runtime — necessário pq recharts pinta SVG via
 * atributo `fill`/`stroke`, que (de forma confiável) não aceita `var(--token)`
 * em todos os browsers. Re-lê quando o tema troca via ThemeProvider.
 */
export function useThemeColors(): ThemeColors {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_LIGHT);

  useEffect(() => {
    // rAF garante leitura DEPOIS que o data-theme já foi aplicado no html.
    const id = requestAnimationFrame(() => setColors(readColors()));
    return () => cancelAnimationFrame(id);
  }, [resolvedTheme]);

  return colors;
}
