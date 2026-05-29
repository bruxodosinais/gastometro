'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  formatCurrency,
  getCategoryAlerts,
  getMonthKey,
  CATEGORY_ANOMALY_THRESHOLD,
} from '@/lib/calculations';
import { getExpenses } from '@/lib/storage';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import type { CategorySummary } from '@/lib/types';
import { anim, hidden } from './_anim';

type Props = { mounted: boolean };

const YELLOW = '#FFB800';
const RED = '#FF4757';

// Limiar mais alto que /categorias (>5%) e que isAlert (>20%): só anomalias
// reais de gasto entram no card proativo da Home. Centralizado em lib/calculations.

export default function AnomaliaCard({ mounted }: Props) {
  const { categories: customs } = useCustomCategories();
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

  if (!loaded) {
    return (
      <div
        className="skeleton"
        style={{ margin: '10px 16px 0', height: 80, borderRadius: 16 }}
      />
    );
  }

  if (!anomaly) return null;

  const { icon } = getCategoryDisplay(anomaly.category, customs);

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
              fontWeight: 700,
              color: '#7A5B00',
              margin: '6px 0 0',
              lineHeight: 1.3,
            }}
          >
            {icon} {anomaly.category}{' '}
            <span style={{ color: RED, fontWeight: 800 }}>
              +{Math.round(anomaly.percentChange)}% acima da média
            </span>
          </p>

          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#8A6D1F',
              margin: '6px 0 0',
              lineHeight: 1.4,
            }}
          >
            Você gastou {formatCurrency(anomaly.total)} em {anomaly.category} este
            mês. Sua média é {formatCurrency(anomaly.average)}.
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
