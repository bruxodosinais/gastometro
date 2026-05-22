'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BarChart2, CheckCircle, Copy, Download, Lightbulb, Pencil, RefreshCw, Search, Trash2, TrendingUp, X } from 'lucide-react';
import { deleteExpense, getCreditCards, getExpenses, getRecurringExpenses } from '@/lib/storage';
import EditExpenseModal from '@/components/EditExpenseModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import ExportModal from '@/components/ExportModal';
import { ToastContainer, useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/errors';
import { retryAsync } from '@/lib/retry';
import {
  calculateTotalByType,
  formatCurrency,
  getMonthKey,
  getMonthLabel,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import PeriodSelector from '@/components/PeriodSelector';
import {
  Category,
  CreditCard as CreditCardType,
  EntryType,
  EXPENSE_CATEGORIES,
  Expense,
  INCOME_CATEGORIES,
  RecurringExpense,
} from '@/lib/types';

type QuickFilter = 'today' | '7d' | '30d' | 'thisMonth' | 'prevMonth' | null;
type SortOrder = 'recent' | 'oldest' | 'highest' | 'lowest';
type KindFilter = 'all' | 'fixed' | 'debt' | 'variable';

interface TopGasto { displayName: string; total: number; count: number }

const INCOME_SOURCE_ICONS: Record<string, string> = {
  'Salário': '💰',
  'Freela': '💻',
  'Renda passiva': '📊',
  'Outros': '📦',
};

const INCOME_SOURCE_COLORS: Record<string, string> = {
  'Salário': '#00b87a',
  'Freela': '#3b9eff',
  'Renda passiva': '#9333ea',
  'Outros': '#9ca3af',
};

const QUICK_FILTER_LABELS: Record<Exclude<QuickFilter, null>, string> = {
  today: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
  thisMonth: 'Este mês',
  prevMonth: 'Mês anterior',
};

function isoDate(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function normalizeDescription(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatBrand(text: string): string {
  const map: Record<string, string> = {
    ifood: 'iFood',
    uber: 'Uber',
    spotify: 'Spotify',
  };
  const key = text.toLowerCase().trim();
  if (map[key]) return map[key];
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function patternContext(count: number): string {
  if (count >= 7) return 'Uso frequente';
  if (count >= 4) return 'Recorrente na semana';
  return 'Uso ocasional';
}

export default function HistoricoPage() {
  const { period, setPeriod } = usePeriod();
  const prevPeriodRef = useRef(period);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ready, setReady] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [duplicatingExpense, setDuplicatingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | EntryType>('all');
  const [categoryFilter, setCategoryFilter] = useState<Category | 'all'>('all');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('thisMonth');
  const [sortOrder, setSortOrder] = useState<SortOrder>('recent');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [cardFilter, setCardFilter] = useState<string | 'all'>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [chipsAtEnd, setChipsAtEnd] = useState(false);
  const chipScrollRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('filter');
    if (f === 'prevMonth') {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const p = getMonthKey(d);
      prevPeriodRef.current = p;
      setPeriod(p);
      setQuickFilter('prevMonth');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // BUG 5: ao trocar de mês (setas/dropdown) limpamos a busca e o filtro de
  // categoria contextual. typeFilter (Todos/Gastos/Receitas) e cardFilter
  // são preservados de propósito — não dependem do mês.
  useEffect(() => {
    if (prevPeriodRef.current !== period) {
      setQuickFilter(null);
      setCategoryFilter('all');
      setSearch('');
      prevPeriodRef.current = period;
    }
  }, [period]);

  const handleEditSave = async () => {
    // Refetch AUTORITATIVO: filteredEntries/baseEntries são useMemo sobre
    // `expenses`, então setar o estado com os dados frescos do servidor
    // recalcula a lista agrupada — sem depender do objeto otimista.
    setEditingExpense(null);
    const fresh = await getExpenses();
    setExpenses(fresh);
    addToast('Lançamento atualizado', 'success');
  };

  const handleDuplicateSave = (saved: Expense) => {
    setExpenses((prev) => [saved, ...prev]);
    setDuplicatingExpense(null);
    addToast('Lançamento duplicado', 'success');
  };

  const handleDelete = async (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await deleteExpense(id);
    addToast('Lançamento excluído', 'success');
  };

  async function loadData() {
    setLoadError(null);
    try {
      const [data, cards, recs] = await retryAsync(() =>
        Promise.all([getExpenses(), getCreditCards(), getRecurringExpenses()])
      );
      setExpenses(data);
      setCreditCards(cards);
      setRecurringExpenses(recs);
      setReady(true);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = chipScrollRef.current;
    if (el) setChipsAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, [expenses, typeFilter]);

  useEffect(() => {
    const refresh = () => getExpenses().then(setExpenses);
    window.addEventListener('focus', refresh);
    window.addEventListener('gastometro_expense_added', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('gastometro_expense_added', refresh);
    };
  }, []);

  const needle = search.trim().toLowerCase();
  const minAmt = minAmount !== '' ? parseFloat(minAmount) : null;
  const maxAmt = maxAmount !== '' ? parseFloat(maxAmount) : null;

  const { rangeFrom, rangeTo, periodLabel } = useMemo(() => {
    const now = new Date();
    const todayStr = isoDate(now);
    if (quickFilter === 'today') {
      return { rangeFrom: todayStr, rangeTo: todayStr, periodLabel: 'Hoje' };
    } else if (quickFilter === '7d') {
      const f = new Date(now); f.setDate(f.getDate() - 6);
      return { rangeFrom: isoDate(f), rangeTo: todayStr, periodLabel: 'Últimos 7 dias' };
    } else if (quickFilter === '30d') {
      const f = new Date(now); f.setDate(f.getDate() - 29);
      return { rangeFrom: isoDate(f), rangeTo: todayStr, periodLabel: 'Últimos 30 dias' };
    } else if (quickFilter === 'thisMonth') {
      const y = now.getFullYear(), m = now.getMonth() + 1;
      const last = new Date(y, m, 0).getDate();
      return {
        rangeFrom: `${y}-${String(m).padStart(2, '0')}-01`,
        rangeTo: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
        periodLabel: getMonthLabel(getMonthKey(now)),
      };
    } else if (quickFilter === 'prevMonth') {
      const pd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = pd.getFullYear(), m = pd.getMonth() + 1;
      const last = new Date(y, m, 0).getDate();
      return {
        rangeFrom: `${y}-${String(m).padStart(2, '0')}-01`,
        rangeTo: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
        periodLabel: getMonthLabel(getMonthKey(pd)),
      };
    } else {
      const [py, pm] = period.split('-').map(Number);
      const last = new Date(py, pm, 0).getDate();
      return {
        rangeFrom: `${period}-01`,
        rangeTo: `${period}-${String(last).padStart(2, '0')}`,
        periodLabel: getMonthLabel(period),
      };
    }
  }, [quickFilter, period]);

  const baseEntries = useMemo(
    () => expenses.filter((e) => e.date >= rangeFrom && e.date <= rangeTo),
    [expenses, rangeFrom, rangeTo]
  );

  // Recorrentes com total_installments definido = "dívidas" (parcelamentos /
  // financiamentos). As demais ativas/sem prazo são "fixas".
  const debtRecIds = useMemo(
    () =>
      new Set(
        recurringExpenses
          .filter((r) => r.totalInstallments != null)
          .map((r) => r.id),
      ),
    [recurringExpenses],
  );

  const filteredEntries = useMemo(() =>
    baseEntries
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .filter((e) => categoryFilter === 'all' || e.category === categoryFilter)
      .filter((e) => cardFilter === 'all' || e.creditCardId === cardFilter)
      .filter((e) => {
        if (kindFilter === 'all') return true;
        const hasRec = !!e.recurringExpenseId;
        if (kindFilter === 'variable') return !hasRec;
        if (!hasRec) return false;
        const isDebt = debtRecIds.has(e.recurringExpenseId!);
        return kindFilter === 'debt' ? isDebt : !isDebt;
      })
      .filter((e) => !needle || e.description.toLowerCase().includes(needle))
      .filter((e) => minAmt === null || e.amount >= minAmt)
      .filter((e) => maxAmt === null || e.amount <= maxAmt)
      .sort((a, b) => {
        if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortOrder === 'highest') return b.amount - a.amount;
        if (sortOrder === 'lowest') return a.amount - b.amount;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }),
    [baseEntries, typeFilter, categoryFilter, cardFilter, kindFilter, debtRecIds, needle, minAmt, maxAmt, sortOrder]
  );

  const { topGastosByValue, topGastosByCount } = useMemo(() => {
    const map: Record<string, TopGasto> = {};
    for (const e of filteredEntries.filter((e) => e.type === 'expense')) {
      const key = normalizeDescription(e.description);
      if (!map[key]) map[key] = { displayName: e.description, total: 0, count: 0 };
      map[key].total += e.amount;
      map[key].count += 1;
    }
    return {
      topGastosByValue: Object.values(map).sort((a, b) => b.total - a.total).slice(0, 3),
      topGastosByCount: Object.values(map)
        .filter((g) => g.count >= 2)
        .sort((a, b) => b.count !== a.count ? b.count - a.count : b.total - a.total)
        .slice(0, 3),
    };
  }, [filteredEntries]);

  if (!ready) {
    if (loadError) {
      return (
        <main className="max-w-lg mx-auto px-4 pt-16 pb-10 flex flex-col items-center gap-4 text-center">
          <p className="text-4xl">😕</p>
          <p style={{ color: 'var(--text-2)', fontWeight: 500 }}>{loadError}</p>
          <button
            onClick={loadData}
            className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <RefreshCw size={15} />
            Tentar novamente
          </button>
        </main>
      );
    }
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </main>
    );
  }

  const todayIso = isoDate(new Date());
  const income = calculateTotalByType(baseEntries, 'income');
  const spent = calculateTotalByType(baseEntries, 'expense');
  const balance = income - spent;

  const incomeEntries = baseEntries.filter((e) => e.type === 'income');
  // BUG 4: a busca por texto também filtra as receitas do breakdown. Sem
  // receita batendo o termo, a seção some (incomeBySource fica vazio).
  const matchedIncomeEntries = incomeEntries.filter(
    (e) => !needle || e.description.toLowerCase().includes(needle)
  );
  const totalPeriodIncome = matchedIncomeEntries.reduce((s, e) => s + e.amount, 0);
  const incomeBySource = INCOME_CATEGORIES.map((cat) => ({
    cat,
    total: matchedIncomeEntries
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);
  // BUG 3: receitas nunca são associadas a cartão — com filtro de cartão
  // ativo a seção "Receitas do período" não faz sentido e é ocultada.
  const showIncomeBreakdown =
    typeFilter === 'all' &&
    categoryFilter === 'all' &&
    cardFilter === 'all' &&
    incomeBySource.length > 0;

  const activeCategories = [...new Set(
    baseEntries
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .map((e) => e.category)
  )];

  function handleTypeFilterChange(type: 'all' | EntryType) {
    setTypeFilter(type);
    if (type === 'expense' && INCOME_CATEGORIES.includes(categoryFilter as never)) setCategoryFilter('all');
    if (type === 'income' && EXPENSE_CATEGORIES.includes(categoryFilter as never)) setCategoryFilter('all');
    // Classificação (fixa/dívida/variável) só faz sentido para despesas.
    if (type === 'income') setKindFilter('all');
  }

  const insightGroup = topGastosByCount[0] ?? null;

  const diasDeUso = new Set(expenses.map((e) => e.date)).size;
  const totalLancamentos = expenses.length;
  const mesesComDados = new Set(expenses.map((e) => e.date.slice(0, 7))).size;
  const primeiroMes = mesesComDados <= 1;

  type InsightPhase = {
    icon: 'lamp' | 'chart' | 'trend' | 'check';
    title: string;
    subtitle: string;
    action?: () => void;
  };

  let contextualInsight: InsightPhase;

  if (diasDeUso <= 7 || totalLancamentos <= 5) {
    const hasIncome = expenses.some((e) => e.type === 'income');
    contextualInsight = hasIncome
      ? { icon: 'lamp', title: 'Boa largada! Continue registrando seus gastos', subtitle: 'Com mais lançamentos, padrões vão aparecer aqui.' }
      : { icon: 'lamp', title: 'Você está começando sua jornada', subtitle: 'Lance receitas e gastos para ver seus insights.' };
  } else if (diasDeUso < 30 || primeiroMes) {
    const byCategory: Record<string, number> = {};
    for (const e of baseEntries.filter((e) => e.type === 'expense')) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    }
    const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    if (topCat && spent > 0) {
      const pct = Math.round((topCat[1] / spent) * 100);
      contextualInsight = { icon: 'chart', title: `${topCat[0]} representa ${pct}% dos gastos`, subtitle: 'Acompanhe o ritmo ao longo do mês.' };
    } else {
      contextualInsight = { icon: 'trend', title: 'Dados chegando...', subtitle: 'Continue lançando para ver insights do mês.' };
    }
  } else if (insightGroup) {
    contextualInsight = {
      icon: 'trend',
      title: `${formatBrand(insightGroup.displayName)} apareceu ${insightGroup.count} vezes`,
      subtitle: 'Ver padrões →',
      action: () => setSearch(insightGroup.displayName),
    };
  } else {
    contextualInsight = { icon: 'check', title: 'Nenhum gasto repetitivo preocupante', subtitle: 'Você está mantendo boa consistência!' };
  }

  // Grouped list by day
  const groupedByDay: Record<string, Expense[]> = {};
  for (const exp of filteredEntries) {
    if (!groupedByDay[exp.date]) groupedByDay[exp.date] = [];
    groupedByDay[exp.date].push(exp);
  }
  const sortedDays = Object.keys(groupedByDay).sort((a, b) =>
    sortOrder === 'oldest' ? a.localeCompare(b) : b.localeCompare(a)
  );

  const showPeriodSelector = quickFilter === 'thisMonth' || quickFilter === 'prevMonth' || quickFilter === null;

  return (
    <>
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h1 style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text)' }}>
          Histórico
        </h1>
        <button
          onClick={() => setExportOpen(true)}
          aria-label="Exportar extrato"
          className="flex items-center gap-1.5 transition-opacity hover:opacity-75 active:scale-95"
          style={{
            fontSize: 12, fontWeight: 700, color: 'var(--accent)',
            border: '1.5px solid var(--accent-soft)', borderRadius: 20,
            padding: '6px 14px', background: 'transparent', cursor: 'pointer',
          }}
        >
          <Download size={12} />
          Exportar
        </button>
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 16 }}>
        {periodLabel}
      </p>

      {/* Filtros de período */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {(Object.entries(QUICK_FILTER_LABELS) as [Exclude<QuickFilter, null>, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setQuickFilter(key);
              setCategoryFilter('all');
              if (key === 'thisMonth' || key === 'today' || key === '7d' || key === '30d') {
                const p = getMonthKey(new Date());
                prevPeriodRef.current = p;
                setPeriod(p);
              } else if (key === 'prevMonth') {
                const d = new Date();
                d.setDate(1);
                d.setMonth(d.getMonth() - 1);
                const p = getMonthKey(d);
                prevPeriodRef.current = p;
                setPeriod(p);
              }
            }}
            className="flex-shrink-0 transition-opacity hover:opacity-80"
            style={{
              padding: '6px 14px', borderRadius: 20,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: quickFilter === key ? 'var(--accent)' : 'var(--surface)',
              color: quickFilter === key ? '#fff' : 'var(--text-2)',
              border: quickFilter === key ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
            }}
          >
            {label}
          </button>
        ))}
        {quickFilter === null && (
          <span
            className="flex-shrink-0"
            style={{
              padding: '6px 14px', borderRadius: 20,
              fontSize: 12, fontWeight: 700,
              background: 'var(--accent)', color: '#fff',
              border: '1.5px solid var(--accent)',
            }}
          >
            {periodLabel}
          </span>
        )}
      </div>

      {/* Navegador de mês */}
      {showPeriodSelector && (
        <div className="mb-4">
          <PeriodSelector />
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 12px' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Ganhos</p>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)' }}>{formatCurrency(income)}</p>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 12px' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Gastos</p>
          <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--red)' }}>{formatCurrency(spent)}</p>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '10px 12px' }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Saldo</p>
          <p style={{ fontSize: 14, fontWeight: 800, color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(balance))}
          </p>
        </div>
      </div>

      {/* Input de busca */}
      <div className="relative mb-2">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-3)' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descrição..."
          className="w-full focus:outline-none transition-colors"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', paddingLeft: 38, paddingRight: 36,
            paddingTop: 10, paddingBottom: 10,
            color: 'var(--text)', fontSize: 12, fontWeight: 500,
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-60"
            style={{ color: 'var(--text-3)' }}
            aria-label="Limpar busca"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filtros avançados: tipo + classificação + cartão + ordenação */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div
          className="flex"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 2 }}
        >
          {(['all', 'expense', 'income'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTypeFilterChange(t)}
              style={{
                fontSize: 12, fontWeight: 700,
                padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
                background: typeFilter === t ? 'var(--accent)' : 'transparent',
                color: typeFilter === t ? '#fff' : 'var(--text-2)',
                transition: 'all 0.15s',
              }}
            >
              {t === 'all' ? 'Todos' : t === 'expense' ? 'Gastos' : 'Receitas'}
            </button>
          ))}
        </div>
        {typeFilter !== 'income' && (
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            className="focus:outline-none transition-colors shrink-0"
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', padding: '6px 10px',
              fontSize: 12, fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer',
            }}
            aria-label="Filtrar por classificação"
          >
            <option value="all">Todas classificações</option>
            <option value="fixed">Fixas</option>
            <option value="debt">Dívidas</option>
            <option value="variable">Variáveis</option>
          </select>
        )}
        {creditCards.length > 0 && (
          <select
            value={cardFilter}
            onChange={(e) => setCardFilter(e.target.value)}
            className="focus:outline-none transition-colors shrink-0"
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', padding: '6px 10px',
              fontSize: 12, fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer',
            }}
          >
            <option value="all">Todos os cartões</option>
            {creditCards.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        )}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className="focus:outline-none transition-colors shrink-0"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', padding: '6px 10px',
            fontSize: 12, fontWeight: 700, color: 'var(--text-2)', cursor: 'pointer',
          }}
        >
          <option value="recent">Mais recente</option>
          <option value="oldest">Mais antigo</option>
          <option value="highest">Maior valor</option>
          <option value="lowest">Menor valor</option>
        </select>
      </div>

      {/* Filtro por categoria */}
      {activeCategories.length > 0 && (
        <div className="relative mb-3">
          <div
            ref={chipScrollRef}
            onScroll={() => {
              const el = chipScrollRef.current;
              if (el) setChipsAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
            }}
            className="flex gap-2 overflow-x-auto pb-0.5"
            style={{ scrollbarWidth: 'none' }}
          >
            <button
              onClick={() => startTransition(() => setCategoryFilter('all'))}
              className="flex-shrink-0 transition-opacity hover:opacity-80"
              style={{
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: categoryFilter === 'all' ? 'var(--accent)' : 'var(--surface)',
                color: categoryFilter === 'all' ? '#fff' : 'var(--text-2)',
                border: categoryFilter === 'all' ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
              }}
            >
              Todos
            </button>
            {activeCategories.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => startTransition(() => setCategoryFilter(cat))}
                  className="flex-shrink-0 flex items-center gap-1.5 transition-opacity hover:opacity-80"
                  style={{
                    padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                    fontSize: 12, fontWeight: 700,
                    background: active ? 'var(--accent)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-2)',
                    border: active ? '1.5px solid var(--accent)' : '1.5px solid var(--border)',
                  }}
                >
                  <span>{cfg.icon}</span>
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
          {!chipsAtEnd && (
            <div
              className="absolute right-0 top-0 bottom-0.5 w-12 pointer-events-none z-10"
              style={{ background: 'linear-gradient(to right, transparent, var(--bg))' }}
            />
          )}
        </div>
      )}

      {/* Valor mínimo / máximo */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        <input
          type="number"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          placeholder="Valor mínimo"
          min="0"
          step="0.01"
          className="focus:outline-none transition-colors"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', padding: '8px 12px',
            color: 'var(--text)', fontSize: 12, fontWeight: 500,
          }}
        />
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="Valor máximo"
          min="0"
          step="0.01"
          className="focus:outline-none transition-colors"
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', padding: '8px 12px',
            color: 'var(--text)', fontSize: 12, fontWeight: 500,
          }}
        />
      </div>

      {/* Insight de padrão */}
      <div
        className="flex items-start gap-2.5 mb-4"
        style={{
          background: 'var(--accent-bg)', border: '1px solid var(--accent-soft)',
          borderRadius: 'var(--r-sm)', padding: '10px 14px',
        }}
      >
        <div style={{ marginTop: 2, flexShrink: 0 }}>
          {contextualInsight.icon === 'lamp'  && <Lightbulb  size={16} style={{ color: 'var(--accent)' }} />}
          {contextualInsight.icon === 'chart' && <BarChart2  size={16} style={{ color: 'var(--accent)' }} />}
          {contextualInsight.icon === 'trend' && <TrendingUp size={16} style={{ color: 'var(--accent)' }} />}
          {contextualInsight.icon === 'check' && <CheckCircle size={16} style={{ color: 'var(--green)' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="line-clamp-1" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
            {contextualInsight.title}
          </p>
          {contextualInsight.action ? (
            <p
              onClick={contextualInsight.action}
              style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginTop: 2, cursor: 'pointer' }}
            >
              {contextualInsight.subtitle}
            </p>
          ) : (
            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-3)', marginTop: 2 }}>
              {contextualInsight.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Top gastos */}
      {topGastosByValue.length > 0 && (
        <div
          className="mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px' }}
        >
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 2 }}>Top gastos</p>
          <p style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginBottom: 12 }}>Agrupado por descrição do lançamento</p>
          <div>
            {topGastosByValue.map((g, i) => (
              <div
                key={g.displayName}
                className="flex items-center justify-between"
                style={{ padding: '7px 0', borderTop: i > 0 ? '1px solid var(--border-2)' : 'none' }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }} className="truncate">
                  {formatBrand(g.displayName)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--red)', flexShrink: 0, marginLeft: 12 }}>
                  {formatCurrency(g.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Padrões de gasto */}
      {categoryFilter === 'all' && topGastosByCount.length > 0 && (
        <div
          className="mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px' }}
        >
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Padrões de gasto</p>
          <div>
            {topGastosByCount.map((g, i) => (
              <div
                key={g.displayName}
                className="flex flex-col"
                style={{ padding: '6px 0', borderTop: i > 0 ? '1px solid var(--border-2)' : 'none' }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{formatBrand(g.displayName)}</span>
                <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 2 }}>
                  {patternContext(g.count)} · {g.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Receitas do período */}
      {showIncomeBreakdown && (
        <div
          className="mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px' }}
        >
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>Receitas do período</p>
          <div className="space-y-2.5">
            {incomeBySource.map(({ cat, total }) => {
              const pct = totalPeriodIncome > 0 ? (total / totalPeriodIncome) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                      <span>{INCOME_SOURCE_ICONS[cat]}</span>
                      <span>{cat}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                      {formatCurrency(total)}{' '}
                      <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>({Math.round(pct)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: INCOME_SOURCE_COLORS[cat], width: `${pct}%`, transition: 'all 0.3s' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Total</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(totalPeriodIncome)}</span>
          </div>
        </div>
      )}

      {/* Lista */}
      {baseEntries.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-5xl mb-3">🧾</p>
          <p style={{ color: 'var(--text)', fontWeight: 600, fontSize: 18, marginBottom: 8 }}>Nenhum lançamento aqui</p>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20, maxWidth: 280, margin: '0 auto 20px' }}>
            Tudo que você gastar ou receber vai aparecer por aqui. Que tal registrar seu primeiro lançamento?
          </p>
          <Link
            href="/lancamentos"
            className="inline-block transition-opacity hover:opacity-80 active:scale-95"
            style={{
              background: 'var(--accent)', color: '#fff', borderRadius: 'var(--r-sm)',
              padding: '10px 20px', fontSize: 14, fontWeight: 700,
            }}
          >
            Lançar agora
          </Link>
        </div>
      ) : filteredEntries.length === 0 ? (
        <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
          {cardFilter !== 'all' && typeFilter === 'income'
            ? 'Nenhuma receita neste cartão'
            : 'Nenhum resultado para os filtros aplicados'}
        </p>
      ) : (
        <div className="mb-6">
          {sortedDays.map((day) => {
            const [, dayM, dayD] = day.split('-');
            const isToday = day === todayIso;
            const dayLabel = isToday ? `Hoje · ${dayD}/${dayM}` : `${dayD}/${dayM}`;
            return (
              <div key={day} className="mb-3">
                {/* Label do dia */}
                <div style={{ padding: '6px 14px', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)' }}>
                    {dayLabel}
                  </span>
                </div>
                {/* Itens do dia */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
                  {groupedByDay[day].map((exp, idx) => {
                    const cfg = CATEGORY_CONFIG[exp.category];
                    const isIncome = exp.type === 'income';
                    const isFuture = exp.date > todayIso;
                    const card = exp.isCredit && exp.creditCardId
                      ? creditCards.find((c) => c.id === exp.creditCardId)
                      : null;
                    return (
                      <div
                        key={exp.id}
                        className="group flex items-center gap-3 px-4 py-3"
                        style={{ borderTop: idx > 0 ? '1px solid var(--border-2)' : 'none' }}
                      >
                        {/* Ícone categoria */}
                        <div
                          style={{
                            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                            background: 'var(--logo-bg)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', fontSize: 16,
                          }}
                        >
                          {cfg.icon}
                        </div>
                        {/* Informações */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {exp.description?.trim() ? (
                              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }} className="truncate">
                                {formatBrand(exp.description)}
                              </p>
                            ) : (
                              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', fontStyle: 'italic' }} className="truncate">
                                Sem descrição
                              </p>
                            )}
                            {card && (
                              <span
                                style={{
                                  fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                                  background: 'var(--logo-bg)', borderRadius: 4,
                                  padding: '2px 6px', flexShrink: 0,
                                }}
                              >
                                {card.nome}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', marginTop: 1 }}>
                            {exp.category} · {dayD}/{dayM}
                          </p>
                        </div>
                        {/* Valor */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span
                            style={{
                              fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
                              color: isFuture ? 'var(--text-3)' : isIncome ? 'var(--green)' : 'var(--red)',
                            }}
                          >
                            {isIncome ? '+' : ''}{formatCurrency(exp.amount)}
                          </span>
                          {isFuture && (
                            <span
                              style={{
                                fontSize: 10, fontWeight: 500, background: 'var(--logo-bg)',
                                color: 'var(--text-3)', border: '1px solid var(--border)',
                                borderRadius: 4, padding: '1px 6px',
                              }}
                            >
                              futuro
                            </span>
                          )}
                        </div>
                        {/* Ações (hover no desktop, sempre visível no mobile) */}
                        <div className="flex items-center gap-2 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingExpense(exp)}
                            aria-label="Editar"
                            className="hover:opacity-60 transition-opacity"
                            style={{ color: 'var(--text-3)' }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDuplicatingExpense(exp)}
                            aria-label="Duplicar"
                            className="hover:opacity-60 transition-opacity"
                            style={{ color: 'var(--text-3)' }}
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => setDeletingExpense(exp)}
                            aria-label="Excluir"
                            className="transition-colors"
                            style={{ color: 'var(--text-3)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>

    {editingExpense && (
      <EditExpenseModal expense={editingExpense} onSave={handleEditSave} onClose={() => setEditingExpense(null)} />
    )}
    {duplicatingExpense && (
      <EditExpenseModal expense={duplicatingExpense} mode="duplicate" onSave={handleDuplicateSave} onClose={() => setDuplicatingExpense(null)} />
    )}
    {deletingExpense && (
      <ConfirmDeleteModal
        title="Excluir lançamento"
        description={`"${deletingExpense.description}" será removido permanentemente.`}
        onConfirm={() => handleDelete(deletingExpense.id)}
        onClose={() => setDeletingExpense(null)}
      />
    )}
    {exportOpen && (
      <ExportModal
        onClose={() => setExportOpen(false)}
        onSuccess={(msg) => addToast(msg, 'success')}
      />
    )}
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
