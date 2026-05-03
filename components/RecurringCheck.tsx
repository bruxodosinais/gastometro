'use client';

import { useEffect } from 'react';
import { checkAndGenerateObligations } from '@/lib/storage';

export default function RecurringCheck() {
  useEffect(() => {
    checkAndGenerateObligations();
  }, []);
  return null;
}
