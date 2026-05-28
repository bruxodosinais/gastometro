'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import CategoryPickerSheet from '@/components/CategoryPickerSheet';
import { getErrorMessage } from '@/lib/errors';
import { retryAsync } from '@/lib/retry';
import {
  addExpense,
  addObligationForNewRecurring,
  addRecurringExpense,
  checkAndGenerateObligations,
  deleteExpense,
  deleteRecurringExpense,
  getCreditCards,
  getExpenses,
  getMonthlyObligations,
  getRecurringExpenses,
  markObligationAsPaid,
  unmarkObligationAsPaid,
  toggleRecurringExpense,
  updateRecurringExpense,
} from '@/lib/storage';
import { getMonthLabel } from '@/lib/calculations';
import {
  CreditCard as CreditCardType,
  EntryType,
  Expense,
  MonthlyObligation,
  RecurringExpense,
} from '@/lib/types';
import { useCategorySelector } from '@/hooks/useCategorySelector';
import { useSubscription } from '@/hooks/useSubscription';
import { PLAN_LIMITS } from '@/lib/planLimits';
import RecorrentesHeader, { RecorrentesTabs, type RecorrentesTab } from '../_components/recorrentes/RecorrentesHeader';
import RecorrentesCalendario from '../_components/recorrentes/RecorrentesCalendario';
import RecorrentesStats from '../_components/recorrentes/RecorrentesStats';
import RecorrentesList from '../_components/recorrentes/RecorrentesList';
import RecorrentesModals, { type VariablePayModalState } from '../_components/recorrentes/RecorrentesModals';

function findSimilarRecurring(desc: string, recurrings: RecurringExpense[]): RecurringExpense | null {
  const normalize = (s: string) =>
    s.toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const input = normalize(desc);
  if (input.length < 3) return null;
  const active = recurrings.filter((r) => r.active);
  for (const r of active) {
    if (normalize(r.description) === input) return r;
  }
  const inputWords = input.split(' ').filter((w) => w.length >= 3);
  for (const r of active) {
    const existingWords = normalize(r.description).split(' ').filter((w) => w.length >= 3);
    if (inputWords.some((w) => existingWords.includes(w))) return r;
  }
  return null;
}

