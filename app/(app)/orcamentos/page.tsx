'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PieChart, Pencil, Plus, X, Wallet } from 'lucide-react';
import {
  getBudgets,
  upsertBudget,
  deleteBudget,
  getExpenses,
  getMonthlyPlan,
  getRecurringExpenses,
  upsertMonthlyPlan,
} from '@/lib/storage';
import { formatCurrency } from '@/lib/calculations';
import { spentForCategory, statusFromPct } from '@/lib/budgetAlerts';
import {
  aggregatePeriod,
  computeMonthlyBudget,
  getDaysRemaining,
  sumFixedCosts,
} from '@/lib/monthlyBudget';
import { budgetStatusStyles } from '@/components/BudgetLimitHint';
import BudgetStatusPills from '../_components/orcamento/BudgetStatusPills';
import PlanoMensalModal from '../_components/orcamento/PlanoMensalModal';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { useCategorySelector } from '@/hooks/useCategorySelector';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { useFinancialPeriod } from '@/hooks/useFinancialPeriod';
import CurrencyInput from '@/components/CurrencyInput';
import LoadingButton from '@/components/ui/LoadingButton';
import { getErrorMessage } from '@/lib/errors';
import type { Budget, ExpenseCategory, Expense, MonthlyPlan, RecurringExpense } from '@/lib/types';

type ModalState = { mode: 'create' } | { mode: 'edit'; budget: Budget } | null;

// Esta tela é a CASA do assunto orçamento e tem duas seções:
//   A. "Orçamento livre do mês" — plano mensal (renda − fixos − meta). Os
//      números saem de lib/monthlyBudget, a MESMA função que a Home usa, para
//      as duas telas nunca divergirem no centavo.
//   B. "Limites por categoria" — tabela budgets. Degrau e cor vêm de
//      lib/budgetAlerts + budgetStatusStyles, iguais ao aviso da tela de Lançar.

