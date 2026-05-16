'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  addRecurringExpense,
  addObligationForNewRecurring,
  upsertMonthlyPlan,
  getRecurringExpenses,
  updateRecurringExpense,
  addCreditCard,
} from '@/lib/storage';
import { formatCurrency } from '@/lib/calculations';
import type { ExpenseCategory } from '@/lib/types';

// ─── Dados dos chips de contas fixas ─────────────────────────────────────────

type ChipDef = {
  id: string;
  label: string;
  icon: string;
  category: ExpenseCategory;
};

const CHIPS: ChipDef[] = [
  { id: 'aluguel',   label: 'Aluguel',         icon: '🏠', category: 'Moradia' },
  { id: 'internet',  label: 'Internet',         icon: '📡', category: 'Internet' },
  { id: 'energia',   label: 'Energia',          icon: '💡', category: 'Moradia' },
  { id: 'agua',      label: 'Água',             icon: '💧', category: 'Moradia' },
  { id: 'academia',  label: 'Academia',         icon: '🏋️', category: 'Saúde' },
  { id: 'streaming', label: 'Streaming',        icon: '📺', category: 'Assinaturas' },
  { id: 'escola',    label: 'Escola/Faculdade', icon: '🎓', category: 'Educação' },
  { id: 'saude',     label: 'Plano de saúde',   icon: '🏥', category: 'Saúde' },
];

const TOTAL_STEPS = 4;
const MAX_CARDS = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAmount(str: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

function numToStr(n: number): string {
  if (!n) return '';
  return n.toFixed(0);
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function Wordmark() {
  return (
    <div className="flex justify-center mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-horizontal.png" alt="TôOrganizado" className="h-6 w-auto" />
    </div>
  );
}

function ProgressDots({ filled }: { filled: number }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className="w-2.5 h-2.5 rounded-full transition-colors duration-300"
          style={
            i < filled
              ? { background: 'var(--accent)' }
              : { border: '2px solid #e5e7eb' }
          }
        />
      ))}
    </div>
  );
}

function BigCurrencyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <span
        className="text-3xl font-semibold"
        style={{ color: 'var(--accent)' }}
      >
        R$
      </span>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
          onFocus={(e) => { if (e.target.value === '0') onChange(''); }}
          placeholder="0"
          className="text-6xl font-bold bg-transparent border-none outline-none text-center w-48 pb-2 text-gray-900 placeholder:text-gray-300"
          style={{ caretColor: 'var(--accent)' }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-100" />
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: 'var(--accent)' }}
        />
      </div>
    </div>
  );
}

function SkipLink({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      onClick={onSkip}
      className="mt-4 text-gray-400 text-sm text-center w-full"
    >
      Pular
    </button>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3.5 rounded-xl font-semibold text-white transition-opacity disabled:opacity-50"
      style={{ background: 'var(--accent)' }}
    >
      {loading ? 'Salvando...' : children}
    </button>
  );
}

// ─── Tipos de estado ─────────────────────────────────────────────────────────

type CardForm = {
  nome: string;
  limite: string;
  fechamento: string;
  vencimento: string;
};

const EMPTY_CARD: CardForm = { nome: '', limite: '', fechamento: '', vencimento: '' };

type Step = 0 | 1 | 2 | 3 | 4 | 5;

