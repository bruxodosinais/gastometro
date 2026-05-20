'use client';

import { formatCurrency } from '@/lib/calculations';

type Props = {
  activeCount: number;
  totalMonthlyAmount: number;
};

export default function RecorrentesStats({ activeCount, totalMonthlyAmount }: Props) {
  return (
    <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
      {activeCount} recorrentes
      {totalMonthlyAmount > 0 && ` · ${formatCurrency(totalMonthlyAmount)} total`}
    </p>
  );
}
