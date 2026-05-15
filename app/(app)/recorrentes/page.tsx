'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Pause, Pencil, Play, RefreshCw, Trash2 } from 'lucide-react';
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
import { formatCurrency, getMonthLabel } from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import {
  Category,
  CreditCard as CreditCardType,
  EntryType,
  Expense,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  MonthlyObligation,
  RecurringExpense,
} from '@/lib/types';
import { useSubscription } from '@/hooks/useSubscription';
import { PLAN_LIMITS } from '@/lib/planLimits';
import UpgradeBanner from '@/components/UpgradeBanner';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}


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

// ── Style helpers ─────────────────────────────────────────────────────────────

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
  display: 'block',
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1.5px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  padding: '12px 15px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text)',
  fontFamily: 'Nunito, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

const menuItemStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'Nunito, sans-serif',
  textAlign: 'left',
};

// ── Switch ────────────────────────────────────────────────────────────────────

function Switch({ on, onToggle, ariaLabel }: { on: boolean; onToggle: () => void; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        flexShrink: 0,
        borderRadius: 11,
        border: on ? 'none' : '1.5px solid var(--border)',
        background: on ? 'var(--accent)' : 'var(--bg)',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: on ? 3 : 2,
          left: on ? 21 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: on ? 'white' : 'var(--text-3)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          transition: 'left 0.2s ease, background 0.2s ease',
        }}
      />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('Alimentação');
  const [dayOfMonth, setDayOfMonth] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [isVariable, setIsVariable] = useState(false);
  const [isCredit, setIsCredit] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [saving, setSaving] = useState(false);
  const [descricaoError, setDescricaoError] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [inputScale, setInputScale] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'pendentes' | 'pagas'>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [tabExpanded, setTabExpanded] = useState<{ all: boolean; pendentes: boolean; pagas: boolean }>({
    all: false,
    pendentes: false,
    pagas: false,
  });
  const [duplicateWarning, setDuplicateWarning] = useState<RecurringExpense | null>(null);
  const [variablePayModal, setVariablePayModal] = useState<{ obligationId: string; estimatedAmount: number } | null>(null);
  const [variableAmount, setVariableAmount] = useState('');

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => parseInt(todayMonthKey.split('-')[0]));

  // edit modal
  const [editingRec, setEditingRec] = useState<RecurringExpense | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDayOfMonth, setEditDayOfMonth] = useState('');
  const [editDueDay, setEditDueDay] = useState('');
  const [editIsVariable, setEditIsVariable] = useState(false);
  const [editCategory, setEditCategory] = useState<Category>('Alimentação');
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

    if (subscription.isFree) {
      const limit = PLAN_LIMITS.free.recurringExpenses;
      const activeCount = recurrings.filter((r) => r.active !== false).length;
      if (activeCount >= limit) {
        setFormError(
          `Você já tem ${limit} recorrentes cadastrados. Limite do plano gratuito.`,
        );
        return;
      }
    }

    if (!description.trim()) {
      setDescricaoError('Descrição é obrigatória');
      return;
    }

    const num = parseFloat(amount.replace(',', '.'));
    const day = parseInt(dayOfMonth, 10);
    if (!num || num <= 0 || !day || day < 1 || day > 31) return;
    // dueDay é INDEPENDENTE de dayOfMonth: se vazio fica undefined (não herda).
    let due: number | undefined;
    if (dueDay.trim()) {
      const parsedDue = parseInt(dueDay, 10);
      if (!Number.isFinite(parsedDue) || parsedDue < 1 || parsedDue > 31) return;
      due = parsedDue;
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

      setAmount('');
      setDescription('');
      setDayOfMonth('');
      setDueDay('');
      setIsVariable(false);
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
    setEditAmount(String(rec.amount));
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
    setEditCategory(rec.category);
  }

  async function handleEditSave() {
    if (!editingRec) return;
    const num = parseFloat(editAmount.replace(',', '.'));
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

    setEditSaving(true);
    try {
      const updated = await updateRecurringExpense(editingRec.id, {
        description: normalizedDesc,
        amount: num,
        category: editCategory,
        dayOfMonth: dayOfMonthValue,
        dueDay: dueDayValue,
        isVariable: editIsVariable,
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

  const categories = entryType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const selectedMonthLabel = getMonthLabel(selectedMonth);
  const selectedMonthLabelCap = selectedMonthLabel.charAt(0).toUpperCase() + selectedMonthLabel.slice(1);

  const hasAmount = amount !== '' && amount !== '0';
  const typeColor = entryType === 'income' ? 'var(--green)' : 'var(--red)';
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
          <button
            type="button"
            onClick={() => setIsFormOpen((v) => !v)}
            aria-expanded={isFormOpen}
            style={{
              position: 'relative',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              background: 'var(--surface)',
              border: '1.5px solid var(--accent)',
              borderRadius: 'var(--r)',
              padding: '12px 44px',
              marginBottom: isFormOpen ? 10 : 24,
              cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif',
              textAlign: 'center',
              transition: 'margin-bottom 0.25s ease',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
              + Novo recorrente
            </span>
            <ChevronDown
              size={18}
              color="var(--accent)"
              style={{
                position: 'absolute',
                right: 16,
                top: '50%',
                transform: isFormOpen
                  ? 'translateY(-50%) rotate(180deg)'
                  : 'translateY(-50%) rotate(0deg)',
                transition: 'transform 0.25s ease',
              }}
            />
          </button>

          <div
            style={{
              display: 'grid',
              gridTemplateRows: isFormOpen ? '1fr' : '0fr',
              transition: 'grid-template-rows 0.3s ease',
              marginBottom: isFormOpen ? 24 : 0,
            }}
          >
            <div style={{ overflow: 'hidden', minHeight: 0 }}>

          {subscription.isFree && recurrings.filter((r) => r.active !== false).length >= PLAN_LIMITS.free.recurringExpenses && (
            <UpgradeBanner
              variant="inline"
              feature="recorrentes"
              message={`Você já tem ${PLAN_LIMITS.free.recurringExpenses} recorrentes cadastrados. Limite do plano gratuito.`}
            />
          )}

          <form
            onSubmit={handleSubmit}
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--r)',
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* 1. TOGGLE GASTO / RECEITA */}
            <div
              style={{
                display: 'flex',
                padding: 4,
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg)',
                gap: 4,
              }}
            >
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  ...(entryType === 'expense'
                    ? { background: 'var(--red)', color: 'white', boxShadow: '0 1px 4px rgba(255,71,87,0.25)' }
                    : { background: 'transparent', color: 'var(--text-2)' }),
                }}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 'var(--r-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'Nunito, sans-serif',
                  fontSize: 14,
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                  ...(entryType === 'income'
                    ? { background: 'var(--green)', color: 'white', boxShadow: '0 1px 4px rgba(0,195,122,0.25)' }
                    : { background: 'transparent', color: 'var(--text-2)' }),
                }}
              >
                Receita
              </button>
            </div>

            {/* 2. VALOR HERO */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 0 18px',
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: hasAmount ? typeColor : 'var(--text-3)',
                  opacity: hasAmount ? 0.6 : 1,
                  transition: 'color 0.2s ease',
                  userSelect: 'none',
                }}
              >
                R$
              </span>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/[^0-9.,]/g, ''));
                    setInputScale(true);
                    setTimeout(() => setInputScale(false), 100);
                  }}
                  onFocus={(e) => {
                    setInputFocused(true);
                    if (e.target.value === '0') setAmount('');
                  }}
                  onBlur={() => setInputFocused(false)}
                  placeholder="0"
                  required
                  style={{
                    fontSize: 40,
                    fontWeight: 900,
                    fontFamily: 'Nunito, sans-serif',
                    letterSpacing: '-0.03em',
                    color: hasAmount ? typeColor : 'var(--text)',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    textAlign: 'center',
                    width: 200,
                    paddingBottom: 6,
                    transition: 'color 200ms ease',
                    caretColor: typeColor,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: typeColor,
                    borderRadius: 1,
                    opacity: inputFocused ? 1 : 0.45,
                    transition: 'opacity 0.2s ease, background 0.2s ease',
                  }}
                />
              </div>
            </div>

            {/* 3. TOGGLE VALOR VARIÁVEL */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  Valor variável
                </p>
                <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
                  {isVariable ? 'Valor acima é estimado — você define o real ao pagar' : 'Valor fixo todo mês'}
                </p>
              </div>
              <Switch on={isVariable} onToggle={() => setIsVariable((v) => !v)} ariaLabel="Valor variável" />
            </div>

            {/* 4. TOGGLE CARTÃO DE CRÉDITO */}
            {entryType === 'expense' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                      Pagar no cartão
                    </p>
                    <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
                      {isCredit ? 'Cobrado na fatura do cartão' : 'Débito / dinheiro'}
                    </p>
                  </div>
                  <Switch on={isCredit} onToggle={() => setIsCredit((v) => !v)} ariaLabel="Pagar no cartão" />
                </div>
                {isCredit && creditCards.length > 0 && (
                  <select
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    style={{ ...fieldStyle, marginTop: 8 }}
                  >
                    {creditCards.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                )}
                {isCredit && creditCards.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>
                    Nenhum cartão cadastrado.{' '}
                    <a href="/cartoes" style={{ color: 'var(--accent)' }}>Adicionar →</a>
                  </p>
                )}
              </div>
            )}

            {/* 5. DESCRIÇÃO */}
            <div>
              <label style={fieldLabelStyle}>Descrição</label>
              <input
                id="campo-descricao"
                type="text"
                value={description}
                onChange={(e) => {
                  const val = e.target.value;
                  setDescription(val);
                  if (descricaoError) setDescricaoError('');
                  if (val.trim().length >= 3) {
                    setDuplicateWarning(findSimilarRecurring(val, recurrings));
                  } else {
                    setDuplicateWarning(null);
                  }
                }}
                placeholder={
                  entryType === 'expense'
                    ? 'Ex: Netflix, Academia, Aluguel...'
                    : 'Ex: Salário, Freela mensal...'
                }
                maxLength={80}
                style={{
                  ...fieldStyle,
                  borderColor: descricaoError ? 'var(--red)' : 'var(--border)',
                }}
              />
              {descricaoError && (
                <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{descricaoError}</p>
              )}
              {duplicateWarning && (
                <div
                  style={{
                    marginTop: 8,
                    background: 'var(--yellow-bg)',
                    border: '1.5px solid rgba(255,184,0,0.25)',
                    borderRadius: 'var(--r-sm)',
                    padding: '10px 14px',
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--yellow-text)', margin: 0 }}>
                    ⚠️ Já existe um recorrente similar:{' '}
                    <strong>{duplicateWarning.description} ({formatCurrency(duplicateWarning.amount)})</strong>.
                    {' '}Deseja cadastrar mesmo assim?
                  </p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => { setDescription(''); setDuplicateWarning(null); }}
                      style={{ fontSize: 11, color: 'var(--yellow-text)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateWarning(null)}
                      style={{ fontSize: 11, color: 'var(--yellow-text)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      Cadastrar mesmo assim
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 6. DIA DE LANÇAMENTO + DIA DE VENCIMENTO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={fieldLabelStyle}>Dia de lançamento</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  placeholder="Ex: 1"
                  style={{ ...fieldStyle }}
                />
                <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
                  Quando aparece no histórico
                </p>
              </div>
              <div>
                <label style={fieldLabelStyle}>Dia de vencimento</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="Ex: 10"
                  style={{ ...fieldStyle }}
                />
                <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 4 }}>
                  Limite para pagar sem atraso
                </p>
              </div>
            </div>

            {/* 7. CATEGORIA */}
            <div>
              <label style={fieldLabelStyle}>Categoria</label>
              <button
                type="button"
                onClick={() => setShowCategoryPicker(true)}
                style={{
                  ...fieldStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                  {CATEGORY_CONFIG[category].icon}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {category}
                </span>
                <ChevronDown size={15} color="var(--text-3)" style={{ flexShrink: 0 }} />
              </button>
            </div>

            {/* ERRO */}
            {formError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--red-bg)',
                  border: '1.5px solid rgba(255,71,87,0.2)',
                  borderRadius: 'var(--r-sm)',
                  padding: '11px 14px',
                  color: 'var(--red)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                {formError}
              </div>
            )}

            {/* CTA */}
            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 'var(--r-sm)',
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                fontSize: 14,
                fontWeight: 800,
                fontFamily: 'Nunito, sans-serif',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: saving ? 0.7 : 1,
                transition: 'opacity 0.2s ease',
                boxShadow: '0 4px 12px var(--accent-shadow)',
              }}
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : 'Cadastrar recorrente'}
            </button>
          </form>
            </div>
          </div>
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

          {/* Seletor de mês */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              borderRadius: 'var(--r-sm)',
              padding: '4px 6px',
              marginBottom: 12,
            }}
          >
            <button
              onClick={() => startTransition(() => setSelectedMonth(shiftMonth(selectedMonth, -1)))}
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-2)',
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
              aria-label="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => { setPickerYear(parseInt(selectedMonth.split('-')[0])); setPickerOpen(true); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {selectedMonthLabelCap}
              </span>
              <ChevronDown size={12} color="var(--text-3)" />
              {loadingMonth && <Loader2 size={12} className="animate-spin" color="var(--text-3)" />}
            </button>
            <button
              onClick={() => startTransition(() => setSelectedMonth(shiftMonth(selectedMonth, 1)))}
              style={{
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-2)',
                background: 'transparent',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
              aria-label="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Aviso mês diferente */}
          {!isCurrentMonth && (
            <div
              style={{
                marginBottom: 10,
                padding: '9px 13px',
                background: 'var(--yellow-bg)',
                border: '1.5px solid rgba(255,184,0,0.2)',
                borderRadius: 'var(--r-sm)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--yellow-text)',
              }}
            >
              Visualizando {selectedMonthLabel} — volte ao mês atual para gerenciar pagamentos
            </div>
          )}

          {/* Resumo */}
          {recurrings.length > 0 && (
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
              {recurrings.filter((r) => r.active).length} recorrentes
              {totalMonthlyAmount > 0 && ` · ${formatCurrency(totalMonthlyAmount)} total`}
            </p>
          )}

          {/* Filter tabs */}
          {recurrings.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              {(['all', 'pendentes', 'pagas'] as const).map((tab) => {
                const labels = { all: 'Ver tudo', pendentes: 'Pendentes', pagas: 'Pagas / Recebidas' };
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => startTransition(() => setActiveTab(tab))}
                    style={{
                      paddingBottom: 4,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: 'Nunito, sans-serif',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text-3)',
                      cursor: 'pointer',
                      transition: 'color 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {recurrings.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 48, marginBottom: 12 }}>🔄</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
                Nenhuma conta fixa cadastrada
              </p>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', maxWidth: 280, margin: '0 auto' }}>
                Cadastre contas que se repetem todo mês — aluguel, streaming, academia — e nunca perca um vencimento.
              </p>
            </div>
          ) : filteredRecurrings.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>
              Nenhum item nesta categoria
            </p>
          ) : (() => {
            const MAX = 5;
            const isExpanded = tabExpanded[activeTab];
            // BUG 2: receitas fixas também aparecem nas abas Pendentes e
            // Pagas / Recebidas (não só em "Ver tudo").
            const totalCount = expenseRecs.length + incomeRecs.length;
            const expenseBudget = isExpanded
              ? expenseRecs.length
              : Math.min(expenseRecs.length, MAX);
            const incomeBudget = isExpanded
              ? incomeRecs.length
              : Math.max(0, MAX - expenseBudget);
            const visibleExpense = expenseRecs.slice(0, expenseBudget);
            const visibleIncome = incomeRecs.slice(0, incomeBudget);
            const hiddenCount = totalCount - (visibleExpense.length + visibleIncome.length);
            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Gastos fixos */}
              {visibleExpense.length > 0 && (
                <>
                  {activeTab === 'all' && (
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
                      Gastos fixos
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: visibleIncome.length > 0 ? 16 : 0 }}>
                    {visibleExpense.map((rec) => <RecurringItem key={rec.id} rec={rec} />)}
                  </div>
                </>
              )}

              {/* Receitas fixas */}
              {visibleIncome.length > 0 && (
                <>
                  {activeTab === 'all' && (
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-3)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        marginBottom: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
                      Receitas fixas
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {visibleIncome.map((rec) => <RecurringItem key={rec.id} rec={rec} />)}
                  </div>
                </>
              )}

              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setTabExpanded((prev) => ({ ...prev, [activeTab]: true }))
                  }
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >
                  Ver mais {hiddenCount} {hiddenCount === 1 ? 'item' : 'itens'} →
                </button>
              )}
              {isExpanded && totalCount > MAX && (
                <button
                  type="button"
                  onClick={() =>
                    setTabExpanded((prev) => ({ ...prev, [activeTab]: false }))
                  }
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-3)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                >
                  Ver menos
                </button>
              )}
            </div>
            );
          })()}
        </div>
      </div>

      {/* ── CATEGORY PICKER ─────────────────────────────────────────────────── */}
      <CategoryPickerSheet
        open={showCategoryPicker}
        categories={categories}
        selected={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
        columns={entryType === 'expense' ? 4 : 2}
      />

      {/* ── MODAL: Valor variável ────────────────────────────────────────────── */}
      {variablePayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          style={{ padding: 16 }}
          onClick={() => setVariablePayModal(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              width: '90%',
              maxWidth: 400,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Confirmar pagamento
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
              Valor estimado: {formatCurrency(variablePayModal.estimatedAmount)} — informe o valor real pago
            </p>
            <label style={fieldLabelStyle}>Valor pago (R$)</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoFocus
              value={variableAmount}
              onChange={(e) => setVariableAmount(e.target.value)}
              style={{ ...fieldStyle, fontSize: 18, marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setVariablePayModal(null)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const parsed = parseFloat(variableAmount.replace(',', '.'));
                  if (!parsed || parsed <= 0) return;
                  const id = variablePayModal.obligationId;
                  setVariablePayModal(null);
                  handleMarkObligationPaid(id, parsed);
                }}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Confirmar pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Editar recorrente ─────────────────────────────────────────── */}
      {editingRec && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          style={{ padding: 16 }}
          onClick={() => setEditingRec(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 20,
              width: '100%',
              maxWidth: 380,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
              Editar recorrente
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={fieldLabelStyle}>Descrição</label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Ex: Netflix, Academia, Aluguel..."
                  maxLength={80}
                  autoFocus
                  style={{ ...fieldStyle }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={fieldLabelStyle}>Valor (R$)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    style={{ ...fieldStyle }}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>Dia lançamento</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    value={editDayOfMonth}
                    onChange={(e) => setEditDayOfMonth(e.target.value)}
                    style={{ ...fieldStyle }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={fieldLabelStyle}>Dia vencimento</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    value={editDueDay}
                    onChange={(e) => setEditDueDay(e.target.value)}
                    placeholder={editDayOfMonth || '—'}
                    style={{ ...fieldStyle }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ ...fieldLabelStyle, marginBottom: 10 }}>Valor variável</label>
                  <Switch
                    on={editIsVariable}
                    onToggle={() => setEditIsVariable((v) => !v)}
                    ariaLabel="Valor variável"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={() => setEditingRec(null)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1.5px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: editSaving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: editSaving ? 0.7 : 1,
                }}
              >
                {editSaving ? <Loader2 size={15} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PICKER MODAL: mês/ano ────────────────────────────────────────────── */}
      {pickerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setPickerOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              style={{
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                borderRadius: 20,
                padding: 20,
                width: '100%',
                maxWidth: 300,
                boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
              }}
              className="pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Navegação de ano */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <button
                  onClick={() => setPickerYear((y) => y - 1)}
                  style={{
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-2)',
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                  aria-label="Ano anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{pickerYear}</span>
                <button
                  onClick={() => setPickerYear((y) => y + 1)}
                  style={{
                    width: 36,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-2)',
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                  aria-label="Próximo ano"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Grade de meses */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {MONTHS.map((name, idx) => {
                  const month = idx + 1;
                  const key = `${pickerYear}-${String(month).padStart(2, '0')}`;
                  const isSelected = key === selectedMonth;
                  const isNow = key === todayMonthKey;
                  return (
                    <button
                      key={month}
                      onClick={() => { startTransition(() => setSelectedMonth(key)); setPickerOpen(false); }}
                      style={{
                        padding: '10px 0',
                        borderRadius: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'Nunito, sans-serif',
                        cursor: 'pointer',
                        border: isNow && !isSelected ? '1.5px solid var(--accent-soft)' : 'none',
                        background: isSelected ? 'var(--accent)' : isNow ? 'var(--accent-bg)' : 'var(--bg)',
                        color: isSelected ? 'white' : isNow ? 'var(--accent)' : 'var(--text-2)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );

  // ── RecurringItem sub-render ──────────────────────────────────────────────

  function RecurringItem({ rec }: { rec: RecurringExpense }) {
    const cfg = CATEGORY_CONFIG[rec.category];
    const isIncome = rec.type === 'income';
    const obligation = obligations.find((o) => o.recurringExpenseId === rec.id);
    const isPaid = obligation?.status === 'paid';
    const isPaying = obligation ? payingIds.has(obligation.id) : false;
    // BUG 2: para receitas, o "recebido" é provado pelo lançamento income
    // linkado ao recorrente no mês visualizado (não há obligation).
    const incomeReceivedEntry = isIncome
      ? expenses.find(
          (e) =>
            e.recurringExpenseId === rec.id &&
            typeof e.date === 'string' &&
            e.date.slice(0, 7) === selectedMonth
        )
      : undefined;
    const isReceived = !!incomeReceivedEntry;
    // Atraso/vencimento: usa EXCLUSIVAMENTE rec.dueDay. Não faz fallback para
    // dayOfMonth — esses são campos com semânticas distintas (dia de lançamento
    // vs. prazo para pagar sem atraso). Sem dueDay válido → sem badge de atraso.
    const effectiveDueDay: number | undefined =
      typeof rec.dueDay === 'number' && rec.dueDay >= 1 && rec.dueDay <= 31
        ? rec.dueDay
        : undefined;
    const hasValidDueDay = effectiveDueDay !== undefined;
    const isMenuOpen = openMenuId === rec.id;

    let leftBorderColor = 'transparent';
    let cardBg = 'var(--surface)';
    let badgeText = '';
    let badgeBg = 'var(--border-2)';
    let badgeColor = 'var(--text-3)';
    let showMarkPaid = false;
    let showUndo = false;
    let showMarkReceived = false;
    let showUndoReceived = false;

    if (isCurrentMonth) {
      const daysLate =
        !isPaid && hasValidDueDay && todayDay > effectiveDueDay!
          ? todayDay - effectiveDueDay!
          : 0;
      const hasObligation = rec.type === 'expense' && rec.active && !!obligation;

      leftBorderColor = !hasObligation ? 'transparent'
        : isPaid ? 'var(--green)'
        : daysLate > 0 ? 'var(--red)'
        : 'var(--yellow)';

      cardBg = !hasObligation ? 'var(--surface)'
        : isPaid ? 'var(--green-bg)'
        : daysLate > 0 ? 'var(--red-bg)'
        : 'var(--yellow-bg)';

      if (hasObligation) {
        const paidAtLabel = (() => {
          if (!obligation?.paidAt) return 'Pago';
          const d = new Date(obligation.paidAt);
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          return `Pago · ${dd}/${mm}`;
        })();
        if (isPaid) {
          badgeText = paidAtLabel;
          badgeBg = 'var(--green)';
          badgeColor = 'white';
        } else if (!hasValidDueDay) {
          // Sem dia de vencimento/lançamento definido — não exibe badge "Atrasado/Vence"
          badgeText = '';
        } else if (daysLate > 0) {
          badgeText = `Atrasado ${daysLate}d`;
          badgeBg = 'var(--red)';
          badgeColor = 'white';
        } else if (todayDay === effectiveDueDay) {
          badgeText = 'Vence hoje';
          badgeBg = 'rgba(255,184,0,0.2)';
          badgeColor = 'var(--yellow-text)';
        } else if (effectiveDueDay === todayDay + 1) {
          badgeText = 'Vence amanhã';
          badgeBg = 'rgba(255,184,0,0.15)';
          badgeColor = 'var(--yellow-text)';
        } else {
          badgeText = `Vence dia ${effectiveDueDay}`;
          badgeBg = 'var(--border-2)';
          badgeColor = 'var(--text-3)';
        }
        showUndo = isPaid && paidExpenseIds.has(obligation!.id);
      }
      // Botão "Marcar pago" aparece SEMPRE que: mês atual + despesa ativa + não
      // paga — independente de ter obligation criada e de ter due_day. Quando
      // falta obligation o handler cria uma sob demanda antes de marcar paga.
      const paidThisMonth = isPaidInMonth(rec, selectedMonth);
      showMarkPaid =
        rec.type === 'expense' && rec.active && !isPaid && !paidThisMonth;
    } else if (isPastMonth) {
      if (rec.type === 'expense' && rec.active) {
        const paidAtLabel = (() => {
          if (!obligation?.paidAt) return 'Pago';
          const d = new Date(obligation.paidAt);
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          return `Pago · ${dd}/${mm}`;
        })();
        if (isPaid) {
          badgeText = paidAtLabel;
          badgeBg = 'var(--green)'; badgeColor = 'white';
          leftBorderColor = 'var(--green)'; cardBg = 'var(--green-bg)';
        } else {
          badgeText = 'Não pago';
          badgeBg = 'var(--red-bg)'; badgeColor = 'var(--red)';
          leftBorderColor = 'rgba(255,71,87,0.4)'; cardBg = 'var(--red-bg)';
        }
      }
    } else {
      if (rec.type === 'expense' && rec.active) {
        badgeText = 'Previsto';
        badgeBg = 'var(--border-2)'; badgeColor = 'var(--text-3)';
      }
    }

    // BUG 2: tratamento das RECEITAS fixas — espelha o comportamento das
    // despesas ("Marcar pago"/"Desfazer"/badges), mas baseado no lançamento
    // income linkado (incomeReceivedEntry) e não na tabela de obrigações.
    if (isIncome && rec.active) {
      if (isReceived && incomeReceivedEntry) {
        const [, mm, dd] = incomeReceivedEntry.date.split('-');
        badgeText = `Recebido · ${dd}/${mm}`;
        badgeBg = 'var(--green)';
        badgeColor = 'white';
        leftBorderColor = 'var(--green)';
        cardBg = 'var(--green-bg)';
        // Desfazer só no mês atual (idêntico ao "Desfazer" das despesas).
        showUndoReceived = isCurrentMonth;
      } else if (isCurrentMonth) {
        badgeText = 'A receber';
        badgeBg = 'var(--border-2)';
        badgeColor = 'var(--text-3)';
        showMarkReceived = true;
      } else if (isPastMonth) {
        badgeText = 'Não recebido';
        badgeBg = 'var(--red-bg)';
        badgeColor = 'var(--red)';
        leftBorderColor = 'rgba(255,71,87,0.4)';
        cardBg = 'var(--red-bg)';
      } else {
        badgeText = 'Previsto';
        badgeBg = 'var(--border-2)';
        badgeColor = 'var(--text-3)';
      }
    }

    const contentOpacity =
      isCurrentMonth && (isPaid || (isIncome && isReceived)) ? 0.55 : 1;
    const displayName = rec.description?.trim()
      ? rec.description.charAt(0).toUpperCase() + rec.description.slice(1)
      : rec.category || 'Sem descrição';
    const cardName = rec.isCredit && rec.creditCardId
      ? creditCards.find((c) => c.id === rec.creditCardId)?.nome
      : null;

    return (
      <div
        style={{
          background: cardBg,
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--r-sm)',
          borderLeftWidth: 3,
          borderLeftColor: leftBorderColor,
          padding: '12px 14px',
          boxShadow: 'var(--card-shadow)',
          opacity: rec.active ? 1 : 0.45,
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Category icon */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--logo-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
              opacity: contentOpacity,
            }}
          >
            {cfg.icon}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: name + badge variável + valor + menu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <p
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text)',
                  lineHeight: 1.25,
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  opacity: contentOpacity,
                }}
              >
                {displayName}
              </p>
              {rec.isVariable && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'var(--accent-bg)',
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}
                >
                  ~variável
                </span>
              )}
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: isIncome ? 'var(--green)' : 'var(--red)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  opacity: contentOpacity,
                }}
              >
                {isIncome ? '+' : ''}{rec.isVariable ? '~' : ''}{formatCurrency(rec.amount)}
              </span>

              {/* Menu */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(isMenuOpen ? null : rec.id);
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-3)',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                  aria-label="Mais opções"
                >
                  <MoreHorizontal size={14} />
                </button>
                {isMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 30,
                      zIndex: 20,
                      background: 'var(--surface)',
                      border: '1.5px solid var(--border)',
                      borderRadius: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                      overflow: 'hidden',
                      minWidth: 120,
                    }}
                  >
                    <button onClick={() => { openEditModal(rec); setOpenMenuId(null); }} style={menuItemStyle}>
                      <Pencil size={12} /> Editar
                    </button>
                    <button onClick={() => { handleToggle(rec); setOpenMenuId(null); }} style={menuItemStyle}>
                      {rec.active ? <Pause size={12} /> : <Play size={12} />}
                      {rec.active ? 'Pausar' : 'Ativar'}
                    </button>
                    <button onClick={() => { handleDelete(rec.id); setOpenMenuId(null); }} style={{ ...menuItemStyle, color: 'var(--red)' }}>
                      <Trash2 size={12} /> Excluir
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: meta + cartão + badge + ações */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rec.category}
              </span>
              {typeof rec.dayOfMonth === 'number' && rec.dayOfMonth >= 1 && rec.dayOfMonth <= 31 ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>
                  · Todo dia {rec.dayOfMonth}
                </span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', fontStyle: 'italic' }}>
                  · Dia não definido
                </span>
              )}
              {cardName && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: 'var(--accent-bg)',
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}
                >
                  {cardName}
                </span>
              )}
              {badgeText && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 6,
                    background: badgeBg,
                    color: badgeColor,
                    flexShrink: 0,
                  }}
                >
                  {badgeText}
                </span>
              )}
              {showMarkPaid && (
                <button
                  onClick={async () => {
                    let ob = obligation;
                    if (!ob) {
                      const created = await addObligationForNewRecurring(rec);
                      if (!created) return;
                      ob = created;
                      setObligations((prev) =>
                        [...prev, created].sort(
                          (a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99)
                        )
                      );
                    }
                    if (rec.isVariable) {
                      setVariablePayModal({ obligationId: ob.id, estimatedAmount: rec.amount });
                      setVariableAmount(String(rec.amount));
                    } else {
                      handleMarkObligationPaid(ob.id);
                    }
                  }}
                  disabled={isPaying}
                  style={{
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '6px 16px',
                    borderRadius: 8,
                    background: 'var(--green)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'Nunito, sans-serif',
                    whiteSpace: 'nowrap',
                    cursor: isPaying ? 'not-allowed' : 'pointer',
                    opacity: isPaying ? 0.6 : 1,
                    boxShadow: '0 1px 3px rgba(0,195,122,0.25)',
                  }}
                >
                  {isPaying ? <Loader2 size={12} className="animate-spin" /> : 'Marcar pago'}
                </button>
              )}
              {showUndo && obligation && (
                <button
                  onClick={() => handleUnmarkObligationPaid(obligation.id)}
                  disabled={undoingIds.has(obligation.id)}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 26,
                    padding: '0 10px',
                    borderRadius: 6,
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-2)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: undoingIds.has(obligation.id) ? 'not-allowed' : 'pointer',
                    opacity: undoingIds.has(obligation.id) ? 0.6 : 1,
                  }}
                >
                  {undoingIds.has(obligation.id) ? <Loader2 size={10} className="animate-spin" /> : 'Desfazer'}
                </button>
              )}
              {showMarkReceived && (
                <button
                  onClick={() => handleMarkIncomeReceived(rec)}
                  disabled={receivingIds.has(rec.id)}
                  style={{
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '6px 16px',
                    borderRadius: 8,
                    background: 'var(--green)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: 'Nunito, sans-serif',
                    whiteSpace: 'nowrap',
                    cursor: receivingIds.has(rec.id) ? 'not-allowed' : 'pointer',
                    opacity: receivingIds.has(rec.id) ? 0.6 : 1,
                    boxShadow: '0 1px 3px rgba(0,195,122,0.25)',
                  }}
                >
                  {receivingIds.has(rec.id) ? <Loader2 size={12} className="animate-spin" /> : 'Marcar recebido'}
                </button>
              )}
              {showUndoReceived && (
                <button
                  onClick={() => handleUnmarkIncomeReceived(rec)}
                  disabled={unreceivingIds.has(rec.id)}
                  style={{
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 26,
                    padding: '0 10px',
                    borderRadius: 6,
                    background: 'var(--bg)',
                    border: '1.5px solid var(--border)',
                    color: 'var(--text-2)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: unreceivingIds.has(rec.id) ? 'not-allowed' : 'pointer',
                    opacity: unreceivingIds.has(rec.id) ? 0.6 : 1,
                  }}
                >
                  {unreceivingIds.has(rec.id) ? <Loader2 size={10} className="animate-spin" /> : 'Desfazer'}
                </button>
              )}
            </div>

            {/* Row 3: status de vencimento (abaixo da categoria) */}
            {isCurrentMonth && rec.type === 'expense' && rec.active && !isPaid && (() => {
              if (!hasValidDueDay) {
                return (
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-3)',
                      fontStyle: 'italic',
                      margin: '4px 0 0',
                    }}
                  >
                    · Vencimento não definido
                  </p>
                );
              }
              const diff = effectiveDueDay! - todayDay;
              if (diff < 0) {
                const n = -diff;
                return (
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', margin: '4px 0 0' }}>
                    Venceu há {n} dia{n > 1 ? 's' : ''}
                  </p>
                );
              }
              if (diff === 0) {
                return (
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow-text)', margin: '4px 0 0' }}>
                    Vence hoje
                  </p>
                );
              }
              return (
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--yellow-text)', margin: '4px 0 0' }}>
                  Vence em {diff} dia{diff > 1 ? 's' : ''}
                </p>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }
}
