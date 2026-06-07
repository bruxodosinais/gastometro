'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import type { MonthlyObligation, MonthlyPlan } from '@/lib/types';
import { anim, hidden } from './_anim';

type BudgetOverflow = { category: string; spent: number; limit: number };

type Props = {
  valorLivreParaGastarPlanejado: number;
  orcamentoRestante: number;
  debitSpent: number;
  budgetPct: number;
  monthlyPlan: MonthlyPlan | null;
  isCurrentMonth: boolean;
  daysRemaining: number;
  budgetOverflows: BudgetOverflow[];
  pendingObligations: MonthlyObligation[];
  pendingTotal: number;
  mounted: boolean;
  /** true quando o mês atual já tem um plano salvo no banco. */
  hasSavedPlan: boolean;
  /** Nome do mês do período em vista (ex.: "Junho"), para o convite. */
  monthName: string;
  /** true quando há plano do mês anterior para pré-preencher. */
  hasPrevPlan: boolean;
  onOpenBudgetModal: () => void;
};

export default function OrcamentoCard({
  valorLivreParaGastarPlanejado,
  orcamentoRestante,
  debitSpent,
  budgetPct,
  isCurrentMonth,
  daysRemaining,
  budgetOverflows,
  pendingObligations,
  pendingTotal,
  mounted,
  hasSavedPlan,
  monthName,
  hasPrevPlan,
  onOpenBudgetModal,
}: Props) {
  const hasBudget = valorLivreParaGastarPlanejado > 0;
  const isZeroed = hasBudget ? orcamentoRestante <= 0 : debitSpent > 0;
  // Convite proativo na virada (item B): mês corrente ainda sem plano salvo.
  // Tem prioridade sobre o estado de erro/zerado — o vermelho só aparece quando
  // JÁ existe plano e a renda realmente estourou, nunca como resíduo do mês
  // anterior.
  const showNudge = isCurrentMonth && !hasSavedPlan;
  const showNeutral = !hasBudget && debitSpent === 0;
  const barColor = isZeroed ? 'var(--red)' : 'var(--green)';
  const availableValue = Math.max(orcamentoRestante, 0);

  return (
    <div
      style={{
        margin: '10px 16px 0',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '18px 20px',
        boxShadow: 'var(--card-shadow)',
        ...(mounted ? anim(300) : hidden),
      }}
    >
      {showNudge ? (
        <>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 4,
            }}
          >
            ORÇAMENTO LIVRE
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: '8px 0 4px' }}>
            {hasPrevPlan
              ? `Novo mês começou 👋`
              : `Bem-vindo ao TôOrganizado 👋`}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, marginBottom: 14 }}>
            {hasPrevPlan
              ? `Vamos definir seu orçamento de ${monthName}? Já deixamos sugerido o valor do mês passado — é só ajustar.`
              : `Configure seu orçamento de ${monthName} para acompanhar seus gastos.`}
          </p>
          <button
            type="button"
            onClick={onOpenBudgetModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Configurar orçamento
          </button>
        </>
      ) : showNeutral ? (
        <>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 4,
            }}
          >
            ORÇAMENTO LIVRE
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: '8px 0 4px' }}>
            Configure seu orçamento
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, marginBottom: 14 }}>
            Informe sua renda mensal para acompanhar seus gastos.
          </p>
          <button
            type="button"
            onClick={onOpenBudgetModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Configurar agora
          </button>
        </>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 4,
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
              ORÇAMENTO LIVRE
            </p>
            <button
              type="button"
              onClick={onOpenBudgetModal}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--accent)',
                lineHeight: 1.1,
              }}
            >
              Editar
            </button>
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <p
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: isZeroed ? 'var(--red)' : 'var(--green)',
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                {formatCurrency(availableValue)}
              </p>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
                disponível
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>
                {valorLivreParaGastarPlanejado > 0
                  ? `de ${formatCurrency(valorLivreParaGastarPlanejado)} orçados`
                  : valorLivreParaGastarPlanejado < 0
                  ? `custos fixos + meta superam a renda em ${formatCurrency(
                      -valorLivreParaGastarPlanejado
                    )}`
                  : 'sem margem livre no orçamento'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p
                style={{ fontSize: 20, fontWeight: 800, color: isZeroed ? 'var(--red)' : 'var(--text-2)', margin: 0, lineHeight: 1.1 }}
              >
                {Math.round(Math.min(budgetPct, 100))}%
              </p>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
                usado
              </p>
              {isCurrentMonth && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  {daysRemaining} dia{daysRemaining !== 1 ? 's' : ''} restante
                  {daysRemaining !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          <div
            style={{
              height: 6,
              background: 'var(--border-2)',
              borderRadius: 3,
              marginTop: 14,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 3,
                width: mounted ? `${Math.min(budgetPct, 100)}%` : '0%',
                background: barColor,
                transition: 'width 600ms ease',
              }}
            />
          </div>

          {isZeroed ? (
            <div
              style={{
                marginTop: 10,
                background: 'var(--red-bg)',
                border: '1.5px solid rgba(255,71,87,0.25)',
                borderRadius: 8,
                padding: '8px 12px',
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--red)',
                  margin: 0,
                }}
              >
                Eita! Orçamento zerado.
              </p>
            </div>
          ) : budgetOverflows.length > 0 ? (
            <div
              style={{
                marginTop: 10,
                background: 'var(--red-bg)',
                border: '1.5px solid rgba(255,71,87,0.25)',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', margin: 0 }}>
                {budgetOverflows.length === 1
                  ? '⚠️ 1 categoria com orçamento estourado'
                  : `⚠️ ${budgetOverflows[0].category} e ${budgetOverflows[1].category} estouraram o orçamento`}
              </p>
              <Link
                href="/orcamentos"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  flexShrink: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--accent)',
                  whiteSpace: 'nowrap',
                }}
              >
                Ver orçamentos
                <ChevronRight size={13} />
              </Link>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
              {isCurrentMonth
                ? `Tudo certo! Faltam ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}.`
                : 'Orçamento do mês.'}
            </p>
          )}
          {/* P4: contas fixas pendentes não entram no cálculo do
              Orçamento Livre. Apenas informa — não mexe na barra nem
              no percentual. Só aparece com despesas recorrentes não
              pagas no mês atual e total > 0. */}
          {isCurrentMonth && pendingObligations.length > 0 && pendingTotal > 0 && (
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--yellow-text)',
                marginTop: 8,
              }}
            >
              ⚠️ {formatCurrency(pendingTotal)} em contas fixas pendentes não
              incluídas
            </p>
          )}
        </>
      )}
    </div>
  );
}
