'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import ConfettiAnimation from './ConfettiAnimation';
import { BADGE_BY_KEY } from './badges';

export type MilestoneKind = 25 | 50 | 100;

type Props = {
  open: boolean;
  kind: MilestoneKind;
  // badgeKey opcional: 25% pode não ter badge visível na grid pública,
  // mas pode ter um interno (`primeiro_quarto`). 50% e 100% têm badge fixo.
  badgeKey?: string;
  onClose: () => void;
};

const MESSAGES: Record<MilestoneKind, { title: string; sub: string }> = {
  25: { title: 'Primeiro quarto!', sub: 'Você passou de 25%. O hábito tá pegando.' },
  50: { title: 'Você chegou na metade! 🎉', sub: 'De agora pra frente é descida.' },
  100: { title: 'Meta atingida! 🏆', sub: 'Missão cumprida. Bora a próxima?' },
};

export default function MilestoneModal({ open, kind, badgeKey, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const msg = MESSAGES[kind];
  const badge = badgeKey ? BADGE_BY_KEY[badgeKey] : undefined;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center"
      style={{ background: 'rgba(20,20,30,0.92)' }}
      onClick={onClose}
    >
      <ConfettiAnimation />

      <div
        className="relative mx-5 flex w-full flex-col items-center px-6 py-8"
        style={{
          maxWidth: 340,
          background: 'var(--surface)',
          borderRadius: 24,
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-center rounded-full milestone-trophy"
          style={{
            width: 96,
            height: 96,
            background: 'linear-gradient(160deg, #FFD86B, #FFB800)',
          }}
        >
          <Trophy size={48} color="white" strokeWidth={2.4} />
        </div>

        <h2
          className="mt-5 text-center text-[22px] font-extrabold leading-tight"
          style={{ color: 'var(--text)' }}
        >
          {msg.title}
        </h2>
        <p
          className="mt-1 text-center text-[14px] font-medium"
          style={{ color: 'var(--text-2)' }}
        >
          {msg.sub}
        </p>

        {badge && (
          <div
            className="mt-5 flex w-full items-center gap-3 rounded-2xl p-4"
            style={{ background: 'var(--accent-bg)', borderRadius: 'var(--r)' }}
          >
            <span className="text-[32px] leading-none">{badge.emoji}</span>
            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-extrabold uppercase tracking-[0.12em]"
                style={{ color: 'var(--accent)' }}
              >
                Badge desbloqueado
              </p>
              <p className="text-[15px] font-extrabold" style={{ color: 'var(--text)' }}>
                {badge.name}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-extrabold text-white transition active:scale-[0.98]"
          style={{
            background: 'var(--accent)',
            borderRadius: 'var(--r)',
            boxShadow: '0 6px 20px var(--accent-shadow)',
          }}
        >
          Continuar minha missão
        </button>

        <Link
          href="/missao/compartilhar"
          className="mt-3 text-[13px] font-bold underline"
          style={{ color: 'var(--accent)' }}
        >
          Compartilhar conquista
        </Link>
      </div>

      <style>{`
        .milestone-trophy {
          box-shadow: 0 0 0 0 rgba(255,184,0,0.55);
          animation: milestonePulse 1.8s ease-in-out infinite;
        }
        @keyframes milestonePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,184,0,0.55), 0 8px 30px rgba(255,184,0,0.45); transform: scale(1); }
          50%      { box-shadow: 0 0 0 16px rgba(255,184,0,0), 0 12px 36px rgba(255,184,0,0.55); transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
