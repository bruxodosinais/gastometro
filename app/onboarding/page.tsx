'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  addRecurringExpense,
  addObligationForNewRecurring,
  deleteRecurringExpense,
  deleteObligationsByRecurringIds,
  upsertMonthlyPlan,
  getRecurringExpenses,
  updateRecurringExpense,
  addCreditCard,
  deleteCreditCard,
  getExpenses,
  addExpense,
  updateExpense,
  getAssets,
  createAsset,
  updateAsset,
  getMonthlyObligations,
  markObligationAsPaid,
} from '@/lib/storage';
import { formatCurrency } from '@/lib/calculations';
import { Info } from 'lucide-react';
import type { ExpenseCategory, MonthlyObligation, RecurringExpense } from '@/lib/types';

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

// 5 passos visíveis: renda, contas fixas, cartões, meta, situação financeira.
// A situação financeira tem 3 sub-etapas (A/B/C) mas conta como 1 passo.
const TOTAL_STEPS = 5;
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

// Sub-progresso das 3 etapas (A/B/C) dentro do passo "Situação financeira".
function SubDots({ active }: { active: number }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-1 rounded-full transition-all duration-300"
          style={
            i === active
              ? { width: 20, background: 'var(--accent)' }
              : { width: 8, background: '#e5e7eb' }
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

function SkipLink({ label, onSkip }: { label?: string; onSkip: () => void }) {
  return (
    <button
      onClick={onSkip}
      className="mt-4 text-gray-400 text-sm text-center w-full"
    >
      {label ?? 'Pular'}
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

// Botão "Voltar" — outline indigo. Preserva os dados já preenchidos: a
// navegação só troca o passo, nenhum estado de formulário é resetado.
function SecondaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="py-3.5 px-5 rounded-xl font-semibold transition-colors flex-shrink-0"
      style={{
        border: '1.5px solid var(--accent)',
        color: 'var(--accent)',
        background: '#fff',
      }}
    >
      {children}
    </button>
  );
}

// Linha de navegação: "Voltar" (outline) + ação primária (Continuar/Próximo).
function NavRow({
  onBack,
  showBack = true,
  onPrimary,
  primaryLabel,
  primaryDisabled,
  loading,
}: {
  onBack: () => void;
  showBack?: boolean;
  onPrimary: () => void;
  primaryLabel: React.ReactNode;
  primaryDisabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex gap-3">
      {showBack && <SecondaryButton onClick={onBack}>Voltar</SecondaryButton>}
      <div className="flex-1">
        <PrimaryButton
          onClick={onPrimary}
          disabled={primaryDisabled}
          loading={loading}
        >
          {primaryLabel}
        </PrimaryButton>
      </div>
    </div>
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

// 0 boas-vindas · 1 renda · 2 contas fixas · 3 cartões · 4 meta
// 5 sit. financeira A · 6 sit. financeira B · 7 sit. financeira C (resumo final)
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  // IDs criados no passo 2 — apagados e recriados se o usuário voltar e
  // avançar de novo, evitando recorrentes/obrigações duplicadas.
  const [createdRecurringIds, setCreatedRecurringIds] = useState<string[]>([]);

  // Passo 3 — cartão de crédito
  const [useCredit, setUseCredit] = useState(false);
  const [cards, setCards] = useState<CardForm[]>([{ ...EMPTY_CARD }]);
  const [createdCardIds, setCreatedCardIds] = useState<string[]>([]);

  // Passo 4 — meta de poupança
  const [savings, setSavings] = useState('');

  // Passo 5 — situação financeira atual
  const [balance, setBalance] = useState('');       // saldo atual em conta
  const [emergency, setEmergency] = useState('');   // reserva de emergência
  const [salaryDropped, setSalaryDropped] = useState(false);
  const [salaryRec, setSalaryRec] = useState<RecurringExpense | null>(null);
  const [obligations, setObligations] = useState<MonthlyObligation[]>([]);
  const [paidObligationIds, setPaidObligationIds] = useState<Set<string>>(new Set());
  const [loadingB, setLoadingB] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Resumo
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

  // Ao entrar na sub-etapa B, carrega o salário recorrente (passo 1) e as
  // contas fixas do mês (obrigações criadas no passo 2). Recarrega a cada
  // entrada para refletir edições feitas ao voltar.
  useEffect(() => {
    if (step !== 6) return;
    let cancelled = false;
    setLoadingB(true);
    (async () => {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const [recs, obs] = await Promise.all([
          getRecurringExpenses(),
          getMonthlyObligations(currentMonth),
        ]);
        if (cancelled) return;
        const sal =
          recs.find(
            (r) => r.type === 'income' && /sal[áa]rio/i.test(r.description),
          ) ?? null;
        setSalaryRec(sal);
        const pending = obs.filter((o) => o.status === 'pending');
        setObligations(pending);
        // Mantém só as marcações cujas obrigações ainda existem.
        setPaidObligationIds((prev) => {
          const valid = new Set(pending.map((o) => o.id));
          return new Set([...prev].filter((id) => valid.has(id)));
        });
      } catch (e) {
        console.error('Onboarding: erro ao carregar situação do mês:', e);
      } finally {
        if (!cancelled) setLoadingB(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  function goTo(next: Step) {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
    }, 180);
  }

  function goBack() {
    goTo((step - 1) as Step);
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

  // Situação financeira — "Pular por agora": vai direto pra home sem gravar
  // nada do passo financeiro (saldo, reserva, contas pagas, salário recebido).
  // Os passos anteriores já persistiram seus dados; o plano mensal (renda/meta)
  // segue salvo via completeOnboarding.
  async function handleSkipFinance() {
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
    // Idempotência: ao voltar e avançar de novo, apaga o que foi criado antes
    // (obrigações primeiro, depois recorrentes) e recria a partir dos valores
    // atuais — sem duplicar.
    if (createdRecurringIds.length > 0) {
      try {
        await deleteObligationsByRecurringIds(createdRecurringIds);
        for (const id of createdRecurringIds) {
          await deleteRecurringExpense(id);
        }
      } catch (e) {
        console.error('Onboarding: erro ao limpar recorrentes anteriores:', e);
      }
    }
    const newIds: string[] = [];
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
        newIds.push(rec.id);
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
          newIds.push(rec.id);
          count++;
        } catch (e) {
          console.error('Onboarding: erro ao salvar item personalizado:', e);
        }
      }
    }
    setCreatedRecurringIds(newIds);
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
    setSaving(true);
    // Idempotência: apaga os cartões criados antes (se o usuário voltou) e
    // recria a partir do estado atual.
    if (createdCardIds.length > 0) {
      try {
        for (const id of createdCardIds) {
          await deleteCreditCard(id);
        }
      } catch (e) {
        console.error('Onboarding: erro ao limpar cartões anteriores:', e);
      }
      setCreatedCardIds([]);
    }
    if (useCredit) {
      const newIds: string[] = [];
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
          const created = await addCreditCard({
            nome,
            limite,
            diaFechamento: fechamentoOk ? fechamento : null,
            diaVencimento: vencimentoOk ? vencimento : null,
            ativo: true,
          });
          newIds.push(created.id);
          count++;
        } catch (e) {
          console.error(`Onboarding: erro ao salvar cartão ${nome}:`, e);
        }
      }
      setCreatedCardIds(newIds);
      setSavedCardCount(count);
    } else {
      setSavedCardCount(0);
    }
    setSaving(false);
    goTo(4);
  }

  // Tela 4 — meta de poupança
  function handleStep4Continue() {
    const amount = parseAmount(savings);
    setSavedSavings(amount > 0 ? amount : 0);
    goTo(5);
  }

  // Tela 5 — situação financeira A (saldo + reserva)
  function handleStepAContinue() {
    if (parseAmount(balance) <= 0) return;
    goTo(6);
  }

  // Tela 7 — "Começar organizado": grava saldo inicial, reserva, salário
  // recebido e contas marcadas como pagas, depois finaliza o onboarding.
  // Cada escrita é idempotente para suportar voltar/avançar sem duplicar.
  async function handleFinish() {
    if (committing) return;
    // commitError reflete tentativa anterior (não-null = user já viu o aviso e
    // está clicando "Começar organizado" de novo para seguir mesmo assim).
    const isRetry = commitError !== null;
    setCommitting(true);
    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);

    const bal = parseAmount(balance);
    let saldoInicialFailed = false;
    if (bal > 0) {
      try {
        const all = await getExpenses();
        const existing = all.find(
          (e) => e.type === 'income' && e.category === 'Saldo inicial',
        );
        if (existing) {
          if (existing.amount !== bal) {
            await updateExpense(existing.id, {
              type: existing.type,
              amount: bal,
              description: existing.description,
              category: existing.category,
              date: existing.date,
              recurringExpenseId: existing.recurringExpenseId,
              creditCardId: existing.creditCardId,
              isCredit: existing.isCredit,
              billingMonth: existing.billingMonth,
            });
          }
        } else {
          await addExpense({
            type: 'income',
            amount: bal,
            description: 'Saldo inicial',
            category: 'Saldo inicial',
            date: today,
          });
        }
      } catch (e) {
        // Causa típica: migration `20260517_add_saldo_inicial_to_category_check.sql`
        // não aplicada → expenses_category_check rejeita 'Saldo inicial'. Antes
        // caía silencioso e o saldo do beta tester ficava negativo. Agora avisa.
        console.error('Onboarding: erro ao salvar saldo inicial:', e);
        const msg = e instanceof Error ? e.message : String(e);
        setCommitError(
          `Não consegui salvar seu saldo inicial (${msg}). Continuamos sem ele — você pode lançar manualmente depois em Lançamentos.`,
        );
        saldoInicialFailed = true;
      }
    }

    const emg = parseAmount(emergency);
    if (emg > 0) {
      try {
        const assets = await getAssets();
        const existing = assets.find(
          (a) => a.type === 'caixa' && a.name === 'Reserva de emergência',
        );
        if (existing) {
          if (existing.value !== emg) {
            await updateAsset(existing.id, { value: emg });
          }
        } else {
          await createAsset({
            name: 'Reserva de emergência',
            type: 'caixa',
            value: emg,
          });
        }
      } catch (e) {
        console.error('Onboarding: erro ao salvar reserva de emergência:', e);
      }
    }

    if (salaryDropped && salaryRec) {
      try {
        const all = await getExpenses();
        const already = all.some(
          (e) =>
            e.recurringExpenseId === salaryRec.id &&
            typeof e.date === 'string' &&
            e.date.slice(0, 7) === currentMonth,
        );
        if (!already) {
          await addExpense(
            {
              type: 'income',
              amount: salaryRec.amount,
              description: salaryRec.description,
              category: salaryRec.category,
              date: today,
            },
            salaryRec.id,
          );
        }
      } catch (e) {
        console.error('Onboarding: erro ao marcar salário recebido:', e);
      }
    }

    for (const ob of obligations) {
      if (!paidObligationIds.has(ob.id)) continue;
      try {
        // markObligationAsPaid já deduplica o lançamento por recorrente/mês.
        await markObligationAsPaid(ob.id, ob);
      } catch (e) {
        console.error(`Onboarding: erro ao marcar "${ob.description}" como paga:`, e);
      }
    }

    // Se o saldo inicial falhou na PRIMEIRA tentativa, pausa antes de navegar
    // para que o aviso fique visível. Segundo clique (isRetry=true) segue.
    if (saldoInicialFailed && !isRetry) {
      setCommitting(false);
      return;
    }

    // Sem setCommitting(false): completeOnboarding navega para fora da página.
    await completeOnboarding();
  }

  function togglePaidObligation(id: string) {
    setPaidObligationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─── Valores derivados ─────────────────────────────────────────────────────

  const incomeNum = parseAmount(income);
  const savingsMax = savedIncome > 0 ? savedIncome * 0.5 : 5000;
  const savingsNum = parseAmount(savings);
  const savingsPct = savingsMax > 0 ? (savingsNum / savingsMax) * 100 : 0;

  const balanceNum = parseAmount(balance);
  const paidThisMonth = obligations
    .filter((o) => paidObligationIds.has(o.id))
    .reduce((sum, o) => sum + o.amount, 0);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-8 relative">
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
            <NavRow
              onBack={goBack}
              onPrimary={handleStep1Continue}
              primaryLabel="Continuar"
              primaryDisabled={incomeNum <= 0}
              loading={saving}
            />
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
            <NavRow
              onBack={goBack}
              onPrimary={handleStep2Continue}
              primaryLabel="Continuar"
              loading={saving}
            />
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
            <NavRow
              onBack={goBack}
              onPrimary={handleStep3Continue}
              primaryLabel="Continuar"
              loading={saving}
            />
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
            <NavRow
              onBack={goBack}
              onPrimary={handleStep4Continue}
              primaryLabel="Continuar"
              loading={saving}
            />
            <SkipLink onSkip={() => goTo(5)} />
          </div>
        )}

        {/* ── Tela 5 — Situação financeira · A: quanto você tem ─────────── */}
        {step === 5 && (
          <div className="flex flex-col gap-0">
            <ProgressDots filled={5} />
            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
              Passo 5 de {TOTAL_STEPS} · Situação financeira
            </p>
            <div className="h-3" />
            <SubDots active={0} />
            <div className="h-4" />
            <h2 className="text-xl font-bold text-gray-900 text-center">
              Quanto você tem agora?
            </h2>
            <p className="text-sm text-gray-400 text-center mt-1 mb-6">
              Isso define seu ponto de partida real no app.
            </p>

            <p className="text-xs font-semibold text-gray-500 text-center mb-1">
              Saldo atual em conta
            </p>
            <BigCurrencyInput value={balance} onChange={setBalance} />

            <div className="mt-3 flex items-start gap-1.5 text-sm" style={{ color: '#6b7280' }}>
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <span className="leading-snug">
                Informe o valor que você tem na conta agora, já considerando tudo que recebeu e pagou este mês.
              </span>
            </div>

            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-500 mb-1">
              Reserva de emergência{' '}
              <span className="font-normal text-gray-400">(opcional)</span>
            </p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <span className="text-sm text-gray-400 font-medium flex-shrink-0">R$</span>
              <input
                type="text"
                inputMode="decimal"
                value={emergency}
                onChange={(e) =>
                  setEmergency(e.target.value.replace(/[^0-9.,]/g, ''))
                }
                placeholder="0,00"
                className="min-w-0 flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-300"
                style={{ caretColor: 'var(--accent)' }}
              />
            </div>

            <div className="h-7" />
            <NavRow
              onBack={goBack}
              onPrimary={handleStepAContinue}
              primaryLabel="Próximo"
              primaryDisabled={balanceNum <= 0}
            />
            <SkipLink label="Pular por agora" onSkip={handleSkipFinance} />
          </div>
        )}

        {/* ── Tela 6 — Situação financeira · B: o que já aconteceu ──────── */}
        {step === 6 && (
          <div className="flex flex-col gap-0">
            <ProgressDots filled={5} />
            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
              Passo 5 de {TOTAL_STEPS} · Situação financeira
            </p>
            <div className="h-3" />
            <SubDots active={1} />
            <div className="h-4" />
            <h2 className="text-xl font-bold text-gray-900 text-center">
              O que já aconteceu esse mês?
            </h2>
            <p className="text-sm text-gray-400 text-center mt-1 mb-5">
              Vamos deixar o app igual à sua vida real agora.
            </p>

            {loadingB ? (
              <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>
            ) : (
              <div className="space-y-4">
                {(salaryRec || obligations.length > 0) && (
                  <div className="flex items-start gap-1.5 text-sm" style={{ color: '#6b7280' }}>
                    <Info size={14} className="flex-shrink-0 mt-0.5" />
                    <span className="leading-snug">
                      Marque apenas o que ainda não está refletido no saldo informado acima.
                    </span>
                  </div>
                )}
                {salaryRec && (
                  <div className="rounded-xl border border-gray-100 p-3" style={{ background: '#f9fafb' }}>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Seu salário deste mês já caiu?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSalaryDropped(false)}
                        className="py-2 rounded-lg border text-sm font-semibold transition-colors"
                        style={
                          !salaryDropped
                            ? {
                                background: 'var(--accent-bg)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent)',
                              }
                            : {
                                background: '#fff',
                                borderColor: '#f3f4f6',
                                color: '#6b7280',
                              }
                        }
                      >
                        Ainda não
                      </button>
                      <button
                        onClick={() => setSalaryDropped(true)}
                        className="py-2 rounded-lg border text-sm font-semibold transition-colors"
                        style={
                          salaryDropped
                            ? {
                                background: 'var(--accent-bg)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent)',
                              }
                            : {
                                background: '#fff',
                                borderColor: '#f3f4f6',
                                color: '#6b7280',
                              }
                        }
                      >
                        Sim, já caiu
                      </button>
                    </div>
                    {salaryDropped && (
                      <p className="text-xs mt-2" style={{ color: 'var(--accent)' }}>
                        Vamos marcar {formatCurrency(salaryRec.amount)} como recebido.
                      </p>
                    )}
                  </div>
                )}

                {obligations.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Quais contas você já pagou?
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto -mx-1 px-1">
                      {obligations.map((ob) => {
                        const checked = paidObligationIds.has(ob.id);
                        return (
                          <button
                            key={ob.id}
                            onClick={() => togglePaidObligation(ob.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors"
                            style={
                              checked
                                ? {
                                    background: 'var(--accent-bg)',
                                    borderColor: 'var(--accent)',
                                  }
                                : {
                                    background: '#f9fafb',
                                    borderColor: '#f3f4f6',
                                  }
                            }
                          >
                            <div
                              className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                              style={
                                checked
                                  ? { background: 'var(--accent)', borderColor: 'var(--accent)' }
                                  : { background: '#fff', borderColor: '#d1d5db' }
                              }
                            >
                              {checked ? '✓' : ''}
                            </div>
                            <span className="flex-1 min-w-0 truncate text-sm text-gray-800">
                              {ob.description}
                            </span>
                            <span className="text-sm font-semibold text-gray-600 flex-shrink-0">
                              {formatCurrency(ob.amount)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  !salaryRec && (
                    <p className="text-sm text-gray-400 text-center py-6">
                      Você ainda não cadastrou contas fixas. Pode seguir em frente.
                    </p>
                  )
                )}
              </div>
            )}

            <div className="h-7" />
            <NavRow
              onBack={goBack}
              onPrimary={() => goTo(7)}
              primaryLabel="Próximo"
              primaryDisabled={loadingB}
            />
            <SkipLink label="Pular por agora" onSkip={handleSkipFinance} />
          </div>
        )}

        {/* ── Tela 7 — Situação financeira · C: resumo + tudo pronto ────── */}
        {step === 7 && (
          <div className="flex flex-col items-center text-center gap-0">
            <div
              className="w-16 h-16 rounded-full border-2 flex items-center justify-center text-3xl mb-4"
              style={{
                background: 'var(--accent-bg)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
                animation: 'fade-in-scale 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
              }}
            >
              ✓
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Tudo configurado!
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              Veja como você começa no TôOrganizado.
            </p>

            {/* Resumo financeiro (saldo de partida) */}
            <div
              className="w-full rounded-xl px-4 py-4 mb-4 border text-center"
              style={{
                background: 'var(--accent-bg)',
                borderColor: 'var(--accent-soft)',
              }}
            >
              <p className="text-xs text-gray-500">Você começa com</p>
              <p
                className="text-3xl font-bold my-1"
                style={{ color: 'var(--accent)' }}
              >
                {formatCurrency(balanceNum)}
              </p>
              <p className="text-xs text-gray-500">em conta</p>
              {paidThisMonth > 0 && (
                <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-white">
                  <span className="font-semibold">
                    {formatCurrency(paidThisMonth)}
                  </span>{' '}
                  já saiu esse mês
                </p>
              )}
            </div>

            {/* Resumo dos itens cadastrados */}
            {(savedIncome > 0 ||
              savedRecurringCount > 0 ||
              savedCardCount > 0 ||
              savedSavings > 0 ||
              parseAmount(emergency) > 0 ||
              (salaryDropped && salaryRec)) && (
              <div className="w-full bg-gray-50 rounded-xl px-4 py-4 mb-6 space-y-2.5 text-left">
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
                {parseAmount(emergency) > 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
                    <span>
                      Reserva de{' '}
                      <span className="font-semibold">
                        {formatCurrency(parseAmount(emergency))}
                      </span>{' '}
                      registrada
                    </span>
                  </div>
                )}
                {salaryDropped && salaryRec && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="font-bold" style={{ color: 'var(--accent)' }}>✓</span>
                    <span>Salário deste mês marcado como recebido</span>
                  </div>
                )}
              </div>
            )}

            {commitError && (
              <div
                role="alert"
                className="mt-4 mb-2 text-xs leading-relaxed text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5"
              >
                {commitError}{' '}
                <span className="font-medium">Clique de novo para continuar mesmo assim.</span>
              </div>
            )}
            <NavRow
              onBack={goBack}
              onPrimary={handleFinish}
              primaryLabel={commitError ? 'Continuar mesmo assim' : 'Começar organizado'}
              loading={committing}
            />
            <SkipLink label="Pular por agora" onSkip={handleSkipFinance} />
          </div>
        )}
      </div>
    </main>
  );
}
