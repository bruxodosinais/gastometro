'use client';

import { useMemo, useState } from 'react';
import { Check, X, Sparkles, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSubscription } from '@/hooks/useSubscription';

type Cycle = 'monthly' | 'annual';

const PRO_FEATURES = [
  'Lançamentos ilimitados',
  'Recorrentes ilimitados',
  'GastôBot ilimitado',
  'Metas financeiras',
  'Controle de patrimônio',
  'Cartões de crédito',
  'Suporte prioritário',
];

const FREE_LIMITATIONS = [
  'Apenas 20 lançamentos/mês',
  'Apenas 5 recorrentes',
  '1 consulta no GastôBot/mês',
  'Sem metas financeiras',
  'Sem controle de patrimônio',
  'Sem cartões de crédito',
];

function formatDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function UpgradePage() {
  const { isPro, billingCycle, currentPeriodEnd, status, loading } = useSubscription();
  const [cycle, setCycle] = useState<Cycle>('annual');

  const monthlyUrl = process.env.NEXT_PUBLIC_KIWIFY_CHECKOUT_MONTHLY ?? '#';
  const annualUrl = process.env.NEXT_PUBLIC_KIWIFY_CHECKOUT_ANNUAL ?? '#';

  const checkoutUrl = cycle === 'monthly' ? monthlyUrl : annualUrl;
  const priceLabel = cycle === 'monthly' ? 'R$ 19,90/mês' : 'R$ 147,00/ano';
  const ctaLabel = cycle === 'monthly' ? 'Assinar por R$ 19,90/mês' : 'Assinar por R$ 147,00/ano';

  const annualSavings = useMemo(() => {
    const monthlyCost = 19.9 * 12;
    const annualCost = 147;
    return Math.round(((monthlyCost - annualCost) / monthlyCost) * 100);
  }, []);

  if (loading) {
    return (
      <main style={{ padding: 24, minHeight: '70vh', display: 'grid', placeItems: 'center' }}>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Carregando…</p>
      </main>
    );
  }

  if (isPro) {
    return (
      <main className="max-w-lg mx-auto px-4 pt-8 pb-24" style={{ background: 'var(--bg)' }}>
        <Link
          href="/perfil"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--text-3)',
            fontSize: 13,
            fontWeight: 600,
            textDecoration: 'none',
            marginBottom: 16,
          }}
        >
          <ArrowLeft size={14} />
          Voltar
        </Link>

        <div
          style={{
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: 24,
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: '0.05em',
              marginBottom: 12,
            }}
          >
            <Sparkles size={12} /> PRO ATIVO
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', margin: 0, marginBottom: 6 }}>
            Você é Pro 🚀
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, marginBottom: 18 }}>
            Aproveite todos os recursos sem limites.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row label="Status" value={status === 'active' ? 'Ativa' : status === 'past_due' ? 'Pagamento pendente' : 'Cancelada'} />
            <Row label="Cobrança" value={billingCycle === 'annual' ? 'Anual' : billingCycle === 'monthly' ? 'Mensal' : '—'} />
            <Row label="Próxima renovação" value={formatDate(currentPeriodEnd)} />
          </div>

          <p style={{ marginTop: 20, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
            Para cancelar ou alterar dados de pagamento, acesse o portal do cliente da Kiwify usando o e-mail da compra.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 pt-8 pb-24" style={{ background: 'var(--bg)' }}>
      <Link
        href="/perfil"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--text-3)',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} />
        Voltar
      </Link>

      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--text)', margin: 0, marginBottom: 6 }}>
          Seja Pro 🚀
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0 }}>
          Controle total das suas finanças
        </p>
      </div>

      {/* Toggle cycle */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 4,
          borderRadius: 'var(--r-sm)',
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          marginBottom: 24,
        }}
      >
        <CycleButton active={cycle === 'monthly'} onClick={() => setCycle('monthly')} label="Mensal" />
        <CycleButton
          active={cycle === 'annual'}
          onClick={() => setCycle('annual')}
          label="Anual"
          badge={`${annualSavings}% off`}
        />
      </div>

      {/* Free card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: 18,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Free <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)' }}>(atual)</span>
          </h2>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-2)' }}>R$ 0</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FREE_LIMITATIONS.map((line) => (
            <li key={line} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: 'var(--red-bg)',
                  color: 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <X size={11} />
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pro card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '2px solid var(--accent)',
          borderRadius: 'var(--r)',
          padding: 22,
          marginBottom: 18,
          boxShadow: '0 8px 24px rgba(91,91,214,0.18)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: 22,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.06em',
          }}
        >
          <Sparkles size={11} /> RECOMENDADO
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', margin: 0 }}>Pro</h2>
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>{priceLabel}</span>
        </div>
        {cycle === 'annual' && (
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', margin: 0, marginBottom: 12 }}>
            Equivale a R$ 12,25/mês • Economize {annualSavings}%
          </p>
        )}
        <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PRO_FEATURES.map((line) => (
            <li key={line} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--green-bg)',
                  color: 'var(--green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Check size={12} />
              </span>
              <span style={{ fontSize: 13.5, color: 'var(--text)', fontWeight: 700 }}>{line}</span>
            </li>
          ))}
        </ul>

        <a
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 20,
            padding: 14,
            borderRadius: 'var(--r-sm)',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(91,91,214,0.28)',
          }}
        >
          <Sparkles size={16} />
          {ctaLabel}
        </a>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-3)',
        }}
      >
        <ShieldCheck size={13} />
        Cancele quando quiser • Pagamento seguro via Kiwify
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 800 }}>{value}</span>
    </div>
  );
}

function CycleButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        position: 'relative',
        padding: '10px 0',
        borderRadius: 'var(--r-sm)',
        border: 'none',
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? '#fff' : 'var(--text-2)',
        fontSize: 13,
        fontWeight: 800,
        fontFamily: 'inherit',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
      }}
    >
      {label}
      {badge && (
        <span
          style={{
            marginLeft: 6,
            display: 'inline-block',
            padding: '1px 7px',
            borderRadius: 999,
            background: active ? 'rgba(255,255,255,0.2)' : 'var(--green-bg)',
            color: active ? '#fff' : 'var(--green)',
            fontSize: 10,
            fontWeight: 900,
            verticalAlign: 'middle',
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
