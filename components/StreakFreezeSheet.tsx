'use client';

import { X } from 'lucide-react';
import CoinIcon from '@/components/CoinIcon';
import FreezeIcon from '@/components/FreezeIcon';
import { FREEZE_COST } from '@/lib/gamification/freezes';

interface Props {
  open: boolean;
  freezes: number;
  coinBalance: number;
  buying: boolean;
  onClose: () => void;
  onBuy: () => void;
}

// Ponto de compra MÍNIMO do Streak Freeze (a loja completa é o Item 6).
// Abre ao tocar no contador 🧊 na Home. Botão desabilita com texto explicando
// quando já está no máximo (2) ou sem saldo (< 50).
export default function StreakFreezeSheet({
  open,
  freezes,
  coinBalance,
  buying,
  onClose,
  onBuy,
}: Props) {
  if (!open) return null;

  const atMax = freezes >= 2;
  const noCoins = coinBalance < FREEZE_COST;
  const disabled = buying || atMax || noCoins;

  const label = atMax
    ? 'Máximo atingido (2)'
    : noCoins
    ? 'Saldo insuficiente'
    : buying
    ? 'Comprando…'
    : 'Comprar';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      style={{ padding: 16 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: 24,
          boxShadow: 'var(--card-shadow)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'rgba(56,168,216,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FreezeIcon size={24} />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                Streak Freeze
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '2px 0 0' }}>
                Protege 1 dia do seu streak
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            margin: '18px 0 4px',
            fontSize: 13,
            color: 'var(--text-2)',
          }}
        >
          <span>Você tem</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <FreezeIcon size={15} /> {freezes} / 2
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: 'var(--text-2)',
          }}
        >
          <span>Custo</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <CoinIcon size={15} /> {FREEZE_COST}
          </span>
        </div>

        <button
          type="button"
          onClick={onBuy}
          disabled={disabled}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '12px 18px',
            borderRadius: 'var(--r-sm)',
            border: 'none',
            background: disabled ? 'var(--border-2)' : 'var(--accent)',
            color: disabled ? 'var(--text-3)' : '#fff',
            fontSize: 14,
            fontWeight: 800,
            cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {!disabled && <CoinIcon size={16} />}
          {label}
        </button>
      </div>
    </div>
  );
}
