'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getCategoryAlerts,
  getMonthKey,
  CATEGORY_ANOMALY_THRESHOLD,
} from '@/lib/calculations';
import { getExpenses } from '@/lib/storage';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import type { CategorySummary } from '@/lib/types';
import { coachAnomaly } from '@/lib/insights/coach';
import { useMissionContext } from '@/lib/insights/useMissionContext';
import { anim, hidden } from './_anim';

type Props = { mounted: boolean };

const YELLOW = '#FFB800';

// Limiar mais alto que /categorias (>5%) e que isAlert (>20%): só anomalias
// reais de gasto entram no card proativo da Home. Centralizado em lib/calculations.

export default function AnomaliaCard({ mounted }: Props) {
  const { categories: customs } = useCustomCategories();
  const { context: mission, loading: missionLoading } = useMissionContext();
  const [anomaly, setAnomaly] = useState<CategorySummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const expenses = await getExpenses();
        if (cancelled) return;
        const top = getCategoryAlerts(expenses, getMonthKey(new Date()))
          .filter((a) => a.isAlert && a.percentChange > CATEGORY_ANOMALY_THRESHOLD)
          .sort((a, b) => b.percentChange - a.percentChange)[0];
        setAnomaly(top ?? null);
      } catch (err) {
        // Falha silenciosa: se não dá pra calcular, o card só não aparece.
        console.error('[home/AnomaliaCard]:', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Segura o card até a anomalia E o contexto de Missão resolverem — assim a
  // linha de coach já assenta na copy certa (sem piscar "que tal uma Missão?"
  // pra quem tem missão).
  if (!loaded || missionLoading) {
    return (
      <div
        className="skeleton"
        style={{ margin: '10px 16px 0', height: 80, borderRadius: 16 }}
      />
    );
  }

  if (!anomaly) return null;

  const { icon } = getCategoryDisplay(anomaly.category, customs);
  const coach = coachAnomaly({
    category: anomaly.category,
    icon,
    total: anomaly.total,
    average: anomaly.average,
    percentChange: anomaly.percentChange,
    mission,
  });

  return (
    <div
      style={{
        margin: '10px 16px 0',
        background: '#FFFBEB',
        border: `1px solid ${YELLOW}`,
        borderLeft: `3px solid ${YELLOW}`,
        borderRadius: 16,
        padding: '14px 16px',
        ...(mounted ? anim(420) : hidden),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            background: '#FFF8E6',
            border: `1px solid ${YELLOW}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 15,
          }}
        >
          ⚠️
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: '#7A5B00',
              margin: 0,
            }}
          >
            Gasto acima do normal
          </p>

          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#7A5B00',
              margin: '6px 0 0',
              lineHeight: 1.4,
            }}
          >
            {coach.emoji} {coach.message}
          </p>

          <Link
            href={`/historico?categoria=${encodeURIComponent(anomaly.category)}`}
            style={{
              display: 'inline-block',
              marginTop: 10,
              fontSize: 13,
              fontWeight: 700,
              color: '#7A5B00',
              textDecoration: 'none',
            }}
          >
            Ver lançamentos →
          </Link>
        </div>
      </div>
    </div>
  );
}
