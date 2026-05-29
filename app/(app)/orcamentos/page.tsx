'use client';

import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pencil, Trash2, Plus, X, Loader2 } from 'lucide-react';
import { getBudgets, upsertBudget, deleteBudget, getExpenses } from '@/lib/storage';
import { formatCurrency, getMonthKey } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { useCategorySelector } from '@/hooks/useCategorySelector';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import CurrencyInput from '@/components/CurrencyInput';
import LoadingButton from '@/components/ui/LoadingButton';
import { getErrorMessage } from '@/lib/errors';
import type { Budget, ExpenseCategory, Expense } from '@/lib/types';

type ModalState = { mode: 'create' } | { mode: 'edit'; budget: Budget } | null;

// Mesma convenção da Home (periodExpenses) e da /categorias: conta TODOS os
// gastos type='expense' da categoria no mês corrente (inclui recorrentes
// auto-lançados). Mantém o "gasto" desta página idêntico ao OrcamentoCard.
function spentForCategory(expenses: Expense[], category: string, monthKey: string): number {
  return expenses
    .filter((e) => e.type === 'expense' && e.date.slice(0, 7) === monthKey && e.category === category)
    .reduce((s, e) => s + e.amount, 0);
}

function barColorFor(pct: number): string {
  if (pct >= 100) return 'var(--red)';
  if (pct >= 70) return 'var(--yellow)';
  return 'var(--green)';
}

export default function OrcamentosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const { categories: customs } = useCustomCategories();

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const [b, e] = await Promise.all([getBudgets(), getExpenses()]);
      setBudgets(b);
      setExpenses(e);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const monthKey = getMonthKey(new Date());

  const rows = useMemo(() => {
    return budgets
      .map((b) => {
        const spent = spentForCategory(expenses, b.category, monthKey);
        const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
        return { budget: b, spent, pct };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [budgets, expenses, monthKey]);

  const budgetedCategories = useMemo(
    () => new Set(budgets.map((b) => b.category as string)),
    [budgets],
  );

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-28">
      <header className="mb-5">
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
          Orçamentos
        </h1>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
          Defina um limite mensal por categoria e acompanhe o quanto já gastou.
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 96, borderRadius: 'var(--r)' }}
            />
          ))}
        </div>
      ) : error ? (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Não foi possível carregar seus orçamentos
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
      ) : budgets.length === 0 ? (
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
            <PieChart size={26} color="var(--accent)" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            Nenhum orçamento definido
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, marginBottom: 18 }}>
            Escolha uma categoria e defina um limite mensal
          </p>
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
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
            <Plus size={16} />
            Criar orçamento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ budget, spent, pct }) => {
            const { icon } = getCategoryDisplay(budget.category, customs);
            const barColor = barColorFor(pct);
            const overflow = pct >= 100;
            const warning = pct >= 80 && pct < 100;
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
                {overflow && (
                  <div style={{ background: 'var(--red-bg)', padding: '6px 16px' }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--red)', margin: 0 }}>
                      Limite estourado
                    </p>
                  </div>
                )}
                {warning && (
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
                      aria-label="Editar orçamento"
                      onClick={() => setModal({ mode: 'edit', budget })}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: 'var(--bg)',
                        border: 'none',
                        color: 'var(--text-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label="Excluir orçamento"
                      onClick={() => setModal({ mode: 'edit', budget })}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: 'var(--bg)',
                        border: 'none',
                        color: 'var(--text-3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={13} />
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

      {/* FAB — só quando há orçamentos (o estado vazio já tem o CTA) */}
      {!loading && !error && budgets.length > 0 && (
        <button
          type="button"
          aria-label="Criar orçamento"
          onClick={() => setModal({ mode: 'create' })}
          style={{
            position: 'fixed',
            right: 20,
            bottom: 'calc(76px + env(safe-area-inset-bottom))',
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px var(--plus-shadow)',
            zIndex: 30,
          }}
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

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

  // Em "adicionar": só categorias sem orçamento. Em "editar": fixa a atual.
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
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm mx-4 z-50"
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
            {mode === 'edit' ? 'Editar orçamento' : 'Novo orçamento'}
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
                  Todas as categorias já têm orçamento.
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
            {mode === 'edit' ? 'Salvar alterações' : 'Criar orçamento'}
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
              Excluir orçamento
            </LoadingButton>
          )}
        </div>
      </div>
    </>
  );
}
