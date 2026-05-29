'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CalendarDays, ChevronDown, Copy, Lock, MoreHorizontal, Pencil, Settings2, Trash2 } from 'lucide-react';
import {
  addExpense,
  addExpenseInstallments,
  addRecurringExpense,
  deleteExpense,
  getCreditCards,
  getExpenses,
} from '@/lib/storage';
import EditExpenseModal from '@/components/EditExpenseModal';
import DuplicateWarningModal from '@/components/DuplicateWarningModal';
import LoadingButton from '@/components/ui/LoadingButton';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { detectDuplicate, DuplicateCandidate } from '@/lib/utils/detectDuplicate';
import CategoryPickerSheet from '@/components/CategoryPickerSheet';
import CurrencyInput from '@/components/CurrencyInput';
import { ToastContainer, useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency, getBillingMonthOptions, getMonthKey } from '@/lib/calculations';
import { getCategoryDisplay } from '@/lib/categoryConfig';
import { CreditCard as CreditCardType, EntryType, Expense } from '@/lib/types';
import { useCategorySelector } from '@/hooks/useCategorySelector';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { useSubscription } from '@/hooks/useSubscription';
import { updateStreakToday } from '@/lib/hooks/useStreak';
import { PLAN_LIMITS } from '@/lib/planLimits';
import UpgradeBanner from '@/components/UpgradeBanner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS_LONG = [
  'janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro',
];
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  if (dateStr === todayStr()) return `Hoje, ${day} de ${MONTHS_LONG[d.getMonth()]}`;
  if (dateStr === yesterdayStr()) return `Ontem, ${day} de ${MONTHS_LONG[d.getMonth()]}`;
  return `${String(day).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatGroupLabel(dateStr: string): string {
  const day = dateStr.slice(8, 10);
  const month = dateStr.slice(5, 7);
  const ddmm = `${day}/${month}`;
  if (dateStr === todayStr()) return `Hoje · ${ddmm}`;
  if (dateStr === yesterdayStr()) return `Ontem · ${ddmm}`;
  const d = new Date(dateStr + 'T12:00:00');
  return `${ddmm} · ${WEEKDAYS[d.getDay()]}`;
}

function groupByDate(expenses: Expense[]) {
  const map = new Map<string, Expense[]>();
  for (const exp of expenses) {
    if (!map.has(exp.date)) map.set(exp.date, []);
    map.get(exp.date)!.push(exp);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, label: formatGroupLabel(date), items }));
}

// ── FilterTabs ────────────────────────────────────────────────────────────────

function FilterTabs({
  active,
  onChange,
}: {
  active: 'all' | 'expense' | 'income';
  onChange: (tab: 'all' | 'expense' | 'income') => void;
}) {
  const tabs = [
    { key: 'all' as const, label: 'Ver tudo' },
    { key: 'expense' as const, label: 'Gastos' },
    { key: 'income' as const, label: 'Receitas' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
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
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ── ExpenseList ───────────────────────────────────────────────────────────────

function ExpenseListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            height: 56,
            borderRadius: 'var(--r-sm)',
          }}
        />
      ))}
    </div>
  );
}

function ExpenseList({
  expenses,
  newestId,
  flashId,
  onEdit,
  onDuplicate,
  onDelete,
  creditCards = [],
  loading = false,
}: {
  expenses: Expense[];
  newestId: string | null;
  flashId: string | null;
  onEdit: (e: Expense) => void;
  onDuplicate: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  creditCards?: CreditCardType[];
  loading?: boolean;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { categories: allCustomCategories } = useCustomCategories();

  useEffect(() => {
    if (!openMenuId) return;
    // Trava o scroll do body enquanto o menu "…" está aberto para a página
    // não rolar por trás do dropdown.
    document.body.style.overflow = 'hidden';
    function close() { setOpenMenuId(null); }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenuId(null);
    }
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKeyDown);
    // Cleanup roda em TODOS os caminhos de fechamento (clique em opção, clique
    // fora, Esc) e também no unmount do componente — sempre restaura o scroll.
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [openMenuId]);

  if (loading) {
    return <ExpenseListSkeleton />;
  }

  if (expenses.length === 0) {
    return (
      <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
        Nenhum lançamento este mês ainda
      </p>
    );
  }

  const groups = groupByDate(expenses);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(({ date, label, items }) => (
        <div key={date}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-2)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((exp) => {
              const cfg = getCategoryDisplay(exp.category, allCustomCategories);
              const isIncome = exp.type === 'income';
              const isNewest = exp.id === newestId;
              const isFlashing = exp.id === flashId;
              const isMenuOpen = openMenuId === exp.id;
              const cardName = exp.isCredit && exp.creditCardId
                ? creditCards.find((c) => c.id === exp.creditCardId)?.nome
                : null;
              return (
                <div
                  key={exp.id}
                  className={isNewest ? 'animate-in fade-in slide-in-from-bottom-3 duration-[180ms] ease-out' : ''}
                  style={{
                    background: isFlashing ? 'var(--accent-bg)' : 'var(--surface)',
                    border: '1.5px solid var(--border)',
                    borderRadius: 'var(--r-sm)',
                    padding: '11px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: 'var(--card-shadow)',
                    transition: 'background 0.3s ease',
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'var(--logo-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 17,
                      flexShrink: 0,
                    }}
                  >
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {exp.description?.trim() ? (
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exp.description.charAt(0).toUpperCase() + exp.description.slice(1)}
                      </p>
                    ) : (
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                        Sem descrição
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{exp.category}</span>
                      {cardName && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                          {cardName}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', flexShrink: 0, color: isIncome ? 'var(--green)' : 'var(--red)' }}>
                    {isIncome ? '+' : ''}{formatCurrency(exp.amount)}
                  </span>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : exp.id); }}
                      style={{
                        width: 28,
                        height: 28,
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
                      <MoreHorizontal size={16} />
                    </button>
                    {isMenuOpen && (
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: 34,
                        zIndex: 20,
                        background: 'var(--surface)',
                        border: '1.5px solid var(--border)',
                        borderRadius: 12,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                        overflow: 'hidden',
                        minWidth: 130,
                      }}>
                        <button onClick={() => { onEdit(exp); setOpenMenuId(null); }} style={menuItemStyle}>
                          <Pencil size={12} /> Editar
                        </button>
                        <button onClick={() => { onDuplicate(exp); setOpenMenuId(null); }} style={menuItemStyle}>
                          <Copy size={12} /> Duplicar
                        </button>
                        <button onClick={() => { onDelete(exp); setOpenMenuId(null); }} style={{ ...menuItemStyle, color: 'var(--red)' }}>
                          <Trash2 size={12} /> Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

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

// ── Field label style ─────────────────────────────────────────────────────────

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

// ── Main component ────────────────────────────────────────────────────────────

export default function LancamentosPage() {
  const subscription = useSubscription();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [entryType, setEntryType] = useState<EntryType>('expense');
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState<string>('Alimentação');
  const [date, setDate] = useState(todayStr);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [launchMode, setLaunchMode] = useState<'single' | 'installments' | 'recurring'>('single');
  const [installments, setInstallments] = useState(2);
  const [recurringDay, setRecurringDay] = useState('');

  const [inputScale, setInputScale] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [valueOpacity, setValueOpacity] = useState(1);
  const [topToast, setTopToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [newestId, setNewestId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const [isCredit, setIsCredit] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    getExpenses()
      .then(setExpenses)
      .catch((err) => {
        setError(getErrorMessage(err));
      })
      .finally(() => setLoadingExpenses(false));
    getCreditCards().then((cards) => {
      setCreditCards(cards);
      if (cards.length > 0) setSelectedCardId(cards[0].id);
    }).catch(() => {
      // cartões são opcionais; falha silenciosa é aceitável
    });
    amountRef.current?.focus();
  }, []);

  useEffect(() => {
    if (showDatePicker) dateInputRef.current?.focus();
  }, [showDatePicker]);

  function showTopToastMsg(msg: string) {
    setTopToast(msg);
    setToastVisible(false);
    setTimeout(() => setToastVisible(true), 10);
    setTimeout(() => {
      setToastVisible(false);
      setTimeout(() => setTopToast(null), 150);
    }, 2510);
  }

  function handleTypeChange(type: EntryType) {
    setEntryType(type);
    setCategory(type === 'expense' ? 'Alimentação' : 'Salário');
    setShowCategoryPicker(false);
    if (type === 'income') setIsCredit(false);
  }

  const [descricaoError, setDescricaoError] = useState(false);
  const numAmount = amount;
  const hasAmount = amount > 0;
  const hasDescription = description.trim().length > 0;
  const isValid = hasAmount && !!category && hasDescription;

  async function handleSubmit() {
    if (saving) return;
    if (!description.trim()) {
      setDescricaoError(true);
      return;
    }
    if (!hasAmount || !category) return;

    setDescricaoError(false);

    // Pré-checagem de duplicata SOMENTE no fluxo "single". Installments cria
    // série com descrições "(i/N)" distintas, e o "recurring" é setup
    // deliberado de padrão — ambos fora do escopo do alerta.
    if (launchMode === 'single') {
      try {
        const result = await detectDuplicate(description.trim(), numAmount, entryType, date);
        if (result.isDuplicate) {
          setDuplicateCandidates(result.candidates);
          setShowDuplicateModal(true);
          return;
        }
      } catch {
        // Falha na detecção (ex.: getExpenses rejeitou) não deve impedir o
        // salvamento — segue o fluxo normal.
      }
    }

    await doSave();
  }

  async function doSave() {
    const savedAmount = numAmount;
    const savedType = entryType;
    const base = {
      type: entryType,
      amount: numAmount,
      description: description.trim(),
      category,
      date,
      ...(isCredit && selectedCardId
        ? { isCredit: true, creditCardId: selectedCardId, billingMonth: `${billingMonth}-01` }
        : {}),
    };
    setSaving(true);
    setError(null);
    try {
      let newId: string | null = null;
      if (launchMode === 'installments') {
        const saved = await addExpenseInstallments(base, installments);
        setExpenses((prev) => [...saved, ...prev]);
        newId = saved[0]?.id ?? null;
      } else if (launchMode === 'recurring') {
        const day = parseInt(recurringDay, 10);
        if (!day || day < 1 || day > 31) {
          setError('Informe um dia do mês válido (1–31).');
          setSaving(false);
          return;
        }
        const rec = await addRecurringExpense({
          description: base.description,
          amount: numAmount,
          category,
          type: entryType,
          dayOfMonth: day,
          active: true,
          isVariable: false,
        });
        const saved = await addExpense(base, rec.id);
        setExpenses((prev) => [saved, ...prev]);
        newId = saved.id;
      } else {
        const saved = await addExpense(base);
        setExpenses((prev) => [saved, ...prev]);
        newId = saved.id;
      }

      if (newId) {
        setNewestId(newId);
        setFlashId(newId);
        setTimeout(() => setFlashId(null), 500);
        setTimeout(() => setNewestId(null), 400);
        // Contabiliza o dia no streak mesmo se o user lançar sem passar pela Home.
        updateStreakToday();
      }

      setTimeout(() => {
        setValueOpacity(0);
        setTimeout(() => {
          setAmount(0);
          setDescription('');
          setDate(todayStr());
          setRecurringDay('');
          setIsCredit(false);
          const _d = new Date();
          setBillingMonth(`${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, '0')}`);
          setValueOpacity(1);
          amountRef.current?.focus();
        }, 150);
      }, 100);

      showTopToastMsg(
        savedType === 'income'
          ? `Receita de ${formatCurrency(savedAmount)} registrada`
          : `Gasto de ${formatCurrency(savedAmount)} registrado`
      );
      getExpenses().then(setExpenses);
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleConfirmDuplicate() {
    setShowDuplicateModal(false);
    setDuplicateCandidates([]);
    doSave();
  }

  function handleCancelDuplicate() {
    setShowDuplicateModal(false);
    setDuplicateCandidates([]);
    // Formulário permanece preenchido — usuário pode ajustar e tentar de novo.
  }

  async function handleDelete(id: string) {
    const prev = expenses;
    setExpenses((list) => list.filter((e) => e.id !== id));
    try {
      await deleteExpense(id);
      addToast('Lançamento excluído', 'success');
    } catch (err) {
      setExpenses(prev);
      addToast(getErrorMessage(err), 'error');
    }
  }

  const { categories: categoryOptions } = useCategorySelector(entryType);
  // Lista usada para renderizar ícones em qualquer lugar fora do seletor:
  // usamos a lista de todas as custom (expense + income) para resolver tanto
  // o lançamento em si quanto a UI atual.
  const { categories: allCustomCategories } = useCustomCategories();
  const currentMonth = getMonthKey(new Date());
  const [filterTab, setFilterTab] = useState<'all' | 'expense' | 'income'>('all');
  const [isListExpanded, setIsListExpanded] = useState(false);

  const monthExpenseCount = expenses.filter(
    (e) => e.type === 'expense' && e.date.slice(0, 7) === currentMonth,
  ).length;
  const expenseLimit = PLAN_LIMITS.free.expensesPerMonth;
  const atExpensesLimit = subscription.isFree && monthExpenseCount >= expenseLimit;
  const approachingExpensesLimit =
    subscription.isFree && monthExpenseCount >= 15 && monthExpenseCount < expenseLimit;

  const currentExpensesAll = [...expenses]
    .filter((e) => e.date.slice(0, 7) === currentMonth)
    .filter((e) => filterTab === 'all' || e.type === filterTab)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const LIST_MAX = 5;
  const currentExpenses = isListExpanded
    ? currentExpensesAll
    : currentExpensesAll.slice(0, LIST_MAX);
  const hiddenListCount = currentExpensesAll.length - currentExpenses.length;

  const ctaLabel = saving ? null
    : launchMode === 'installments' ? `Parcelar em ${installments}x`
    : launchMode === 'recurring' ? 'Lançar e tornar recorrente'
    : entryType === 'income' ? 'Lançar receita'
    : 'Lançar gasto';

  const typeColor = entryType === 'income' ? 'var(--green)' : 'var(--red)';

  return (
    <>
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-36 md:pb-8"
        style={{ background: 'var(--bg)', minHeight: '100vh' }}
      >
        {/* ── HEADER ──────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
            Lançar
          </h1>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', margin: 0 }}>
            Registre um gasto ou receita
          </p>
        </div>

        <div className="md:grid md:grid-cols-[420px_1fr] md:gap-8 md:items-start">

          {/* ── FORM COLUMN ─────────────────────────────────────────────────── */}
          <div>
            {atExpensesLimit ? (
              <UpgradeBanner
                variant="fullpage"
                feature="lancamentos"
                message={`Você atingiu o limite de ${expenseLimit} lançamentos deste mês. Com o Pro, lance sem limites.`}
              />
            ) : (
            <>
            {approachingExpensesLimit && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'var(--accent-bg)',
                  borderRadius: 'var(--r-sm)',
                  padding: '12px 14px',
                  marginBottom: 12,
                }}
              >
                <Lock size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                <p
                  style={{
                    flex: 1,
                    minWidth: 0,
                    margin: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-2)',
                    lineHeight: 1.4,
                  }}
                >
                  Você usou {monthExpenseCount} dos seus {expenseLimit} lançamentos deste mês. Pro é ilimitado.
                </p>
                <Link
                  href="/upgrade"
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px',
                    borderRadius: 8,
                    background: 'var(--accent)',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 800,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ver planos
                </Link>
              </div>
            )}
            <div
              style={{
                background: 'var(--surface)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r)',
                padding: 18,
                marginBottom: 24,
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
                  <CurrencyInput
                    inputRef={amountRef}
                    value={amount}
                    onChange={setAmount}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder="0"
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
                      opacity: valueOpacity,
                      transition: 'opacity 150ms ease, color 200ms ease',
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

              {/* 2b. CARTÃO DE CRÉDITO */}
              {entryType === 'expense' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                        Pagar com cartão de crédito
                      </p>
                      <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', margin: 0, marginTop: 1 }}>
                        Lança na fatura do cartão
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCredit((v) => !v)}
                      style={{
                        position: 'relative',
                        width: 40,
                        height: 22,
                        flexShrink: 0,
                        borderRadius: 11,
                        border: isCredit ? 'none' : '1.5px solid var(--border)',
                        background: isCredit ? 'var(--accent)' : 'var(--bg)',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease, border-color 0.2s ease',
                        padding: 0,
                      }}
                      role="switch"
                      aria-checked={isCredit}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: isCredit ? 3 : 2,
                          left: isCredit ? 21 : 2,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: isCredit ? 'white' : 'var(--text-3)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                          transition: 'left 0.2s ease, background 0.2s ease',
                        }}
                      />
                    </button>
                  </div>

                  {isCredit && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {creditCards.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          Nenhum cartão cadastrado.{' '}
                          <a href="/cartoes" style={{ color: 'var(--accent)' }}>Adicionar cartão →</a>
                        </p>
                      ) : (
                        <select
                          value={selectedCardId}
                          onChange={(e) => setSelectedCardId(e.target.value)}
                          style={{ ...fieldStyle }}
                        >
                          {creditCards.map((c) => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      )}
                      <div>
                        <label style={fieldLabelStyle}>Mês da fatura</label>
                        <select
                          value={billingMonth}
                          onChange={(e) => setBillingMonth(e.target.value)}
                          style={{ ...fieldStyle }}
                        >
                          {getBillingMonthOptions().map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. CATEGORIA */}
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
                    {getCategoryDisplay(category, allCustomCategories).icon}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    {category}
                  </span>
                  <ChevronDown size={15} color="var(--text-3)" style={{ flexShrink: 0 }} />
                </button>
              </div>

              {/* 4. DESCRIÇÃO */}
              <div>
                <label style={fieldLabelStyle}>Descrição</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (descricaoError && e.target.value.trim()) setDescricaoError(false);
                  }}
                  placeholder={entryType === 'expense' ? 'Ex: iFood, Supermercado...' : 'Ex: Salário maio, Projeto X...'}
                  maxLength={80}
                  style={{
                    ...fieldStyle,
                    fontWeight: description ? 700 : 400,
                    borderColor: descricaoError ? 'var(--red)' : 'var(--border)',
                  }}
                />
                {descricaoError && (
                  <p style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>
                    Descrição é obrigatória
                  </p>
                )}
              </div>

              {/* 5. DATA */}
              <div>
                <label style={fieldLabelStyle}>Data</label>
                {showDatePicker ? (
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setShowDatePicker(false); }}
                    onBlur={() => setShowDatePicker(false)}
                    style={{ ...fieldStyle }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(true)}
                    style={{
                      ...fieldStyle,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <CalendarDays size={15} color="var(--text-3)" style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                      {formatDateDisplay(date)}
                    </span>
                  </button>
                )}
              </div>

              {/* 6. MAIS OPÇÕES */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMoreOptions((v) => !v)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-2)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'Nunito, sans-serif',
                    padding: 0,
                  }}
                >
                  <Settings2 size={14} color="var(--text-3)" />
                  Mais opções
                  <ChevronDown
                    size={14}
                    color="var(--text-3)"
                    style={{
                      transform: showMoreOptions ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                </button>

                {showMoreOptions && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={fieldLabelStyle}>Tipo de lançamento</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['single', 'recurring', 'installments'] as const).map((mode) => {
                          const isActive = launchMode === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setLaunchMode(mode)}
                              style={{
                                flex: 1,
                                padding: '8px 6px',
                                borderRadius: 'var(--r-sm)',
                                border: isActive ? 'none' : '1.5px solid var(--border)',
                                fontSize: 11,
                                fontWeight: 700,
                                fontFamily: 'Nunito, sans-serif',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                ...(isActive
                                  ? { background: 'var(--accent)', color: 'white' }
                                  : { background: 'var(--bg)', color: 'var(--text-2)' }),
                              }}
                            >
                              {mode === 'single' ? 'Único' : mode === 'installments' ? 'Parcelado' : 'Recorrente'}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {launchMode === 'installments' && (
                      <div>
                        <label style={fieldLabelStyle}>Número de parcelas</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={2}
                          max={48}
                          value={installments}
                          onChange={(e) => setInstallments(Math.min(48, Math.max(2, parseInt(e.target.value) || 2)))}
                          style={{ ...fieldStyle }}
                        />
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                          {installments}x de {numAmount > 0 ? `R$ ${numAmount.toFixed(2)}` : 'R$ –'} · {installments} meses consecutivos
                        </p>
                      </div>
                    )}

                    {launchMode === 'recurring' && (
                      <div>
                        <label style={fieldLabelStyle}>Dia do mês para lançar automaticamente</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={31}
                          value={recurringDay}
                          onChange={(e) => setRecurringDay(e.target.value)}
                          placeholder="Ex: 5"
                          style={{ ...fieldStyle }}
                        />
                        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                          Este lançamento será repetido todo mês nessa data
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ERRO */}
              {error && (
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
                  {error}
                </div>
              )}

              {/* CTA */}
              <LoadingButton
                type="button"
                onClick={handleSubmit}
                loading={saving}
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
                  transition: 'background 0.2s ease, opacity 0.2s ease',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {ctaLabel}
              </LoadingButton>
            </div>
            </>
            )}
          </div>

          {/* ── LIST COLUMN (desktop) ────────────────────────────────────────── */}
          <div
            className="hidden md:block"
            style={{ opacity: hasAmount ? 0.55 : 1, transition: 'opacity 300ms ease' }}
          >
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
              Este mês
            </p>
            <FilterTabs active={filterTab} onChange={setFilterTab} />
            <ExpenseList
              expenses={currentExpenses}
              newestId={newestId}
              flashId={flashId}
              onEdit={setEditingExpense}
              onDuplicate={setDuplicatingExpense}
              onDelete={setDeletingExpense}
              creditCards={creditCards}
              loading={loadingExpenses}
            />
            {hiddenListCount > 0 && (
              <button
                type="button"
                onClick={() => setIsListExpanded(true)}
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
                Ver mais {hiddenListCount} {hiddenListCount === 1 ? 'item' : 'itens'} →
              </button>
            )}
            {isListExpanded && currentExpensesAll.length > LIST_MAX && (
              <button
                type="button"
                onClick={() => setIsListExpanded(false)}
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
        </div>

        {/* ── LIST (mobile) ────────────────────────────────────────────────── */}
        <div
          className="md:hidden"
          style={{ marginTop: 24, opacity: hasAmount ? 0.55 : 1, transition: 'opacity 300ms ease' }}
        >
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
            Este mês
          </p>
          <FilterTabs active={filterTab} onChange={setFilterTab} />
          <ExpenseList
            expenses={currentExpenses}
            newestId={newestId}
            flashId={flashId}
            onEdit={setEditingExpense}
            onDuplicate={setDuplicatingExpense}
            onDelete={setDeletingExpense}
            loading={loadingExpenses}
          />
          {hiddenListCount > 0 && (
            <button
              type="button"
              onClick={() => setIsListExpanded(true)}
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
              Ver mais {hiddenListCount} {hiddenListCount === 1 ? 'item' : 'itens'} →
            </button>
          )}
          {isListExpanded && currentExpensesAll.length > LIST_MAX && (
            <button
              type="button"
              onClick={() => setIsListExpanded(false)}
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
      </main>

      {/* ── TOP TOAST ────────────────────────────────────────────────────────── */}
      {topToast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            padding: '0 16px',
            width: '100%',
            maxWidth: 360,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              color: 'var(--text)',
              fontSize: 13,
              fontWeight: 700,
              padding: '12px 18px',
              borderRadius: 'var(--r-sm)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
              textAlign: 'center',
              opacity: toastVisible ? 1 : 0,
              transform: toastVisible ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.97)',
              transition: toastVisible
                ? 'opacity 200ms ease-out, transform 200ms ease-out'
                : 'opacity 150ms ease',
            }}
          >
            {topToast}
          </div>
        </div>
      )}

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onSave={async () => {
            // Refetch AUTORITATIVO: a lista deriva de `expenses`
            // (currentExpenses é recalculado a cada render). Buscar do
            // servidor e setar o estado garante o valor real persistido,
            // sem depender do objeto otimista do retorno.
            setEditingExpense(null);
            const fresh = await getExpenses();
            setExpenses(fresh);
            addToast('Lançamento atualizado', 'success');
          }}
          onClose={() => setEditingExpense(null)}
        />
      )}
      {duplicatingExpense && (
        <EditExpenseModal
          expense={duplicatingExpense}
          mode="duplicate"
          onSave={(saved) => {
            setExpenses((prev) => [saved, ...prev]);
            setDuplicatingExpense(null);
            addToast('Lançamento duplicado', 'success');
          }}
          onClose={() => setDuplicatingExpense(null)}
        />
      )}
      {deletingExpense && (
        <ConfirmDeleteModal
          title="Excluir lançamento"
          description={`"${deletingExpense.description}" será removido permanentemente.`}
          onConfirm={() => handleDelete(deletingExpense.id)}
          onClose={() => setDeletingExpense(null)}
        />
      )}
      {showDuplicateModal && (
        <DuplicateWarningModal
          candidates={duplicateCandidates}
          onConfirm={handleConfirmDuplicate}
          onCancel={handleCancelDuplicate}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <CategoryPickerSheet
        open={showCategoryPicker}
        options={categoryOptions}
        selected={category}
        onSelect={setCategory}
        onClose={() => setShowCategoryPicker(false)}
        columns={4}
      />
    </>
  );
}
