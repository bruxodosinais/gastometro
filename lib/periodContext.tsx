'use client';

import { createContext, useContext, useState } from 'react';
import { getMonthKey } from './calculations';

type PeriodContextType = {
  period: string; // 'YYYY-MM'
  setPeriod: (p: string) => void;
};

export const PeriodContext = createContext<PeriodContextType>({
  period: '',
  setPeriod: () => {},
});

export function usePeriod() {
  return useContext(PeriodContext);
}

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [period, setPeriod] = useState(() => getMonthKey(new Date()));
  return (
    <PeriodContext.Provider value={{ period, setPeriod }}>
      {children}
    </PeriodContext.Provider>
  );
}