// ─── Página principal ─────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>(0);
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userName, setUserName] = useState('');

  // Passo 1 — renda
  const [income, setIncome] = useState('');
  const [incomeDay, setIncomeDay] = useState('');

  // Passo 2 — contas fixas
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [chipValues, setChipValues] = useState<Record<string, string>>({});
  const [chipDueDays, setChipDueDays] = useState<Record<string, string>>({});
  const [customName, setCustomName] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [customDueDay, setCustomDueDay] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Passo 3 — cartão de crédito
  const [useCredit, setUseCredit] = useState(false);
  const [cards, setCards] = useState<CardForm[]>([{ ...EMPTY_CARD }]);

  // Passo 4 — meta de poupança
  const [savings, setSavings] = useState('');

  // Resumo para passo 5
  const [savedIncome, setSavedIncome] = useState(0);
  const [savedRecurringCount, setSavedRecurringCount] = useState(0);
  const [savedCardCount, setSavedCardCount] = useState(0);
  const [savedSavings, setSavedSavings] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata as Record<string, string> | undefined;
      const raw =
        meta?.display_name ||
        meta?.full_name?.split(' ')[0] ||
        meta?.name?.split(' ')[0] ||
        u.email?.split('@')[0] ||
        '';
      setUserName(raw.charAt(0).toUpperCase() + raw.slice(1));
    });
  }, []);

  function goTo(next: Step) {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
    }, 180);
  }

  async function completeOnboarding() {
    // Cria o plano mensal consolidando os valores dos passos 1 e 4
    if (savedIncome > 0 || savedSavings > 0) {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        await upsertMonthlyPlan(currentMonth, savedIncome, savedSavings);
      } catch (e) {
        console.error('Onboarding: erro ao salvar plano mensal:', e);
      }
    }
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { onboarding_completed: true } });
    router.push('/');
    router.refresh();
  }

  // Tela 0 — pular tudo
  async function handleSkipAll() {
    await completeOnboarding();
  }

  // Tela 1 — renda
  async function handleStep1Continue() {
    if (saving) return;
    const amount = parseAmount(income);
    if (amount > 0) {
      setSaving(true);
      const parsedDay = parseInt(incomeDay, 10);
      // Não preencher dayOfMonth com 1 quando o usuário não informa — manter
      // undefined/null para que o item apareça como "Dia não definido" e não
      // como "Todo dia 1" enganoso.
      const day =
        Number.isFinite(parsedDay) && parsedDay >= 1 && parsedDay <= 31
          ? parsedDay
          : undefined;
      try {
        // Upsert: se já existe um recorrente de salário (ex: usuário voltou e
        // pressionou Continuar de novo), atualiza em vez de duplicar.
        const all = await getRecurringExpenses();
        const existing = all.find(
          (r) => r.type === 'income' && /sal[áa]rio/i.test(r.description),
        );
        if (existing) {
          await updateRecurringExpense(existing.id, {
            amount,
            dayOfMonth: day ?? null,
          });
        } else {
          await addRecurringExpense({
            description: 'Salário',
            amount,
            category: 'Salário',
            type: 'income',
            dayOfMonth: day,
            active: true,
            isVariable: false,
          });
        }
        setSavedIncome(amount);
      } catch (e) {
        console.error('Onboarding: erro ao salvar renda:', e);
      } finally {
        setSaving(false);
      }
    }
    goTo(2);
  }

  // Tela 2 — contas fixas
  function toggleChip(id: string) {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setChipValues((v) => { const c = { ...v }; delete c[id]; return c; });
        setChipDueDays((v) => { const c = { ...v }; delete c[id]; return c; });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleStep2Continue() {
    setSaving(true);
    let count = 0;
    for (const chip of CHIPS) {
      if (!selectedChips.has(chip.id)) continue;
      const amount = parseAmount(chipValues[chip.id] || '');
      const day = parseInt(chipDueDays[chip.id] || '', 10);
      if (amount <= 0 || !day || day < 1 || day > 31) continue;
      try {
        const rec = await addRecurringExpense({
          description: chip.label,
          amount,
          category: chip.category,
          type: 'expense',
          dayOfMonth: day,
          dueDay: day,
          active: true,
          isVariable: false,
        });
        await addObligationForNewRecurring(rec);
        count++;
      } catch (e) {
        console.error(`Onboarding: erro ao salvar ${chip.label}:`, e);
      }
    }
    if (showCustomForm && customName && parseAmount(customValue) > 0) {
      const customDay = parseInt(customDueDay, 10);
      if (customDay >= 1 && customDay <= 31) {
        try {
          const rec = await addRecurringExpense({
            description: customName,
            amount: parseAmount(customValue),
            category: 'Outros',
            type: 'expense',
            dayOfMonth: customDay,
            dueDay: customDay,
            active: true,
            isVariable: false,
          });
          await addObligationForNewRecurring(rec);
          count++;
        } catch (e) {
          console.error('Onboarding: erro ao salvar item personalizado:', e);
        }
      }
    }
    setSavedRecurringCount(count);
    setSaving(false);
    goTo(3);
  }

  // Tela 3 — cartões
  function updateCard(idx: number, patch: Partial<CardForm>) {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function addCardRow() {
    if (cards.length >= MAX_CARDS) return;
    setCards((prev) => [...prev, { ...EMPTY_CARD }]);
  }

  function removeCardRow(idx: number) {
    setCards((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function handleStep3Continue() {
    if (useCredit) {
      setSaving(true);
      let count = 0;
      for (const c of cards) {
        const nome = c.nome.trim();
        const limite = parseAmount(c.limite);
        if (!nome || limite <= 0) continue;
        const fechamento = parseInt(c.fechamento, 10);
        const vencimento = parseInt(c.vencimento, 10);
        const fechamentoOk =
          Number.isFinite(fechamento) && fechamento >= 1 && fechamento <= 28;
        const vencimentoOk =
          Number.isFinite(vencimento) && vencimento >= 1 && vencimento <= 28;
        try {
          await addCreditCard({
            nome,
            limite,
            diaFechamento: fechamentoOk ? fechamento : null,
            diaVencimento: vencimentoOk ? vencimento : null,
            ativo: true,
          });
          count++;
        } catch (e) {
          console.error(`Onboarding: erro ao salvar cartão ${nome}:`, e);
        }
      }
      setSavedCardCount(count);
      setSaving(false);
    } else {
      setSavedCardCount(0);
    }
    goTo(4);
  }

  // Tela 4 — meta de poupança
  function handleStep4Continue() {
    const amount = parseAmount(savings);
    if (amount > 0) {
      setSavedSavings(amount);
    }
    goTo(5);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const incomeNum = parseAmount(income);
  const savingsMax = savedIncome > 0 ? savedIncome * 0.5 : 5000;
  const savingsNum = parseAmount(savings);
  const savingsPct = savingsMax > 0 ? (savingsNum / savingsMax) * 100 : 0;

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-8 relative">
      {/* Botão voltar — telas 1..4 */}
      {(step === 1 || step === 2 || step === 3 || step === 4) && (
        <button
          onClick={() => goTo((step - 1) as Step)}
          className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <div
        className="w-full max-w-sm flex flex-col"
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      >
        <Wordmark />

        {/* ── Tela 0 — Boas-vindas ─────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center gap-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Olá, {userName || '…'}! 👋
            </h1>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              Vamos configurar seu TôOrganizado em {TOTAL_STEPS} passos rápidos.
            </p>
            <ProgressDots filled={0} />
            <div className="h-10" />
            <PrimaryButton onClick={() => goTo(1)}>Começar</PrimaryButton>
            <button
              onClick={handleSkipAll}
              className="mt-5 text-gray-400 text-sm text-center"
            >
              Pular tudo e explorar sozinho
            </button>
          </div>
        )}

        {/* ── Tela 1 — Renda mensal ────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-0">
            <ProgressDots filled={1} />
            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
              Passo 1 de {TOTAL_STEPS}
            </p>
            <div className="h-3" />
            <h2 className="text-xl font-bold text-gray-900 text-center">
              Qual é sua renda mensal?
            </h2>
            <p className="text-sm text-gray-400 text-center mt-1 mb-8">
              Pode ser salário, aposentadoria ou qualquer entrada fixa mensal.
            </p>
            <BigCurrencyInput value={income} onChange={setIncome} />
            <div className="h-4" />
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-gray-400">Recebo todo dia</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={incomeDay}
                onChange={(e) => setIncomeDay(e.target.value)}
                placeholder="1"
                className="w-16 text-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-sm font-semibold text-gray-900 outline-none transition-colors"
                style={{ caretColor: 'var(--accent)' }}
              />
              <span className="text-sm text-gray-400">do mês</span>
            </div>
            <div className="h-6" />
            <PrimaryButton
              onClick={handleStep1Continue}
              disabled={incomeNum <= 0}
              loading={saving}
            >
              Continuar
            </PrimaryButton>
            <SkipLink onSkip={() => goTo(2)} />
          </div>
        )}

        {/* ── Tela 2 — Contas fixas ────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-0">
            <ProgressDots filled={2} />
            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
              Passo 2 de {TOTAL_STEPS}
            </p>
            <div className="h-3" />
            <h2 className="text-xl font-bold text-gray-900 text-center">
              Você tem contas fixas todo mês?
            </h2>
            <p className="text-sm text-gray-400 text-center mt-1 mb-5">
              Selecione as que se aplicam e informe o valor.
            </p>

            {/* Grid de chips */}
            <div className="overflow-y-auto max-h-64 -mx-1 px-1">
              <div className="grid grid-cols-2 gap-2">
                {CHIPS.map((chip) => {
                  const selected = selectedChips.has(chip.id);
                  return (
                    <div key={chip.id}>
                      <button
                        onClick={() => toggleChip(chip.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors"
                        style={
                          selected
                            ? {
                                background: 'var(--accent-bg)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent)',
                              }
                            : {
                                background: '#f9fafb',
                                borderColor: '#f3f4f6',
                                color: '#374151',
                              }
                        }
                      >
                        <span>{chip.icon}</span>
                        <span className="truncate">{chip.label}</span>
                      </button>
                      {selected && (
                        <div className="mt-1 flex gap-1">
                          <div
                            className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1.5 rounded-xl border"
                            style={{
                              background: 'var(--accent-bg)',
                              borderColor: 'var(--accent-soft)',
                            }}
                          >
                            <span
                              className="text-xs font-medium flex-shrink-0"
                              style={{ color: 'var(--accent)' }}
                            >
                              R$
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={chipValues[chip.id] || ''}
                              onChange={(e) =>
                                setChipValues((prev) => ({
                                  ...prev,
                                  [chip.id]: e.target.value.replace(/[^0-9.,]/g, ''),
                                }))
                              }
                              placeholder="0,00"
                              className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                            />
                          </div>
                          <div
                            className="flex items-center gap-1 px-2 py-1.5 rounded-xl border w-[88px] flex-shrink-0"
                            style={{
                              background: 'var(--accent-bg)',
                              borderColor: 'var(--accent-soft)',
                            }}
                          >
                            <span
                              className="text-[10px] font-medium leading-tight flex-shrink-0"
                              style={{ color: 'var(--accent)' }}
                            >
                              Vence<br />dia
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={31}
                              value={chipDueDays[chip.id] || ''}
                              onChange={(e) =>
                                setChipDueDays((prev) => ({
                                  ...prev,
                                  [chip.id]: e.target.value,
                                }))
                              }
                              placeholder="ex: 10"
                              className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {showCustomForm ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Nome da conta"
                    className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors"
                  />
                  <div className="flex gap-1">
                    <div className="flex items-center gap-1 flex-1 min-w-0 bg-white border border-gray-100 rounded-xl px-3 py-2">
                      <span className="text-xs text-gray-400 font-medium flex-shrink-0">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customValue}
                        onChange={(e) =>
                          setCustomValue(e.target.value.replace(/[^0-9.,]/g, ''))
                        }
                        placeholder="0,00"
                        className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl px-2 py-2 w-[88px] flex-shrink-0">
                      <span className="text-[10px] text-gray-400 font-medium leading-tight flex-shrink-0">Vence<br />dia</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={31}
                        value={customDueDay}
                        onChange={(e) => setCustomDueDay(e.target.value)}
                        placeholder="ex: 10"
                        className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomForm(true)}
                  className="mt-3 w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 transition-colors"
                >
                  + Adicionar outra
                </button>
              )}
            </div>

            <div className="h-5" />
            <PrimaryButton onClick={handleStep2Continue} loading={saving}>
              Continuar
            </PrimaryButton>
            <SkipLink onSkip={() => goTo(3)} />
          </div>
        )}

        {/* ── Tela 3 — Cartão de crédito ───────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col gap-0">
            <ProgressDots filled={3} />
            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
              Passo 3 de {TOTAL_STEPS}
            </p>
            <div className="h-3" />
            <h2 className="text-xl font-bold text-gray-900 text-center">
              Você usa cartão de crédito?
            </h2>
            <p className="text-sm text-gray-400 text-center mt-1 mb-5">
              Cadastre seus cartões para acompanhar a fatura. Você pode adicionar
              mais depois.
            </p>

            {/* Toggle Sim / Não */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setUseCredit(false)}
                className="py-2.5 rounded-xl border text-sm font-semibold transition-colors"
                style={
                  !useCredit
                    ? {
                        background: 'var(--accent-bg)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                      }
                    : {
                        background: '#f9fafb',
                        borderColor: '#f3f4f6',
                        color: '#6b7280',
                      }
                }
              >
                Não
              </button>
              <button
                onClick={() => setUseCredit(true)}
                className="py-2.5 rounded-xl border text-sm font-semibold transition-colors"
                style={
                  useCredit
                    ? {
                        background: 'var(--accent-bg)',
                        borderColor: 'var(--accent)',
                        color: 'var(--accent)',
                      }
                    : {
                        background: '#f9fafb',
                        borderColor: '#f3f4f6',
                        color: '#6b7280',
                      }
                }
              >
                Sim
              </button>
            </div>

            {useCredit && (
              <div className="space-y-3 max-h-80 overflow-y-auto -mx-1 px-1">
                {cards.map((card, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-gray-100 p-3 space-y-2"
                    style={{ background: '#f9fafb' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Cartão {idx + 1}
                      </span>
                      {cards.length > 1 && (
                        <button
                          onClick={() => removeCardRow(idx)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={card.nome}
                      onChange={(e) => updateCard(idx, { nome: e.target.value })}
                      placeholder="Nome (ex: Nubank, Inter, Itaú)"
                      className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                    />
                    <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-400 font-medium flex-shrink-0">Limite R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={card.limite}
                        onChange={(e) =>
                          updateCard(idx, {
                            limite: e.target.value.replace(/[^0-9.,]/g, ''),
                          })
                        }
                        placeholder="0,00"
                        className="min-w-0 flex-1 text-sm bg-transparent outline-none text-right text-gray-900 placeholder:text-gray-300"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 flex-1 bg-white border border-gray-100 rounded-lg px-2 py-2">
                        <span className="text-[10px] text-gray-400 font-medium leading-tight flex-shrink-0">
                          Fecha<br />dia
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={28}
                          value={card.fechamento}
                          onChange={(e) => updateCard(idx, { fechamento: e.target.value })}
                          placeholder="ex: 25"
                          className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                        />
                      </div>
                      <div className="flex items-center gap-1 flex-1 bg-white border border-gray-100 rounded-lg px-2 py-2">
                        <span className="text-[10px] text-gray-400 font-medium leading-tight flex-shrink-0">
                          Vence<br />dia
                        </span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={28}
                          value={card.vencimento}
                          onChange={(e) => updateCard(idx, { vencimento: e.target.value })}
                          placeholder="ex: 5"
                          className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {cards.length < MAX_CARDS && (
                  <button
                    onClick={addCardRow}
                    className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 transition-colors"
                  >
                    + Adicionar outro cartão
                  </button>
                )}
              </div>
            )}

            <div className="h-5" />
            <PrimaryButton onClick={handleStep3Continue} loading={saving}>
              Continuar
            </PrimaryButton>
            <SkipLink onSkip={() => { setUseCredit(false); goTo(4); }} />
          </div>
        )}

        {/* ── Tela 4 — Meta de poupança ────────────────────────────────── */}
        {step === 4 && (
          <div className="flex flex-col gap-0">
            <ProgressDots filled={4} />
            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
              Passo 4 de {TOTAL_STEPS}
            </p>
            <div className="h-3" />
            <h2 className="text-xl font-bold text-gray-900 text-center">
              Quanto quer guardar por mês?
            </h2>
            <p className="text-sm text-gray-400 text-center mt-1 mb-4">
              Sua meta de poupança mensal.
            </p>

            {savedIncome > 0 && (
              <div
                className="rounded-xl px-4 py-3 mb-4 border"
                style={{
                  background: 'var(--accent-bg)',
                  borderColor: 'var(--accent-soft)',
                }}
              >
                <p
                  className="text-xs text-center leading-relaxed"
                  style={{ color: 'var(--accent)' }}
                >
                  Com{' '}
                  <span className="font-semibold">{formatCurrency(savedIncome)}</span>,
                  guardar{' '}
                  <span className="font-semibold">
                    {formatCurrency(savedIncome * 0.2)}
                  </span>{' '}
                  representa 20% — uma boa referência.
                </p>
              </div>
            )}

            <BigCurrencyInput value={savings} onChange={setSavings} />

            <div className="mt-4 px-1">
              <input
                type="range"
                min={0}
                max={savingsMax}
                step={savingsMax > 1000 ? 50 : 10}
                value={savingsNum}
                onChange={(e) => setSavings(numToStr(Number(e.target.value)))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--accent) ${savingsPct}%, #e5e7eb ${savingsPct}%)`,
                  accentColor: '#5B5BD6',
                }}
              />
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>R$ 0</span>
                <span>{formatCurrency(savingsMax)}</span>
              </div>
            </div>

            <div className="h-8" />
            <PrimaryButton onClick={handleStep4Continue} loading={saving}>
              Concluir configuração
            </PrimaryButton>
            <SkipLink onSkip={() => goTo(5)} />
          </div>
        )}

        {/* ── Tela 5 — Tudo pronto ─────────────────────────────────────── */}
        {step === 5 && (
          <div className="flex flex-col items-center text-center gap-0">
            <div
              className="w-20 h-20 rounded-full border-2 flex items-center justify-center text-4xl mb-6"
              style={{
                background: 'var(--accent-bg)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
                animation: 'fade-in-scale 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
              }}
            >
              ✓
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Tudo configurado!
            </h2>

            {(savedIncome > 0 ||
              savedRecurringCount > 0 ||
              savedCardCount > 0 ||
              savedSavings > 0) && (
              <div className="w-full bg-gray-50 rounded-xl px-4 py-4 mb-8 space-y-2.5 text-left">
                {savedIncome > 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
                    <span>
                      Renda de{' '}
                      <span className="font-semibold">{formatCurrency(savedIncome)}</span>{' '}
                      cadastrada
                    </span>
                  </div>
                )}
                {savedRecurringCount > 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
                    <span>
                      <span className="font-semibold">{savedRecurringCount}</span>{' '}
                      conta{savedRecurringCount > 1 ? 's' : ''} fixa
                      {savedRecurringCount > 1 ? 's' : ''} cadastrada
                      {savedRecurringCount > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {savedCardCount > 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
                    <span>
                      <span className="font-semibold">{savedCardCount}</span>{' '}
                      cartã{savedCardCount > 1 ? 'ões' : 'o'} cadastrado
                      {savedCardCount > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {savedSavings > 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
                    <span>
                      Meta de{' '}
                      <span className="font-semibold">{formatCurrency(savedSavings)}</span>{' '}
                      por mês definida
                    </span>
                  </div>
                )}
              </div>
            )}

            {savedIncome === 0 &&
              savedRecurringCount === 0 &&
              savedCardCount === 0 &&
              savedSavings === 0 && (
              <p className="text-gray-400 text-sm mb-8">
                Você pode configurar tudo isso a qualquer momento nas configurações.
              </p>
            )}

            <PrimaryButton onClick={completeOnboarding}>
              Ver meu TôOrganizado →
            </PrimaryButton>
          </div>
        )}
      </div>
    </main>
  );
}
