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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          MISSÃO DE POUPANÇA
        </p>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--accent)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Ver missão →
        </span>
      </div>

      <p
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--text)',
          margin: 0,
          marginBottom: 10,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {mission.name}
      </p>

      <div
        style={{
          height: 6,
          background: 'var(--border-2)',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${barReady ? pct : 0}%`,
            background: 'linear-gradient(90deg, #5B5BD6, #7C7CE8)',
            borderRadius: 3,
            transition: 'width 1s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>

      <p
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-2)',
          margin: 0,
          marginTop: 8,
        }}
      >
        {formatCurrency(totalSaved)} / {formatCurrency(target)} · {Math.round(pct)}%
      </p>

      {streak >= 2 && (
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-2)',
            margin: 0,
            marginTop: 6,
          }}
        >
          🔥 {streak} meses seguidos
        </p>
      )}
    </Link>
  );
}
