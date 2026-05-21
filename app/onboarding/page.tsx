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
  deleteExpense,
  getAssets,
  createAsset,
  updateAsset,
  getMonthlyObligations,
  markObligationAsPaid,
} from '@/lib/storage';
import type { MonthlyObligation, RecurringExpense } from '@/lib/types';
import { OnboardingProgress } from './_components/OnboardingProgress';
import { PrimaryButton } from './_components/OnboardingNav';
import { OnboardingStep1Renda } from './_components/OnboardingStep1Renda';
import {
  OnboardingStep2Recorrentes,
  CHIPS,
} from './_components/OnboardingStep2Recorrentes';
import {
  OnboardingStep3Cartoes,
  EMPTY_CARD,
  MAX_CARDS,
  type CardForm,
} from './_components/OnboardingStep3Cartoes';
import { OnboardingStep4Meta } from './_components/OnboardingStep4Meta';
import { OnboardingStep5Financeiro } from './_components/OnboardingStep5Financeiro';
import { OnboardingResumo } from './_components/OnboardingResumo';

// 5 passos visíveis: renda, contas fixas, cartões, meta, situação financeira.
// A situação financeira tem 3 sub-etapas (A/B/C) mas conta como 1 passo.
const TOTAL_STEPS = 5;

function parseAmount(str: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

function Wordmark() {
  return (
    <div className="flex justify-center mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-horizontal.png" alt="TôOrganizado" className="h-6 w-auto" />
    </div>
  );
}

// 0 boas-vindas · 1 renda · 2 contas fixas · 3 cartões · 4 meta
// 5 sit. financeira A · 6 sit. financeira B · 7 sit. financeira C (resumo final)
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
      // O saldo do 5A representa o saldo FECHADO ("já considerando tudo que
      // recebeu e pagou este mês"). A entry 'Saldo inicial' precisa ser a
      // ABERTURA equivalente: opening = fechado − receitas-que-vão-virar-entry
      // + despesas-que-vão-virar-entry. Sem isso, o salário marcado em 5B (ou
      // auto-lançado em /) é somado em cima do fechado e dobra o saldo na home.
      let opening = bal;
      try {
        const todayDay = new Date().getDate();
        const allRecurring = await getRecurringExpenses();
        for (const r of allRecurring) {
          if (!r.active || r.type !== 'income') continue;
          // Subtraímos qualquer recorrente income que vai aparecer como entry
          // neste mês — seja porque o user marcou "Sim, já caiu" em 5B (lançado
          // logo abaixo), seja porque o checkAndGenerateIncomeEntries vai lançar
          // sozinho no /  (dayOfMonth ≤ hoje). As duas condições são OR — se as
          // duas valem para o mesmo recorrente, ele só é lançado uma vez (dedupe
          // por recurring_expense_id) e portanto subtraído uma vez.
          const manuallyMarked = !!salaryRec && r.id === salaryRec.id && salaryDropped;
          const autoLanced =
            typeof r.dayOfMonth === 'number' && r.dayOfMonth <= todayDay;
          if (manuallyMarked || autoLanced) {
            opening -= r.amount;
          }
        }
      } catch (e) {
        console.error('Onboarding: erro ao listar recorrentes p/ saldo:', e);
      }
      for (const ob of obligations) {
        if (paidObligationIds.has(ob.id)) opening += ob.amount;
      }

      try {
        const all = await getExpenses();
        const existing = all.find((e) => e.category === 'Saldo inicial');
        if (opening === 0) {
          if (existing) await deleteExpense(existing.id);
        } else {
          const type = opening > 0 ? 'income' : 'expense';
          const amount = Math.abs(opening);
          if (existing) {
            if (existing.amount !== amount || existing.type !== type) {
              await updateExpense(existing.id, {
                type,
                amount,
                description: 'Saldo inicial',
                category: 'Saldo inicial',
                date: existing.date,
                recurringExpenseId: existing.recurringExpenseId,
                creditCardId: existing.creditCardId,
                isCredit: existing.isCredit,
                billingMonth: existing.billingMonth,
              });
            }
          } else {
            await addExpense({
              type,
              amount,
              description: 'Saldo inicial',
              category: 'Saldo inicial',
              date: today,
            });
          }
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
  const savingsNum = parseAmount(savings);
  const balanceNum = parseAmount(balance);
  const emergencyNum = parseAmount(emergency);
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

        {step === 0 && (
          <div className="flex flex-col items-center text-center gap-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Olá, {userName || '…'}! 👋
            </h1>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              Vamos configurar seu TôOrganizado em {TOTAL_STEPS} passos rápidos.
            </p>
            <OnboardingProgress filled={0} totalSteps={TOTAL_STEPS} />
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

        {step === 1 && (
          <OnboardingStep1Renda
            totalSteps={TOTAL_STEPS}
            income={income}
            setIncome={setIncome}
            incomeDay={incomeDay}
            setIncomeDay={setIncomeDay}
            incomeNum={incomeNum}
            saving={saving}
            onBack={goBack}
            onContinue={handleStep1Continue}
            onSkip={() => goTo(2)}
          />
        )}

        {step === 2 && (
          <OnboardingStep2Recorrentes
            totalSteps={TOTAL_STEPS}
            selectedChips={selectedChips}
            toggleChip={toggleChip}
            chipValues={chipValues}
            setChipValues={setChipValues}
            chipDueDays={chipDueDays}
            setChipDueDays={setChipDueDays}
            customName={customName}
            setCustomName={setCustomName}
            customValue={customValue}
            setCustomValue={setCustomValue}
            customDueDay={customDueDay}
            setCustomDueDay={setCustomDueDay}
            showCustomForm={showCustomForm}
            setShowCustomForm={setShowCustomForm}
            saving={saving}
            onBack={goBack}
            onContinue={handleStep2Continue}
            onSkip={() => goTo(3)}
          />
        )}

        {step === 3 && (
          <OnboardingStep3Cartoes
            totalSteps={TOTAL_STEPS}
            useCredit={useCredit}
            setUseCredit={setUseCredit}
            cards={cards}
            updateCard={updateCard}
            addCardRow={addCardRow}
            removeCardRow={removeCardRow}
            saving={saving}
            onBack={goBack}
            onContinue={handleStep3Continue}
            onSkip={() => { setUseCredit(false); goTo(4); }}
          />
        )}

        {step === 4 && (
          <OnboardingStep4Meta
            totalSteps={TOTAL_STEPS}
            savings={savings}
            setSavings={setSavings}
            savingsNum={savingsNum}
            savedIncome={savedIncome}
            saving={saving}
            onBack={goBack}
            onContinue={handleStep4Continue}
            onSkip={() => goTo(5)}
          />
        )}

        {step === 5 && (
          <OnboardingStep5Financeiro
            totalSteps={TOTAL_STEPS}
            subStep="A"
            balance={balance}
            setBalance={setBalance}
            emergency={emergency}
            setEmergency={setEmergency}
            balanceNum={balanceNum}
            loadingB={loadingB}
            salaryRec={salaryRec}
            salaryDropped={salaryDropped}
            setSalaryDropped={setSalaryDropped}
            obligations={obligations}
            paidObligationIds={paidObligationIds}
            togglePaidObligation={togglePaidObligation}
            onBack={goBack}
            onContinue={handleStepAContinue}
            onSkip={handleSkipFinance}
          />
        )}

        {step === 6 && (
          <OnboardingStep5Financeiro
            totalSteps={TOTAL_STEPS}
            subStep="B"
            balance={balance}
            setBalance={setBalance}
            emergency={emergency}
            setEmergency={setEmergency}
            balanceNum={balanceNum}
            loadingB={loadingB}
            salaryRec={salaryRec}
            salaryDropped={salaryDropped}
            setSalaryDropped={setSalaryDropped}
            obligations={obligations}
            paidObligationIds={paidObligationIds}
            togglePaidObligation={togglePaidObligation}
            onBack={goBack}
            onContinue={() => goTo(7)}
            onSkip={handleSkipFinance}
          />
        )}

        {step === 7 && (
          <OnboardingResumo
            balanceNum={balanceNum}
            emergencyNum={emergencyNum}
            paidThisMonth={paidThisMonth}
            savedIncome={savedIncome}
            savedRecurringCount={savedRecurringCount}
            savedCardCount={savedCardCount}
            savedSavings={savedSavings}
            salaryDropped={salaryDropped}
            salaryRec={salaryRec}
            commitError={commitError}
            committing={committing}
            onBack={goBack}
            onFinish={handleFinish}
            onSkip={handleSkipFinance}
          />
        )}
      </div>
    </main>
  );
}
