'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import type { MonthlyObligation, MonthlyPlan } from '@/lib/types';
import { budgetCoachIsSilent, coachBudget } from '@/lib/insights/coach';
import { useMissionContext } from '@/lib/insights/useMissionContext';
import BudgetStatusPills, { BudgetStatusRow } from '../orcamento/BudgetStatusPills';
import { anim, hidden } from './_anim';

type BudgetOverflow = { category: string; spent: number; limit: number };

const summaryLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--accent)',
  whiteSpace: 'nowrap',
};

// Passo NUMERADO do card da conta nova. Sem checkbox de propósito: o card
// sai do ar assim que o plano é salvo (quem já tem plano precisa ver os
// números), então uma caixinha prometeria um ✓ que ninguém veria marcar.
function StepItem({
  n,
  label,
  href,
  onClick,
}: {
  n: number;
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 900,
          color: 'var(--accent)',
        }}
      >
        {n}.
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text)',
          textAlign: 'left',
        }}
      >
        {label}
      </span>
      <ChevronRight size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
    </>
  );

  const style: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--r-sm)',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontFamily: 'Nunito, sans-serif',
  };

  if (href) {
    return (
      <Link href={href} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} style={style}>
      {inner}
    </button>
  );
}

type Props = {
  valorLivreParaGastarPlanejado: number;
  orcamentoRestante: number;
  debitSpent: number;
  budgetPct: number;
  monthlyPlan: MonthlyPlan | null;
  isCurrentMonth: boolean;
  daysRemaining: number;
  budgetOverflows: BudgetOverflow[];
  /** Uma linha por limite de categoria ativo — alimenta o resumo e as pills. */
  limitRows: BudgetStatusRow[];
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
  limitRows,
  pendingObligations,
  pendingTotal,
  mounted,
  hasSavedPlan,
  monthName,
  hasPrevPlan,
  onOpenBudgetModal,
}: Props) {
  const { context: mission, loading: missionLoading } = useMissionContext();
  const budgetCoach = coachBudget({
    freeMargin: valorLivreParaGastarPlanejado,
    remaining: orcamentoRestante,
    mission,
  });
  // Mesmo predicado que faz o coach retornar null — o card precisa dele antes do
  // fetch da missão pra não piscar o skeleton de algo que não vai renderizar.
  const coachSilent = budgetCoachIsSilent({
    freeMargin: valorLivreParaGastarPlanejado,
    remaining: orcamentoRestante,
  });
  const hasBudget = valorLivreParaGastarPlanejado > 0;
  const isZeroed = hasBudget ? orcamentoRestante <= 0 : debitSpent > 0;
  // Convite proativo na virada (item B): mês corrente ainda sem plano salvo.
  // Tem prioridade sobre o estado de erro/zerado — o vermelho só aparece quando
  // JÁ existe plano e a renda realmente estourou, nunca como resíduo do mês
  // anterior.
  const showNudge = isCurrentMonth && !hasSavedPlan;
  const showNeutral = !hasBudget && debitSpent === 0;
  const hasLimits = limitRows.length > 0;
  // Conta nova: nem plano do mês, nem limite nenhum. Em vez do convite solto,
  // o card vira um passo a passo de 2 itens. Assim que o plano é salvo o card
  // volta ao normal (e o convite de limites aparece como linha-resumo).
  const showChecklist = showNudge && !hasLimits;
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
      {showChecklist ? (
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
            {hasPrevPlan ? 'Novo mês começou 👋' : 'Bem-vindo ao TôOrganizado 👋'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, marginBottom: 12 }}>
            Dois passos para o app avisar você antes de estourar.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <StepItem
              n={1}
              label={`Definir a renda de ${monthName}`}
              onClick={onOpenBudgetModal}
            />
            <StepItem n={2} label="Criar limites por categoria" href="/orcamentos" />
          </div>
        </>
      ) : showNudge ? (
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
              : `Defina seu orçamento de ${monthName} para acompanhar seus gastos.`}
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
            Definir orçamento
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
            Defina seu orçamento do mês
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, marginBottom: 14 }}>
            Informe sua renda para saber quanto sobra pra gastar.
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
            Definir orçamento
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
              {/* A subfrase fria de planejamento ("de R$X orçados" / "custos
                  fixos + meta superam a renda" / "sem margem livre") saiu — a
                  linha do coachBudget cobre isso melhor (com ação). */}
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

          {/* Resumo dos LIMITES POR CATEGORIA — o outro lado do orçamento.
              Mesmas pills da tela /orcamentos. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 12,
            }}
          >
            {hasLimits ? (
              <>
                <BudgetStatusPills rows={limitRows} />
                <Link href="/orcamentos" style={summaryLinkStyle}>
                  Ver orçamento
                  <ChevronRight size={13} />
                </Link>
              </>
            ) : (
              <Link href="/orcamentos" style={summaryLinkStyle}>
                Defina limites por categoria
                <ChevronRight size={13} />
              </Link>
            )}
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
                  ? '⚠️ 1 categoria passou do limite'
                  : `⚠️ ${budgetOverflows[0].category} e ${budgetOverflows[1].category} passaram do limite`}
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
                Ver orçamento
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

          {/* Coach (Item 7b): margem livre ligada à Missão. Loading-aware pra
              não piscar o CTA "Criar Missão" pra quem já tem missão. Só no mês
              corrente ("esse mês"). */}
          {isCurrentMonth && !coachSilent &&
            (missionLoading ? (
              <span
                className="skeleton"
                style={{ display: 'block', height: 14, width: '90%', borderRadius: 4, marginTop: 10 }}
              />
            ) : budgetCoach ? (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginTop: 10, lineHeight: 1.4 }}>
                  {budgetCoach.emoji} {budgetCoach.message}
                </p>
                {budgetCoach.cta && (
                  <Link
                    href={budgetCoach.cta.href}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      marginTop: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--accent)',
                    }}
                  >
                    {budgetCoach.cta.label}
                    <ChevronRight size={13} />
                  </Link>
                )}
              </>
            ) : null)}
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