export default function RecorrentesPage() {
  const todayMonthKey = new Date().toISOString().slice(0, 7);
  const subscription = useSubscription();

  const [recurrings, setRecurrings] = useState<RecurringExpense[]>([]);
  const [obligations, setObligations] = useState<MonthlyObligation[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(todayMonthKey);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [undoingIds, setUndoingIds] = useState<Set<string>>(new Set());
  const [paidExpenseIds, setPaidExpenseIds] = useState<Map<string, string>>(new Map());
  // BUG 2: receitas fixas usam o próprio lançamento (expenses) como prova de
  // recebimento — não dependem da tabela monthly_obligations (que é só para
  // despesas). receivingIds/unreceivingIds controlam o estado de cada ação.
  const [receivingIds, setReceivingIds] = useState<Set<string>>(new Set());
  const [unreceivingIds, setUnreceivingIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // form
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Alimentação');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [isVariable, setIsVariable] = useState(false);
  const [hasDuration, setHasDuration] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState('');
  const [isCredit, setIsCredit] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [saving, setSaving] = useState(false);
  const [descricaoError, setDescricaoError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<RecorrentesTab>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tabExpanded, setTabExpanded] = useState<{ all: boolean; pendentes: boolean; pagas: boolean }>({
    all: false,
    pendentes: false,
    pagas: false,
  });
  const [duplicateWarning, setDuplicateWarning] = useState<RecurringExpense | null>(null);
  const [variablePayModal, setVariablePayModal] = useState<VariablePayModalState>(null);
  const [variableAmount, setVariableAmount] = useState(0);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => parseInt(todayMonthKey.split('-')[0]));

  // edit modal
  const [editingRec, setEditingRec] = useState<RecurringExpense | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState(0);
  const [editDayOfMonth, setEditDayOfMonth] = useState('');
  const [editDueDay, setEditDueDay] = useState('');
  const [editIsVariable, setEditIsVariable] = useState(false);
  const [editHasDuration, setEditHasDuration] = useState(false);
  const [editTotalInstallments, setEditTotalInstallments] = useState('');
  const [editCategory, setEditCategory] = useState<string>('Alimentação');
  const [editSaving, setEditSaving] = useState(false);

  const isFirstLoad = useRef(true);

  const isCurrentMonth = selectedMonth === todayMonthKey;
  const isPastMonth = selectedMonth < todayMonthKey;
  const isFutureMonth = selectedMonth > todayMonthKey;

  useEffect(() => {
    if (!openMenuId) return;
    function close() { setOpenMenuId(null); }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'pendentes') setActiveTab('pendentes');

    async function loadData() {
      setLoadError(null);
      try {
        const [recs, obs, cards, exps] = await retryAsync(() =>
          Promise.all([
            getRecurringExpenses(),
            checkAndGenerateObligations().then(() => getMonthlyObligations(todayMonthKey)),
            getCreditCards(),
            getExpenses(),
          ])
        );
        setRecurrings(recs);
        setObligations(obs);
        setCreditCards(cards);
        setExpenses(exps);
        if (cards.length > 0) setSelectedCardId(cards[0].id);
        setReady(true);
        isFirstLoad.current = false;
      } catch (err) {
        setLoadError(getErrorMessage(err));
      }
    }
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFirstLoad.current) return;
    setLoadingMonth(true);
    getMonthlyObligations(selectedMonth).then((obs) => {
      setObligations(obs);
      setLoadingMonth(false);
    });
  }, [selectedMonth]);

  function handleTypeChange(type: EntryType) {
    setEntryType(type);
    setCategory(type === 'expense' ? 'Alimentação' : 'Salário');
    setShowCategoryPicker(false);
    if (type === 'income') setIsCredit(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!description.trim()) {
      setDescricaoError('Descrição é obrigatória');
      return;
    }

    const num = amount;
    const day = parseInt(dayOfMonth, 10);
    if (!num || num <= 0 || !day || day < 1 || day > 31) return;
    // dueDay é INDEPENDENTE de dayOfMonth: se vazio fica undefined (não herda).
    let due: number | undefined;
    if (dueDay.trim()) {
      const parsedDue = parseInt(dueDay, 10);
      if (!Number.isFinite(parsedDue) || parsedDue < 1 || parsedDue > 31) return;
      due = parsedDue;
    }
    // Parcelamento: só envia totalInstallments quando o toggle está ligado.
    let total: number | undefined;
    if (hasDuration) {
      const parsedTotal = parseInt(totalInstallments, 10);
      if (!Number.isFinite(parsedTotal) || parsedTotal < 1) {
        setFormError('Informe um número de parcelas válido (mínimo 1).');
        return;
      }
      total = parsedTotal;
    }

    setSaving(true);
    setFormError(null);
    try {
      const trimmed = description.trim();
      const normalizedDesc = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      const saved = await addRecurringExpense({
        description: normalizedDesc,
        amount: num,
        category,
        type: entryType,
        dayOfMonth: day,
        dueDay: due,
        active: true,
        isVariable,
        totalInstallments: total,
        ...(entryType === 'expense' && isCredit && selectedCardId
          ? { isCredit: true, creditCardId: selectedCardId }
          : { isCredit: false, creditCardId: undefined }),
      });
      setRecurrings((prev) => [saved, ...prev]);

      if (saved.type === 'expense') {
        const ob = await addObligationForNewRecurring(saved);
        if (ob)
          setObligations((prev) =>
            [...prev, ob].sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99))
          );
      }

      setAmount(0);
      setDescription('');
      setDayOfMonth('');
      setDueDay('');
      setIsVariable(false);
      setHasDuration(false);
      setTotalInstallments('');
      setIsCredit(false);
      setDuplicateWarning(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(rec: RecurringExpense) {
    setEditingRec(rec);
    setEditDesc(rec.description ?? '');
    setEditAmount(rec.amount);
    setEditDayOfMonth(
      typeof rec.dayOfMonth === 'number' && rec.dayOfMonth >= 1 && rec.dayOfMonth <= 31
        ? String(rec.dayOfMonth)
        : ''
    );
    setEditDueDay(
      typeof rec.dueDay === 'number' && rec.dueDay >= 1 && rec.dueDay <= 31
        ? String(rec.dueDay)
        : ''
    );
    setEditIsVariable(rec.isVariable);
    setEditHasDuration(typeof rec.totalInstallments === 'number');
    setEditTotalInstallments(
      typeof rec.totalInstallments === 'number' ? String(rec.totalInstallments) : ''
    );
    setEditCategory(rec.category);
  }

  async function handleEditSave() {
    if (!editingRec) return;
    const num = editAmount;
    if (!num || num <= 0) return;

    // dayOfMonth e dueDay são salvos de forma independente. Vazio → null
    // (limpa o campo no banco). Um não preenche/sobrescreve o outro.
    const parseDay = (raw: string): number | null => {
      if (!raw.trim()) return null;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 1 && n <= 31 ? n : null;
    };
    const dayOfMonthValue = parseDay(editDayOfMonth);
    const dueDayValue = parseDay(editDueDay);
    // Se o usuário digitou algo inválido (não vazio mas fora do range), aborta.
    if (editDayOfMonth.trim() && dayOfMonthValue === null) return;
    if (editDueDay.trim() && dueDayValue === null) return;

    const trimmed = editDesc.trim();
    const normalizedDesc = trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase() : '';

    // Parcelamento: hasDuration ligado e válido → grava; desligado → grava null (limpa).
    let totalValue: number | null = null;
    if (editHasDuration) {
      const parsedTotal = parseInt(editTotalInstallments, 10);
      if (!Number.isFinite(parsedTotal) || parsedTotal < 1) {
        setFormError('Informe um número de parcelas válido (mínimo 1).');
        return;
      }
      totalValue = parsedTotal;
    }

    setEditSaving(true);
    try {
      const updated = await updateRecurringExpense(editingRec.id, {
        description: normalizedDesc,
        amount: num,
        category: editCategory,
        dayOfMonth: dayOfMonthValue,
        dueDay: dueDayValue,
        isVariable: editIsVariable,
        totalInstallments: totalValue,
      });
      setRecurrings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingRec(null);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setEditSaving(false);
    }
  }

  async function handleToggle(rec: RecurringExpense) {
    const next = !rec.active;
    setRecurrings((prev) => prev.map((r) => (r.id === rec.id ? { ...r, active: next } : r)));
    await toggleRecurringExpense(rec.id, next);
  }

  async function handleDelete(id: string) {
    setRecurrings((prev) => prev.filter((r) => r.id !== id));
    await deleteRecurringExpense(id);
  }

  async function handleMarkObligationPaid(obligationId: string, actualAmount?: number) {
    const ob = obligations.find((o) => o.id === obligationId);
    if (!ob || payingIds.has(obligationId)) return;
    setPayingIds((prev) => new Set([...prev, obligationId]));
    const optimisticPaidAt = new Date().toISOString();
    setObligations((prev) =>
      prev.map((o) => (o.id === obligationId ? { ...o, status: 'paid' as const, paidAt: optimisticPaidAt } : o))
    );
    try {
      const { expense } = await markObligationAsPaid(obligationId, ob, actualAmount);
      setPaidExpenseIds((prev) => new Map(prev).set(obligationId, expense.id));
    } catch {
      setObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? { ...o, status: 'pending' as const, paidAt: undefined } : o))
      );
    } finally {
      setPayingIds((prev) => {
        const next = new Set(prev);
        next.delete(obligationId);
        return next;
      });
    }
  }

  async function handleUnmarkObligationPaid(obligationId: string) {
    const expenseId = paidExpenseIds.get(obligationId);
    if (!expenseId || undoingIds.has(obligationId)) return;
    setUndoingIds((prev) => new Set([...prev, obligationId]));
    setObligations((prev) =>
      prev.map((o) => (o.id === obligationId ? { ...o, status: 'pending' as const } : o))
    );
    try {
      await unmarkObligationAsPaid(obligationId, expenseId);
      setPaidExpenseIds((prev) => {
        const next = new Map(prev);
        next.delete(obligationId);
        return next;
      });
    } catch {
      setObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? { ...o, status: 'paid' as const } : o))
      );
    } finally {
      setUndoingIds((prev) => {
        const next = new Set(prev);
        next.delete(obligationId);
        return next;
      });
    }
  }

  // BUG 2: "Marcar recebido" — idêntico ao "Marcar pago" das despesas:
  // cria um lançamento type='income' linkado ao recurring_expense_id, com a
  // data atual. O recebimento é detectado por isPaidInMonth (que olha os
  // expenses linkados), então não precisamos da tabela de obrigações.
  async function handleMarkIncomeReceived(rec: RecurringExpense) {
    if (receivingIds.has(rec.id)) return;
    // Guarda defensiva: já recebido neste mês → não duplica.
    if (isPaidInMonth(rec, selectedMonth)) return;
    setReceivingIds((prev) => new Set([...prev, rec.id]));
    try {
      const saved = await addExpense(
        {
          type: 'income',
          amount: rec.amount,
          description: rec.description,
          category: rec.category,
          date: new Date().toISOString().slice(0, 10),
        },
        rec.id
      );
      setExpenses((prev) => [saved, ...prev]);
    } catch {
      // Silencioso: estado não muda, o botão volta a ficar disponível.
    } finally {
      setReceivingIds((prev) => {
        const next = new Set(prev);
        next.delete(rec.id);
        return next;
      });
    }
  }

  async function handleUnmarkIncomeReceived(rec: RecurringExpense) {
    if (unreceivingIds.has(rec.id)) return;
    const entry = expenses.find(
      (e) =>
        e.recurringExpenseId === rec.id &&
        typeof e.date === 'string' &&
        e.date.slice(0, 7) === selectedMonth
    );
    if (!entry) return;
    setUnreceivingIds((prev) => new Set([...prev, rec.id]));
    const snapshot = expenses;
    setExpenses((prev) => prev.filter((e) => e.id !== entry.id));
    try {
      await deleteExpense(entry.id);
    } catch {
      setExpenses(snapshot);
    } finally {
      setUnreceivingIds((prev) => {
        const next = new Set(prev);
        next.delete(rec.id);
        return next;
      });
    }
  }

  // ── Form input handlers (extraídos de onChange inline) ────────────────────

  function handleDescriptionChange(val: string) {
    setDescription(val);
    if (descricaoError) setDescricaoError('');
    if (val.trim().length >= 3) {
      setDuplicateWarning(findSimilarRecurring(val, recurrings));
    } else {
      setDuplicateWarning(null);
    }
  }

  function handleClearDuplicate() {
    setDescription('');
    setDuplicateWarning(null);
  }

  // ── Card / modal handlers ─────────────────────────────────────────────────

  async function handleCardMarkPaidClick(rec: RecurringExpense) {
    let ob = obligations.find((o) => o.recurringExpenseId === rec.id);
    if (!ob) {
      const created = await addObligationForNewRecurring(rec);
      if (!created) return;
      ob = created;
      setObligations((prev) =>
        [...prev, created].sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99))
      );
    }
    if (rec.isVariable) {
      setVariablePayModal({ obligationId: ob.id, estimatedAmount: rec.amount });
      setVariableAmount(rec.amount);
    } else {
      handleMarkObligationPaid(ob.id);
    }
  }

  function handleConfirmVariablePay() {
    if (!variablePayModal) return;
    const parsed = variableAmount;
    if (!parsed || parsed <= 0) return;
    const id = variablePayModal.obligationId;
    setVariablePayModal(null);
    handleMarkObligationPaid(id, parsed);
  }

  // ── Calendar handlers ─────────────────────────────────────────────────────

  function handleSelectMonth(key: string) {
    startTransition(() => setSelectedMonth(key));
  }

  function handleChangePickerYear(delta: number) {
    setPickerYear((y) => y + delta);
  }

  function handleOpenPicker() {
    setPickerYear(parseInt(selectedMonth.split('-')[0]));
    setPickerOpen(true);
  }

  // ── Tabs / expansion handlers ─────────────────────────────────────────────

  function handleExpandTab(tab: RecorrentesTab) {
    setTabExpanded((prev) => ({ ...prev, [tab]: true }));
  }

  function handleCollapseTab(tab: RecorrentesTab) {
    setTabExpanded((prev) => ({ ...prev, [tab]: false }));
  }

  const { categories: categoryOptions } = useCategorySelector(entryType);

  const selectedMonthLabel = getMonthLabel(selectedMonth);
  const selectedMonthLabelCap = selectedMonthLabel.charAt(0).toUpperCase() + selectedMonthLabel.slice(1);

  const todayDay = new Date().getDate();
  const totalMonthlyAmount = recurrings
    .filter((r) => r.active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  // Verifica se um recorrente foi "pago" em um determinado mês olhando os expenses.
  // Defensivo: não depende da tabela monthly_obligations.
  const isPaidInMonth = (rec: RecurringExpense, monthKey: string): boolean => {
    return expenses.some(
      (e) =>
        e.recurringExpenseId === rec.id &&
        typeof e.date === 'string' &&
        e.date.slice(0, 7) === monthKey
    );
  };

  const filteredRecurrings = recurrings.filter((rec) => {
    if (activeTab === 'all') return true;
    if (!rec.active) return false;

    const paidThisSelectedMonth = isPaidInMonth(rec, selectedMonth);

    if (isPastMonth) {
      return activeTab === 'pendentes' ? !paidThisSelectedMonth : paidThisSelectedMonth;
    }

    if (isFutureMonth) {
      // Mês futuro: tudo ativo aparece como "previsto" na aba Pendentes
      return activeTab === 'pendentes';
    }

    // Mês corrente
    if (activeTab === 'pagas') return paidThisSelectedMonth;

    // Pendentes: não foi pago neste mês + dia de referência já passou
    if (paidThisSelectedMonth) return false;
    const diaRef =
      typeof rec.dayOfMonth === 'number' && rec.dayOfMonth >= 1 && rec.dayOfMonth <= 31
        ? rec.dayOfMonth
        : 1;
    return diaRef <= todayDay;
  });

  const expenseRecs = filteredRecurrings.filter((r) => r.type === 'expense');
  const incomeRecs = filteredRecurrings.filter((r) => r.type === 'income');

  const activeRecurrings = recurrings.filter((r) => r.active !== false).length;
  const atRecurringsLimit = subscription.isFree && activeRecurrings >= PLAN_LIMITS.free.recurringExpenses;

  // ── Loading / error states ────────────────────────────────────────────────

  if (!ready) {
    if (loadError) {
      return (
        <main
          style={{
            maxWidth: 440,
            margin: '0 auto',
            padding: '64px 24px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 48 }}>😕</p>
          <p style={{ color: 'var(--text-2)', fontWeight: 600 }}>{loadError}</p>
          <button
            onClick={() => {
              setReady(false);
              setLoadError(null);
              retryAsync(() =>
                Promise.all([
                  getRecurringExpenses(),
                  checkAndGenerateObligations().then(() => getMonthlyObligations(todayMonthKey)),
                  getCreditCards(),
                  getExpenses(),
                ])
              ).then(([recs, obs, cards, exps]) => {
                setRecurrings(recs);
                setObligations(obs);
                setCreditCards(cards);
                setExpenses(exps);
                if (cards.length > 0) setSelectedCardId(cards[0].id);
                setReady(true);
                isFirstLoad.current = false;
              }).catch((err) => setLoadError(getErrorMessage(err)));
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--accent)',
              color: 'white',
              fontSize: 14,
              fontWeight: 700,
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} />
            Tentar novamente
          </button>
        </main>
      );
    }
    return (
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '2.5px solid var(--accent)',
            borderTopColor: 'transparent',
            animation: 'spin 0.7s linear infinite',
          }}
          className="animate-spin"
        />
      </main>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main
      className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6"
      style={{ background: 'var(--bg)', minHeight: '100vh' }}
    >
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
          Recorrentes
        </h1>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', margin: 0 }}>
          Gastos e receitas fixas mensais
        </p>
      </div>

      <div className="md:grid md:grid-cols-[420px_1fr] md:gap-8 md:items-start">

        {/* ── FORM COLUMN ─────────────────────────────────────────────────── */}
        <div>
          <RecorrentesHeader
            isFormOpen={isFormOpen}
            onToggleForm={() => setIsFormOpen((v) => !v)}
            atRecurringsLimit={atRecurringsLimit}
            entryType={entryType}
            amount={amount}
            description={description}
            category={category}
            dayOfMonth={dayOfMonth}
            dueDay={dueDay}
            isVariable={isVariable}
            hasDuration={hasDuration}
            totalInstallments={totalInstallments}
            isCredit={isCredit}
            selectedCardId={selectedCardId}
            creditCards={creditCards}
            saving={saving}
            descricaoError={descricaoError}
            formError={formError}
            inputFocused={inputFocused}
            duplicateWarning={duplicateWarning}
            onTypeChange={handleTypeChange}
            onAmountChange={setAmount}
            onAmountFocus={() => setInputFocused(true)}
            onAmountBlur={() => setInputFocused(false)}
            onDescriptionChange={handleDescriptionChange}
            onDayOfMonthChange={setDayOfMonth}
            onDueDayChange={setDueDay}
            onToggleVariable={() => setIsVariable((v) => !v)}
            onToggleDuration={() => setHasDuration((v) => !v)}
            onTotalInstallmentsChange={setTotalInstallments}
            onToggleCredit={() => setIsCredit((v) => !v)}
            onSelectedCardChange={setSelectedCardId}
            onOpenCategoryPicker={() => setShowCategoryPicker(true)}
            onClearDuplicate={handleClearDuplicate}
            onDismissDuplicate={() => setDuplicateWarning(null)}
            onSubmit={handleSubmit}
          />
        </div>

        {/* ── LIST COLUMN ─────────────────────────────────────────────────── */}
        <div>
          {/* Section title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              paddingTop: 0,
              marginBottom: 14,
            }}
            className="pt-6 md:pt-0"
          >
            <div style={{ flex: 1, height: 1, background: 'var(--border-2)' }} />
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0, whiteSpace: 'nowrap' }}>
              Cadastrados
              {recurrings.length > 0 && (
                <span style={{ color: 'var(--text-3)', fontWeight: 500, marginLeft: 6 }}>
                  · {selectedMonthLabel}
                </span>
              )}
            </p>
            <div style={{ flex: 1, height: 1, background: 'var(--border-2)' }} />
          </div>

          <RecorrentesCalendario
            selectedMonth={selectedMonth}
            todayMonthKey={todayMonthKey}
            selectedMonthLabel={selectedMonthLabel}
            selectedMonthLabelCap={selectedMonthLabelCap}
            loadingMonth={loadingMonth}
            isCurrentMonth={isCurrentMonth}
            pickerOpen={pickerOpen}
            pickerYear={pickerYear}
            onSelectMonth={handleSelectMonth}
            onOpenPicker={handleOpenPicker}
            onClosePicker={() => setPickerOpen(false)}
            onChangePickerYear={handleChangePickerYear}
          />

          {recurrings.length > 0 && (
            <RecorrentesStats
              activeCount={recurrings.filter((r) => r.active).length}
              totalMonthlyAmount={totalMonthlyAmount}
            />
          )}

          {recurrings.length > 0 && (
            <RecorrentesTabs activeTab={activeTab} onTabChange={setActiveTab} />
          )}

          <RecorrentesList
            recurringsLength={recurrings.length}
            filteredLength={filteredRecurrings.length}
            expenseRecs={expenseRecs}
            incomeRecs={incomeRecs}
            activeTab={activeTab}
            tabExpanded={tabExpanded}
            onExpandTab={handleExpandTab}
            onCollapseTab={handleCollapseTab}
            cardProps={{
              expenses,
              obligations,
              creditCards,
              selectedMonth,
              isCurrentMonth,
              isPastMonth,
              todayDay,
              payingIds,
              undoingIds,
              receivingIds,
              unreceivingIds,
              paidExpenseIds,
              openMenuId,
              onToggleMenu: setOpenMenuId,
              onMarkPaidClick: handleCardMarkPaidClick,
              onUnmarkObligationPaid: handleUnmarkObligationPaid,
              onMarkIncomeReceived: handleMarkIncomeReceived,
              onUnmarkIncomeReceived: handleUnmarkIncomeReceived,
              onEdit: openEditModal,
              onToggleActive: handleToggle,
              onDelete: handleDelete,
            }}
          />
        </div>
      </div>

      {/* ── CATEGORY PICKER ─────────────────────────────────────────────────── */}
      <CategoryPickerSheet
        open={showCategoryPicker}
        options={categoryOptions}
        selected={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
        columns={entryType === 'expense' ? 4 : 2}
      />

      <RecorrentesModals
        variablePayModal={variablePayModal}
        variableAmount={variableAmount}
        onVariableAmountChange={setVariableAmount}
        onCancelVariablePay={() => setVariablePayModal(null)}
        onConfirmVariablePay={handleConfirmVariablePay}
        editingRec={editingRec}
        editDesc={editDesc}
        onEditDescChange={setEditDesc}
        editAmount={editAmount}
        onEditAmountChange={setEditAmount}
        editDayOfMonth={editDayOfMonth}
        onEditDayOfMonthChange={setEditDayOfMonth}
        editDueDay={editDueDay}
        onEditDueDayChange={setEditDueDay}
        editIsVariable={editIsVariable}
        onEditIsVariableToggle={() => setEditIsVariable((v) => !v)}
        editHasDuration={editHasDuration}
        onEditHasDurationToggle={() => setEditHasDuration((v) => !v)}
        editTotalInstallments={editTotalInstallments}
        onEditTotalInstallmentsChange={setEditTotalInstallments}
        editSaving={editSaving}
        onCancelEdit={() => setEditingRec(null)}
        onSaveEdit={handleEditSave}
      />
    </main>
  );
}
