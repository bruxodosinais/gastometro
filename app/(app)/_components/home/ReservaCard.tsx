'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/calculations';
import { getGoals } from '@/lib/storage';
import { getCachedUser } from '@/lib/dataCache';
import { getMission, type SavingsMission } from '@/lib/storage/missions';
import { getMonthlyBaseCost, type MonthlyBaseCost } from '@/lib/emergencyFund';
import type { Goal } from '@/lib/types';
import { anim, hidden } from './_anim';

type Props = { mounted: boolean };
type Multiplier = 3 | 6 | 12;

const ACCENT = '#5B5BD6';

export default function ReservaCard({ mounted }: Props) {
  const [baseCost, setBaseCost] = useState<MonthlyBaseCost | null>(null);
  const [reservaGoal, setReservaGoal] = useState<Goal | null>(null);
  const [mission, setMission] = useState<SavingsMission | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [multiplier, setMultiplier] = useState<Multiplier>(6);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCachedUser();
        if (!user) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const [base, goals, m] = await Promise.all([
          getMonthlyBaseCost(),
          getGoals(),
          getMission(user.id),
        ]);
        if (cancelled) return;
        setBaseCost(base);
        const reserva = goals.find(
          (g) => g.type === 'reserva' && g.status === 'active',
        );
        setReservaGoal(reserva ?? null);
        setMission(m);
      } catch (err) {
        // Fallback silencioso pra não derrubar a Home se a leitura quebrar —
        // se não dá pra calcular, o card simplesmente não aparece.
        console.error('[home/ReservaCard]:', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Esconde até a primeira leitura terminar (mesma estratégia do MissaoCard
  // para evitar flash entre estados).
  if (!loaded) return null;
  if (!baseCost || baseCost.source === 'none') return null;

  // ── Estado C — meta de reserva ativa ─────────────────────────────────────
  if (reservaGoal) {
    const reserva6x = baseCost.monthlyBase * 6;
    const pct = reserva6x > 0
      ? Math.min(100, (reservaGoal.currentAmount / reserva6x) * 100)
      : 0;
    const isComplete = pct >= 100;
    const remaining = Math.max(0, reserva6x - reservaGoal.currentAmount);

    return (
      <Link
        href="/metas"
        style={{
          margin: '10px 16px 0',
          display: 'block',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${ACCENT}`,
          borderRadius: 'var(--r)',
          padding: '18px 20px',
          boxShadow: 'var(--card-shadow)',
          textDecoration: 'none',
          ...(mounted ? anim(330) : hidden),
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 18 }}>🛡️</span>
            <p
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--text)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Reserva de Emergência
            </p>
          </div>
          {isComplete ? (
            <span
              style={{
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 20,
                background: 'var(--green-bg)',
                color: 'var(--green)',
                border: '1px solid rgba(0,195,122,0.25)',
                whiteSpace: 'nowrap',
              }}
            >
              ✅ Completa!
            </span>
          ) : (
            <span
              style={{
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 700,
                color: ACCENT,
                whiteSpace: 'nowrap',
              }}
            >
              Ver meta →
            </span>
          )}
        </div>

        <div
          style={{
            height: 6,
            background: 'var(--border-2)',
            borderRadius: 3,
            overflow: 'hidden',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: isComplete
                ? 'var(--green)'
                : 'linear-gradient(90deg, #5B5BD6, #7C7CE8)',
              borderRadius: 3,
              transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: 0 }}>
            {formatCurrency(reservaGoal.currentAmount)} de {formatCurrency(reserva6x)}
          </p>
          <p style={{ fontSize: 13, fontWeight: 800, color: ACCENT, margin: 0 }}>
            {Math.round(pct)}%
          </p>
        </div>

        <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', margin: 0 }}>
          {isComplete
            ? '🎉 Parabéns! Sua reserva já cobre 6 meses de despesas.'
            : `Faltam ${formatCurrency(remaining)} para completar`}
        </p>
      </Link>
    );
  }

  // Supressão: se já existe missão ativa com 'reserva' no nome, o user já
  // está no fluxo principal de reserva (MissaoCard cobre). Estado C acima
  // tem prioridade — quem tem goal type='reserva' continua vendo progresso.
  if (mission && mission.name.toLowerCase().includes('reserva')) return null;

  // ── Estado B — sem meta de reserva ───────────────────────────────────────
  const suggested = baseCost.monthlyBase * multiplier;
  const sourceLabel =
    baseCost.source === 'recurring'
      ? `Baseado em ${baseCost.recurringCount} ${
          baseCost.recurringCount === 1 ? 'despesa recorrente' : 'despesas recorrentes'
        }`
      : 'Estimado pela média dos últimos 3 meses';

  return (
    <div
      style={{
        margin: '10px 16px 0',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${ACCENT}`,
        borderRadius: 'var(--r)',
        padding: '18px 20px',
        boxShadow: 'var(--card-shadow)',
        ...(mounted ? anim(330) : hidden),
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 18 }}>🛡️</span>
          <p
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--text)',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Reserva de Emergência
          </p>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: 20,
            background: 'rgba(91,91,214,0.12)',
            color: ACCENT,
            border: '1px solid rgba(91,91,214,0.25)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}
        >
          Recomendado
        </span>
      </div>

      <p
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: 'var(--text)',
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {formatCurrency(suggested)}
      </p>
      <p
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-2)',
          margin: 0,
          marginTop: 2,
        }}
      >
        {multiplier}x seu custo mensal de {formatCurrency(baseCost.monthlyBase)}
      </p>

      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {([3, 6, 12] as Multiplier[]).map((m) => {
          const active = m === multiplier;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMultiplier(m)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 700,
                border: active ? `1.5px solid ${ACCENT}` : '1px solid var(--border)',
                background: active ? 'rgba(91,91,214,0.10)' : 'var(--bg)',
                color: active ? ACCENT : 'var(--text-2)',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {m} meses{active ? ' ✓' : ''}
            </button>
          );
        })}
      </div>

      <p
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-3)',
          margin: 0,
          marginTop: 10,
        }}
      >
        {sourceLabel}
      </p>

      <Link
        href="/missao"
        style={{
          display: 'block',
          marginTop: 14,
          padding: '12px 0',
          borderRadius: 'var(--r-sm)',
          background: ACCENT,
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          textAlign: 'center',
          textDecoration: 'none',
          touchAction: 'manipulation',
        }}
      >
        Criar missão de reserva
      </Link>
      <p
        style={{
          fontSize: 11,
          color: 'var(--text-3)',
          margin: 0,
          marginTop: 8,
          textAlign: 'center',
        }}
      >
        Acompanhe mês a mês com metas e desafios
      </p>
    </div>
  );
}
