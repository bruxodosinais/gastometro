'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { BadgeDef } from './badges';

// Bottom sheet de detalhe de badge. Compartilhado entre /missao/badges
// (página de conquistas) e /missao/dashboard (hub). Quando `badge` é null,
// não renderiza — fica seguro passar o state ainda não definido.

type Props = {
  badge: BadgeDef | null;
  unlockedAt?: string;
  onClose: () => void;
};

export default function BadgeDetailSheet({ badge, unlockedAt, onClose }: Props) {
  useEffect(() => {
    if (!badge) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [badge]);

  if (!badge) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full"
        style={{ maxWidth: 390 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 pt-4 pb-7"
          style={{ background: 'var(--surface)', borderRadius: '24px 24px 0 0' }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-extrabold uppercase tracking-[0.12em]"
              style={{ color: 'var(--accent)' }}
            >
              Badge
            </span>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: 'var(--bg)' }}
            >
              <X size={16} color="var(--text-2)" />
            </button>
          </div>

          <div className="mt-3 flex flex-col items-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-[44px]"
              style={{ background: 'var(--accent-bg)' }}
            >
              {badge.emoji}
            </div>
            <h3 className="mt-3 text-[20px] font-extrabold" style={{ color: 'var(--text)' }}>
              {badge.name}
            </h3>
            <p
              className="mt-2 max-w-[280px] text-center text-[14px] font-medium leading-snug"
              style={{ color: 'var(--text-2)' }}
            >
              {badge.description}
            </p>
            {unlockedAt && (
              <p
                className="mt-3 rounded-full px-3 py-1 text-[11px] font-extrabold"
                style={{ background: 'var(--green-bg)', color: 'var(--green-text)' }}
              >
                Desbloqueado em {new Date(unlockedAt).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
