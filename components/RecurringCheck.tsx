'use client';

import { useEffect } from 'react';
import { checkAndGenerateObligations, recordActivityToday } from '@/lib/storage';

export default function RecurringCheck() {
  useEffect(() => {
    checkAndGenerateObligations();
    // Streak de acesso: conta o dia em qualquer página autenticada, não só a Home.
    recordActivityToday();
  }, []);
  return null;
}
