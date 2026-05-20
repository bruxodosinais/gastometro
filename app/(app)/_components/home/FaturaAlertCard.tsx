'use client';

import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import { anim, hidden } from './_anim';

type Props = {
  pendingTotal: number;
  pendingCount: number;
  mounted: boolean;
  onClick: () => void;
};

export default function FaturaAlertCard({ pendingTotal, pendingCount, mounted, onClick }: Props) {
  return (
    <div
      style={{
        margin: '10px 16px 0',
        background: 'var(--yellow-bg)',
        border: '1.5px solid rgba(255,184,0,0.25)',
        borderRadius: 'var(--r-sm)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        ...(mounted ? anim(250) : hidden),
      }}
      onClick={onClick}
    >
      <div
        style={{
          width: 32,
          height: 32,
          background: 'rgba(255,184,0,0.15)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ⚠️
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--yellow-text)',
            margin: 0,
          }}
        >
          {formatCurrency(pendingTotal)} pra pagar ainda
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
          {pendingCount} conta
          {pendingCount > 1 ? 's' : ''} aguarda
          {pendingCount > 1 ? 'm' : ''} confirmação
        </p>
      </div>
      <ChevronRight size={14} color="var(--yellow)" style={{ flexShrink: 0 }} />
    </div>
  );
}
