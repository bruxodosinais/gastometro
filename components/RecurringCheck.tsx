'use client';

import { useEffect } from 'react';
import { checkAndLaunchRecurring } from '@/lib/storage';

export default function RecurringCheck() {
  useEffect(() => {
    checkAndLaunchRecurring();
  }, []);
  return null;
}