export default function OrcamentoPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [plan, setPlan] = useState<MonthlyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const { categories: customs } = useCustomCategories();
  // Período FINANCEIRO (respeita financial_start_day) — mesmo período da Home.
  const { periodKey, loading: periodLoading } = useFinancialPeriod();

  // Plano mensal (Seção A)
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planIncome, setPlanIncome] = useState(0);
  const [planGoal, setPlanGoal] = useState(0);
  const [planError, setPlanError] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [b, e, r, p] = await Promise.all([
        getBudgets(),
        getExpenses(),
        getRecurringExpenses(),
        getMonthlyPlan(periodKey),
      ]);
      setBudgets(b);
      setExpenses(e);
      setRecurring(r);
      setPlan(p);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [periodKey]);

  useEffect(() => {
    // Só busca depois que o período financeiro resolveu: getMonthlyPlan é por
    // mês e um periodKey provisório traria o plano errado.
    if (periodLoading) return;
    load();
  }, [periodLoading, load]);

  const rows = useMemo(() => {
    return budgets
      .map((b) => {
        const spent = spentForCategory(expenses, b.category, periodKey);
        const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        return { budget: b, spent, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, expenses, periodKey]);

  const showSkeleton = loading || periodLoading;

  const budgetedCategories = useMemo(
    () => new Set(budgets.map((b) => b.category as string)),
    [budgets],
  );

  // ── Seção A: mesmos números da Home (lib/monthlyBudget) ───────────────────
  const totals = aggregatePeriod(expenses, periodKey);
  const monthlyBudget = computeMonthlyBudget({
    income: totals.income,
    fixedCosts: sumFixedCosts(recurring),
    debitSpent: totals.debitSpent,
    monthlyPlan: plan,
  });
  // Esta tela mostra sempre o período financeiro CORRENTE.
  const daysRemaining = getDaysRemaining(periodKey, true);
  const isZeroed = monthlyBudget.planned > 0 ? monthlyBudget.remaining <= 0 : totals.debitSpent > 0;
  const availableValue = Math.max(monthlyBudget.remaining, 0);

  function openPlanModal() {
    setPlanError('');
    setPlanIncome(plan?.expectedIncome ?? 0);
    setPlanGoal(plan?.savingsGoal ?? 0);
    setPlanModalOpen(true);
  }

  async function handleSavePlan() {
    setPlanError('');
    if (!planIncome || planIncome <= 0) {
      setPlanError('Informe uma renda mensal maior que zero.');
      return;
    }
    if ((planGoal || 0) > planIncome) {
      setPlanError('A meta de poupança não pode ser maior que a renda.');
      return;
    }
    setSavingPlan(true);
    try {
      const saved = await upsertMonthlyPlan(periodKey, planIncome, planGoal || 0);
      setPlan(saved);
      setPlanModalOpen(false);
    } catch (err) {
      setPlanError(getErrorMessage(err));
    } finally {
      setSavingPlan(false);
    }
  }

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-36 md:pb-28">
      <header className="mb-5">
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          Orçamento
        </h1>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
          Seu teto do mês e os limites de cada categoria.
        </p>
      </header>

      {error && !showSkeleton && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '24px',
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Não foi possível carregar seu orçamento
          </p>
          <button
            type="button"
            onClick={load}
            style={{
              marginTop: 14,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--r-sm)',
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!error && (
        <>
          {/* ── SEÇÃO A — ORÇAMENTO LIVRE DO MÊS ───────────────────────────── */}
          <SectionTitle>Orçamento livre do mês</SectionTitle>

          {showSkeleton ? (
            <div className="skeleton" style={{ height: 140, borderRadius: 'var(--r)' }} />
          ) : plan == null ? (
            <EmptyState
              icon={<Wallet size={26} color="var(--accent)" />}
              title="Defina seu orçamento do mês"
              text="Informe sua renda para saber quanto sobra pra gastar"
              ctaLabel="Definir orçamento"
              onClick={openPlanModal}
            />
          ) : (
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
                padding: '18px 20px',
                boxShadow: 'var(--card-shadow)',
              }}
            >
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
                  onClick={openPlanModal}
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <p
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      color: isZeroed ? 'var(--red)' : 'var(--green)',
                      margin: 0,
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatCurrency(availableValue)}
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
                    disponível
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: isZeroed ? 'var(--red)' : 'var(--text-2)',
                      margin: 0,
                      lineHeight: 1.1,
                    }}
                  >
                    {Math.round(Math.min(monthlyBudget.pct, 100))}%
                  </p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
                    usado
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    {daysRemaining} dia{daysRemaining !== 1 ? 's' : ''} restante
                    {daysRemaining !== 1 ? 's' : ''}
                  </p>
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
                    width: `${Math.min(monthlyBudget.pct, 100)}%`,
                    background: isZeroed ? 'var(--red)' : 'var(--green)',
                    transition: 'width 600ms ease',
                  }}
                />
              </div>

              <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10 }}>
                Renda esperada {formatCurrency(plan.expectedIncome)}
                {plan.savingsGoal > 0 ? ` · meta de poupança ${formatCurrency(plan.savingsGoal)}` : ''}
              </p>
            </div>
          )}

          {/* ── SEÇÃO B — LIMITES POR CATEGORIA ────────────────────────────── */}
          {/* "Novo limite" é inline aqui, não flutuante: como pill rotulada ele
              tapava o percentual e o lápis dos cards durante o scroll. Continua
              rotulado (o "+" redondo azul da bottom-nav é o de lançar gasto) e
              só aparece quando já existem limites — com a lista vazia quem
              convida é o EmptyState, pra não ter dois CTAs concorrentes. */}
          <div
            style={{
              marginTop: 28,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <SectionTitle flush>Limites por categoria</SectionTitle>
            {!showSkeleton && !error && budgets.length > 0 && (
              <button
                type="button"
                onClick={() => setModal({ mode: 'create' })}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: 'var(--surface)',
                  color: 'var(--accent)',
                  border: '1.5px solid var(--accent)',
                  fontSize: 12,
                  fontWeight: 800,
                  fontFamily: 'Nunito, sans-serif',
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} strokeWidth={2.6} />
                Novo limite
              </button>
            )}
          </div>

          {!showSkeleton && rows.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <BudgetStatusPills
                rows={rows.map((r) => ({ pct: r.pct, spent: r.spent, limit: r.budget.amount }))}
                hideWhenAllGreen
              />
            </div>
          )}

          {showSkeleton ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 96, borderRadius: 'var(--r)' }} />
              ))}
            </div>
          ) : budgets.length === 0 ? (
            <EmptyState
              icon={<PieChart size={26} color="var(--accent)" />}
              title="Nenhum limite definido"
              text="Defina um teto por categoria e receba um aviso antes de estourar"
              ctaLabel="Criar primeiro limite"
              onClick={() => setModal({ mode: 'create' })}
            />
          ) : (
            <div className="space-y-3">
              {rows.map(({ budget, spent, pct }) => {
                const { icon } = getCategoryDisplay(budget.category, customs);
                const status = statusFromPct(pct);
                const barColor = budgetStatusStyles(status).bar;
                // "Estourado" é passar do limite; empatar é "atingido".
                // Limite 0 (defensivo, a UI não deixa criar) nunca acende faixa.
                const overflow = budget.amount > 0 && spent > budget.amount;
                const atLimit = status === 'over' && spent <= budget.amount;
                return (
                  <div
                    key={budget.id}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r)',
                      overflow: 'hidden',
                      boxShadow: 'var(--card-shadow)',
                    }}
                  >
                    {(overflow || atLimit) && (
                      <div style={{ background: 'var(--red-bg)', padding: '6px 16px' }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', margin: 0 }}>
                          {overflow ? 'Limite estourado' : 'Limite atingido'}
                        </p>
                      </div>
                    )}
                    {status === 'danger' && (
                      <div style={{ background: 'var(--orange-bg)', padding: '6px 16px' }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--orange-text)', margin: 0 }}>
                          Quase no limite: {Math.round(pct)}% usado
                        </p>
                      </div>
                    )}
                    {status === 'warn' && (
                      <div style={{ background: 'var(--yellow-bg)', padding: '6px 16px' }}>
                        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--yellow-text)', margin: 0 }}>
                          Atenção: {Math.round(pct)}% usado
                        </p>
                      </div>
                    )}

                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 14,
                            fontWeight: 800,
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {budget.category}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: barColor,
                            flexShrink: 0,
                          }}
                        >
                          {Math.round(pct)}%
                        </span>
                        <button
                          type="button"
                          aria-label="Editar limite"
                          onClick={() => setModal({ mode: 'edit', budget })}
                          style={iconButtonStyle}
                        >
                          <Pencil size={13} />
                        </button>
                      </div>

                      <div
                        style={{
                          height: 8,
                          background: 'var(--border-2)',
                          borderRadius: 4,
                          marginTop: 12,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            borderRadius: 4,
                            width: `${Math.min(pct, 100)}%`,
                            background: barColor,
                            transition: 'width 500ms ease',
                          }}
                        />
                      </div>

                      <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>
                        {formatCurrency(spent)} gastos de {formatCurrency(budget.amount)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <PlanoMensalModal
        open={planModalOpen}
        period={periodKey}
        income={planIncome}
        goal={planGoal}
        onIncomeChange={setPlanIncome}
        onGoalChange={setPlanGoal}
        error={planError}
        saving={savingPlan}
        onCancel={() => setPlanModalOpen(false)}
        onSave={handleSavePlan}
      />

      {modal && (
        <BudgetModal
          mode={modal.mode}
          budget={modal.mode === 'edit' ? modal.budget : null}
          budgetedCategories={budgetedCategories}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await load();
            setModal(null);
          }}
        />
      )}
    </main>
  );
}

const iconButtonStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: 'var(--bg)',
  border: 'none',
  color: 'var(--text-3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

// `flush` zera a margem inferior pra quando o título divide uma linha flex com
// um botão — aí o espaçamento é do wrapper, senão o botão desalinha.
function SectionTitle({ children, flush }: { children: React.ReactNode; flush?: boolean }) {
  return (
    <h2
      style={{
        fontSize: 13,
        fontWeight: 800,
        color: 'var(--text-2)',
        margin: flush ? 0 : '0 0 10px',
      }}
    >
      {children}
    </h2>
  );
}

// Estado vazio compartilhado pelas duas seções — mesmo tamanho de ícone, mesma
// tipografia, mesmo botão. Só mudam ícone, título, texto e rótulo do CTA.
function EmptyState({
  icon,
  title,
  text,
  ctaLabel,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  ctaLabel: string;
  onClick: () => void;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--r)',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'var(--accent-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}
      >
        {icon}
      </div>
      <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, marginBottom: 18 }}>{text}</p>
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--r-sm)',
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}

// ─── Modal adicionar/editar ────────────────────────────────────────────────

function BudgetModal({
  mode,
  budget,
  budgetedCategories,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  budget: Budget | null;
  budgetedCategories: Set<string>;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { categories } = useCategorySelector('expense');
  const { categories: customs } = useCustomCategories();
  const [category, setCategory] = useState<string>(budget?.category ?? '');
  const [amount, setAmount] = useState<number>(budget?.amount ?? 0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  // ESC fecha + trava scroll do body.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Em "adicionar": só categorias sem limite. Em "editar": fixa a atual.
  const available = useMemo(
    () => categories.filter((c) => !budgetedCategories.has(c.value)),
    [categories, budgetedCategories],
  );

  async function handleSave() {
    if (!category || amount <= 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      await upsertBudget(category as ExpenseCategory, amount);
      await onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!budget || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await deleteBudget(budget.category);
      await onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  }

  const currentDisplay = category ? getCategoryDisplay(category, customs) : null;

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm z-50"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r)',
          border: '1px solid var(--border)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            {mode === 'edit' ? 'Editar limite' : 'Novo limite'}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} color="var(--text-2)" />
          </button>
        </div>

        <div style={{ padding: '16px 18px', overflowY: 'auto' }}>
          {/* Categoria */}
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
            Categoria
          </p>
          {mode === 'edit' ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                opacity: 0.7,
              }}
            >
              <span style={{ fontSize: 18 }}>{currentDisplay?.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{category}</span>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {available.length === 0 ? (
                <p style={{ gridColumn: 'span 2', fontSize: 13, color: 'var(--text-3)', margin: '8px 0' }}>
                  Todas as categorias já têm limite.
                </p>
              ) : (
                available.map((c) => {
                  const selected = c.value === category;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 'var(--r-sm)',
                        background: selected ? 'var(--accent-bg)' : 'var(--bg)',
                        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        color: selected ? 'var(--accent)' : 'var(--text-2)',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{c.icon}</span>
                      <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {c.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {/* Valor */}
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', margin: '16px 0 8px' }}>
            Limite mensal
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 'var(--r-sm)',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>R$</span>
            <CurrencyInput
              value={amount}
              onChange={setAmount}
              aria-label="Limite mensal"
              className="min-w-0 flex-1 text-base font-bold bg-transparent outline-none text-[var(--text)] placeholder:text-[var(--text-3)]"
              style={{ caretColor: 'var(--accent)' }}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', marginTop: 10 }}>{error}</p>
          )}
        </div>

        <div
          style={{
            padding: '12px 18px 16px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <LoadingButton
            type="button"
            onClick={handleSave}
            loading={saving}
            disabled={!category || amount <= 0}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 'var(--r-sm)',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              fontSize: 14,
              fontWeight: 800,
              cursor: !category || amount <= 0 ? 'not-allowed' : 'pointer',
              opacity: !category || amount <= 0 ? 0.5 : 1,
            }}
          >
            {mode === 'edit' ? 'Salvar alterações' : 'Criar limite'}
          </LoadingButton>

          {mode === 'edit' && budget && (
            <LoadingButton
              type="button"
              onClick={handleDelete}
              loading={deleting}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: 'var(--r-sm)',
                background: 'transparent',
                color: 'var(--red)',
                border: '1px solid var(--border)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Excluir limite
            </LoadingButton>
          )}
        </div>
      </div>
    </>
  );
}
