'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/calculations';
import { getCachedUser } from '@/lib/dataCache';
import {
  calcStreak,
  getContributions,
  getMission,
  type MissionContribution,
  type SavingsMission,
} from '@/lib/storage/missions';
import { getMissionCoach } from '@/lib/mission/coach';
import { anim, hidden } from './_anim';

type Props = {
  mounted: boolean;
};

export default function MissaoCard({ mounted }: Props) {
  const [mission, setMission] = useState<SavingsMission | null>(null);
  const [contributions, setContributions] = useState<MissionContribution[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Animação da barra: 0 → pct após montar, mesmo padrão do dashboard.
  const [barReady, setBarReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getCachedUser();
        if (!user) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const m = await getMission(user.id);
        if (cancelled) return;
        if (!m) {
          setMission(null);
          setLoaded(true);
          return;
        }
        setMission(m);
        const contribs = await getContributions(m.id);
        if (cancelled) return;
        setContributions(contribs);
        setLoaded(true);
      } catch (err) {
        // Sem catch, qualquer throw em getMission/getContributions deixava
        // loaded=false pra sempre e o card sumia da home (`if (!loaded) return null`).
        // Fallback: trata como "sem missão" e mostra o convite.
        console.error('[home/MissaoCard] falha ao carregar missão:', err);
        if (!cancelled) {
          setMission(null);
          setLoaded(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded || !mission) return;
    const t = setTimeout(() => setBarReady(true), 50);
    return () => clearTimeout(t);
  }, [loaded, mission]);

  // Esconde o card até a primeira leitura terminar. Evita flash do estado
  // "sem missão" pra quem tem missão ativa, e flash invertido.
  if (!loaded) return null;

  // ── Sem missão: card de convite ────────────────────────────────────────
  if (!mission) {
    return (
      <Link
        href="/missao"
        style={{
          margin: '10px 16px 0',
          display: 'block',
          background: 'var(--accent-bg)',
          borderRadius: 'var(--r)',
          padding: '14px 16px',
          textDecoration: 'none',
          ...(mounted ? anim(310) : hidden),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            🎯
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              Crie sua Missão de Poupança
            </p>
            <p
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--text-2)',
                margin: 0,
                marginTop: 2,
                lineHeight: 1.4,
              }}
            >
              Defina uma meta e guarde todo mês
            </p>
          </div>
          <span
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            Começar
          </span>
        </div>
      </Link>
    );
  }

  // ── Missão ativa ───────────────────────────────────────────────────────
  const totalSaved = contributions.reduce((s, c) => s + Number(c.amount), 0);
  const target = Number(mission.targetAmount);
  const pct = target > 0 ? Math.min(100, (totalSaved / target) * 100) : 0;
  const streak = calcStreak(contributions);
  const monthlyTarget = Number(mission.monthlyTarget);
  const remaining = Math.max(0, target - totalSaved);
  const monthsLeft = monthlyTarget > 0 ? Math.ceil(remaining / monthlyTarget) : null;
  const done = pct >= 100;

  // Coach: "check-in" diário — Dia X + mensagem motivacional ligada à meta.
  const coach = getMissionCoach({
    totalSaved,
    target,
    startDate: mission.startDate,
    targetDate: mission.targetDate,
    monthlyTarget,
    status: mission.status,
  });

  return (
    <Link
      href="/missao/dashboard"
      style={{
        margin: '10px 16px 0',
        display: 'block',
        background: 'var(--surface)',
        border: '1px solid rgba(91,91,214,0.25)',
        borderRadius: 'var(--r)',
        padding: '18px 20px',
        boxShadow: 'var(--card-shadow)',
        textDecoration: 'none',
        ...(mounted ? anim(310) : hidden),
      }}
    >
      {/* Topo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Missão de Poupança
          {mission.status === 'active' && (
            <span style={{ color: 'var(--accent)' }}> · Dia {coach.dayOfMission}</span>
          )}
        </p>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Ver missão →
        </span>
      </div>

      {/* Nome + % */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mission.name}
        </p>
        <p style={{ fontSize: 28, fontWeight: 900, color: done ? 'var(--green)' : 'var(--accent)', margin: 0, flexShrink: 0, lineHeight: 1 }}>
          {done ? 'Concluído!' : `${Math.round(pct)}%`}
        </p>
      </div>

      {/* Barra de progresso */}
      <div style={{ height: 6, background: 'var(--border-2)', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${barReady ? pct : 0}%`,
            background: done ? 'var(--green)' : 'var(--accent)',
            borderRadius: 3,
            transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>

      {/* Rodapé */}
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: 0, marginTop: 8 }}>
        {formatCurrency(totalSaved)} / {formatCurrency(target)}
      </p>
      {!done && monthlyTarget > 0 && monthsLeft !== null && monthsLeft > 0 && (
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', margin: 0, marginTop: 4 }}>
          Guarde {formatCurrency(monthlyTarget)}/mês · falta {monthsLeft} {monthsLeft === 1 ? 'mês' : 'meses'}
        </p>
      )}
      {streak >= 2 && (
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', margin: 0, marginTop: 4 }}>
          🔥 {streak} meses seguidos
        </p>
      )}

      {/* Coach: mensagem motivacional ligada à meta (check-in diário). */}
      <p
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
          marginTop: 10,
          padding: '8px 10px',
          background: 'var(--accent-bg)',
          borderRadius: 'var(--r-sm)',
          lineHeight: 1.45,
        }}
      >
        {coach.message}
      </p>
    </Link>
  );
}
