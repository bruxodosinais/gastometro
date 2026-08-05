'use client';

import { AlertCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import type { BudgetStatus } from '@/lib/budgetAlerts';

// Paleta por status — exportada porque o BudgetWarningModal e as faixas da
// /orcamentos usam exatamente as mesmas cores (92% tem que ser laranja nas
// duas telas). Combinada com statusFromPct, é a única fonte de cor.
export function budgetStatusStyles(status: BudgetStatus) {
  if (status === 'over') {
    return {
      bg: 'var(--red-bg)',
      border: 'rgba(255,71,87,0.28)',
      text: 'var(--red)',
      bar: 'var(--red)',
    };
  }
  if (status === 'danger') {
    return {
      bg: 'var(--orange-bg)',
      border: 'rgba(255,138,61,0.30)',
      text: 'var(--orange-text)',
      bar: 'var(--orange)',
    };
  }
  if (status === 'warn') {
    return {
      bg: 'var(--yellow-bg)',
      border: 'rgba(255,184,0,0.30)',
      text: 'var(--yellow-text)',
      bar: 'var(--yellow)',
    };
  }
  // 'ok' e 'no-budget': o hint nem renderiza, mas a barra da /orcamentos usa.
  return {
    bg: 'var(--green-bg)',
    border: 'rgba(0,195,122,0.30)',
    text: 'var(--green-text)',
    bar: 'var(--green)',
  };
}

interface Props {
  status: BudgetStatus;
  limit: number;
  spent: number;
  // Valor sendo digitado (já debounced) — usado para não culpar este gasto
  // por um estouro que já existia antes dele.
  extra: number;
  projected: number;
  projectedPct: number;
  overBy: number;
  category: string;
  categoryIcon?: string;
  // Nome do mês (minúsculo) quando o lançamento NÃO é do mês corrente —
  // sem isso a copy diria "neste mês" falando de outro balde.
  monthLabel?: string | null;
}

// Aviso em TEMPO REAL, inline, logo abaixo do campo de valor da tela de
// lançar. Não é modal de propósito: não rouba foco nem fecha o teclado do
// celular enquanto o usuário digita.
export default function BudgetLimitHint({
  status,
  limit,
  spent,
  extra,
  projected,
  projectedPct,
  overBy,
  category,
  categoryIcon,
  monthLabel,
}: Props) {
  if (status === 'ok' || status === 'no-budget') return null;

  const s = budgetStatusStyles(status);
  const pct = Math.round(projectedPct);
  const remaining = Math.max(limit - projected, 0);
  const Icon = status === 'warn' ? AlertCircle : AlertTriangle;

  // A categoria já tinha estourado ANTES deste lançamento — culpar o valor
  // digitado ("esse valor ultrapassa") seria falso. Empate (spent === limit)
  // NÃO conta: aí o valor digitado é mesmo quem cruza a linha.
  const alreadyOver = limit > 0 && spent > limit;

  // O pct exibido é o PROJETADO (inclui o valor sendo digitado) — por isso
  // 'warn' não pode dizer "você já usou".
  const title =
    status === 'warn'
      ? `Com esse valor, ${category} chega a ${pct}% do limite`
      : status === 'danger'
        ? `Esse valor deixa ${category} em ${pct}% do limite`
        : alreadyOver
          ? `${category} já passou do limite${monthLabel ? ` em ${monthLabel}` : ''}`
          : `Esse valor ultrapassa o limite de ${category}`;

  const subtitle =
    status === 'over'
      ? alreadyOver
        ? `Você já gastou ${formatCurrency(spent)} de ${formatCurrency(limit)} — esse valor soma mais ${formatCurrency(extra)}`
        : `${formatCurrency(overBy)} acima do seu limite de ${formatCurrency(limit)}` +
          (monthLabel ? ` em ${monthLabel}` : '')
      : monthLabel
        ? `Sobram ${formatCurrency(remaining)} em ${monthLabel}`
        : `Sobram ${formatCurrency(remaining)} neste mês`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="budget-hint-in"
      style={{
        background: s.bg,
        border: `1.5px solid ${s.border}`,
        borderRadius: 12,
        padding: '11px 13px',
        fontFamily: 'Nunito, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          {categoryIcon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 800,
              color: s.text,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            <Icon size={14} style={{ flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>{title}</span>
          </p>
          <p
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: 'var(--text-2)',
              margin: 0,
              marginTop: 2,
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </p>
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 900,
            color: s.text,
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          {pct}%
        </span>
      </div>

      {/* Mini-barra — mesmo padrão da tela de Orçamento, altura 6. */}
      <div
        style={{
          height: 6,
          background: 'var(--border-2)',
          borderRadius: 3,
          marginTop: 9,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(projectedPct, 100)}%`,
            background: s.bar,
            borderRadius: 3,
            transition: 'width 300ms ease',
          }}
        />
      </div>
    </div>
  );
}
