'use client';

import { useEffect, useState } from 'react';

export interface StreakData {
  currentStreak: number;
  lastActiveDate: string;
  isNewRecord: boolean;
  bestStreak: number;
}

const KEY_CURRENT = 'streak_current';
const KEY_LAST_DATE = 'streak_last_date';
const KEY_BEST = 'streak_best';

const EMPTY: StreakData = {
  currentStreak: 0,
  lastActiveDate: '',
  isNewRecord: false,
  bestStreak: 0,
};

function formatDate(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function todayStr(): string {
  return formatDate(new Date());
}

function yesterdayStr(): string {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return formatDate(y);
}

function parseIntSafe(v: string | null): number {
  if (!v) return 0;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Roda a lógica de streak contra o localStorage e devolve o estado atualizado.
// Idempotente no mesmo dia: chamar várias vezes só faz uma transição por dia.
function tick(): StreakData {
  if (typeof window === 'undefined') return EMPTY;

  const today = todayStr();
  const yesterday = yesterdayStr();

  const lastDate = localStorage.getItem(KEY_LAST_DATE) || '';
  const prevCurrent = parseIntSafe(localStorage.getItem(KEY_CURRENT));
  const prevBest = parseIntSafe(localStorage.getItem(KEY_BEST));

  let nextCurrent: number;
  if (!lastDate || prevCurrent === 0) {
    nextCurrent = 1;
  } else if (lastDate === today) {
    nextCurrent = prevCurrent;
  } else if (lastDate === yesterday) {
    nextCurrent = prevCurrent + 1;
  } else {
    nextCurrent = 1;
  }

  // Recorde só conta a partir de 2 dias — "novo recorde" no dia 1 é estranho.
  const beatRecord = nextCurrent > prevBest && nextCurrent >= 2;
  const nextBest = Math.max(prevBest, nextCurrent);

  localStorage.setItem(KEY_CURRENT, String(nextCurrent));
  localStorage.setItem(KEY_LAST_DATE, today);
  localStorage.setItem(KEY_BEST, String(nextBest));

  return {
    currentStreak: nextCurrent,
    lastActiveDate: today,
    isNewRecord: beatRecord,
    bestStreak: nextBest,
  };
}

// Versão pura (não-React) — usar em handlers fora de componentes que precisam
// contabilizar o dia de uso (ex.: salvar lançamento sem ter aberto a Home).
export function updateStreakToday(): StreakData {
  return tick();
}

export function useStreak(): StreakData {
  const [data, setData] = useState<StreakData>(EMPTY);

  useEffect(() => {
    setData(tick());
  }, []);

  return data;
}
