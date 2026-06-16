'use client';

import { X } from 'lucide-react';
import FreezeIcon from '@/components/FreezeIcon';

interface Props {
  open: boolean;
  freezes: number;
  onClose: () => void;
}

// Sheet INFORMATIVO do Streak Freeze (abre ao tocar no contador 🧊). Sem compra:
// o freeze é ganho 1x por semana e consumido automaticamente pra salvar a
// ofensiva. A moeda foi aposentada.
export default function StreakFreezeSheet({ open, freezes, onClose }: Props) {
  if (!open) return null;

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
                Protege 1 dia da sua ofensiva
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
            margin: '18px 0 0',
            fontSize: 13,
            color: 'var(--text-2)',
          }}
        >
          <span>Você tem</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
            <FreezeIcon size={15} /> {freezes} / 2
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '12px 0 0', lineHeight: 1.5 }}>
          Você ganha <strong>1 freeze grátis toda semana</strong> (até 2 guardados). Se você perder
          um dia, ele é usado automaticamente pra manter sua ofensiva viva. 🔥
        </p>
      </div>
    </div>
  );
}
