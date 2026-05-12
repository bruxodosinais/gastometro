'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BarChart2, CheckCircle, Copy, Download, Lightbulb, Pencil, RefreshCw, Search, Trash2, TrendingUp, X } from 'lucide-react';
import { deleteExpense, getCreditCards, getExpenses } from '@/lib/storage';
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
} from '@/lib/types';

type QuickFilter = 'today' | '7d' | '30d' | 'thisMonth' | 'prevMonth' | null;
type SortOrder = 'recent' | 'oldest' | 'highest' | 'lowest';

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

function formatLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (l) => l.toUpperCase());
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
  const [cardFilter, setCardFilter] = useState<string | 'all'>('all');
  const [chipsAtEnd, setChipsAtEnd] = useState(false);
  const chipScrollRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  // Apply filter from URL param on mount (e.g. ?filter=prevMonth from monthly close modal)
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

  // When user navigates via PeriodSelector, switch off quick filter and reset category
  useEffect(() => {
    if (prevPeriodRef.current !== period) {
      setQuickFilter(null);
      setCategoryFilter('all');
      prevPeriodRef.current = period;
    }
  }, [period]);

  const handleEditSave = (updated: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setEditingExpense(null);
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
      const [data, cards] = await retryAsync(() =>
        Promise.all([getExpenses(), getCreditCards()])
      );
      setExpenses(data);
      setCreditCards(cards);
      setReady(true);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalculate chip overflow indicator whenever expenses or type filter changes
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

  // ── Memoized computations (must be before any early return per hooks rules) ──
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

  const filteredEntries = useMemo(() =>
    baseEntries
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .filter((e) => categoryFilter === 'all' || e.category === categoryFilter)
      .filter((e) => cardFilter === 'all' || e.creditCardId === cardFilter)
      .filter((e) => !needle || e.description.toLowerCase().includes(needle))
      .filter((e) => minAmt === null || e.amount >= minAmt)
      .filter((e) => maxAmt === null || e.amount <= maxAmt)
      .sort((a, b) => {
        if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sortOrder === 'highest') return b.amount - a.amount;
        if (sortOrder === 'lowest') return a.amount - b.amount;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }),
    [baseEntries, typeFilter, categoryFilter, cardFilter, needle, minAmt, maxAmt, sortOrder]
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
          <p className="text-gray-700 font-medium">{loadError}</p>
          <button
            onClick={loadData}
            className="flex items-center gap-2 bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-600 transition-colors"
          >
            <RefreshCw size={15} />
            Tentar novamente
          </button>
        </main>
      );
    }
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-mint-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  // ── Summary (all entries in range, no search/type filters) ──────────────────
  const todayIso = isoDate(new Date());
  const income = calculateTotalByType(baseEntries, 'income');
  const spent = calculateTotalByType(baseEntries, 'expense');
  const balance = income - spent;

  // ── Breakdown de receitas por fonte ─────────────────────────────────────────
  const incomeEntries = baseEntries.filter((e) => e.type === 'income');
  const totalPeriodIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
  const incomeBySource = INCOME_CATEGORIES.map((cat) => ({
    cat,
    total: incomeEntries.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);
  const showIncomeBreakdown = typeFilter !== 'expense' && incomeBySource.length > 0;

  // ── Filtered + sorted list ───────────────────────────────────────────────────
  const activeCategories = [...new Set(
    baseEntries
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .map((e) => e.category)
  )];

  function handleTypeFilterChange(type: 'all' | EntryType) {
    setTypeFilter(type);
    if (type === 'expense' && INCOME_CATEGORIES.includes(categoryFilter as never)) setCategoryFilter('all');
    if (type === 'income' && EXPENSE_CATEGORIES.includes(categoryFilter as never)) setCategoryFilter('all');
  }

  // ── Insight hero contextual ──────────────────────────────────────────────────
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

  return (
    <>
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-gray-900">Histórico</h1>
        <button
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-100 text-gray-600 hover:text-gray-900 text-sm font-medium transition-all active:scale-95"
          aria-label="Exportar extrato"
        >
          <Download size={14} />
          Exportar
        </button>
      </div>
      <p className="text-gray-500 text-sm mb-4">{periodLabel}</p>

      {/* Filtros rápidos de período */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-0.5">
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
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === key
                ? 'bg-mint text-gray-900'
                : 'bg-white border border-gray-100 text-gray-500 hover:text-gray-900 hover:border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
        {quickFilter === null && (
          <span className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-mint text-gray-900">
            {periodLabel}
          </span>
        )}
      </div>

      {/* Seletor de mês específico */}
      <div className="mb-4">
        <PeriodSelector />
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-mint/5 border border-green-500/20 rounded-xl p-3">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Ganhos</p>
          <p className="text-mint-500 font-bold text-sm">{formatCurrency(income)}</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Gastos</p>
          <p className="text-red-400 font-bold text-sm">{formatCurrency(spent)}</p>
        </div>
        <div className={`rounded-xl p-3 border ${balance >= 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-0.5">Saldo</p>
          <p className={`font-bold text-sm ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(balance))}
          </p>
        </div>
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
        >
          <button
            onClick={() => startTransition(() => setCategoryFilter('all'))}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              categoryFilter === 'all'
                ? 'bg-mint text-gray-900'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            Todos
          </button>
          {activeCategories.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => startTransition(() => setCategoryFilter(cat))}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  categoryFilter === cat
                    ? 'bg-mint text-gray-900'
                    : 'bg-gray-100 text-gray-500'
                }`}
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
            style={{ background: 'linear-gradient(to right, transparent, #F9FAFB)' }}
          />
        )}
        </div>
      )}

      {/* Busca */}
      <div className="relative mb-2">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descrição..."
          className="w-full bg-white border border-gray-100 rounded-xl pl-9 pr-9 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Limpar busca"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Valor mínimo / máximo */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <input
          type="number"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
          placeholder="Valor mínimo"
          min="0"
          step="0.01"
          className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
        />
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="Valor máximo"
          min="0"
          step="0.01"
          className="bg-white border border-gray-100 rounded-xl px-3 py-2.5 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:border-mint-500 transition-colors"
        />
      </div>

      {/* Tipo + Cartão + Ordenação */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <div className="flex gap-2">
          {(['all', 'expense', 'income'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTypeFilterChange(t)}
              className={`px-3 py-1.5 rounded-full text-sm ${
                typeFilter === t ? 'bg-gray-100 text-gray-900' : 'bg-gray-50 text-gray-500'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'expense' ? 'Gastos' : 'Receitas'}
            </button>
          ))}
        </div>
        {creditCards.length > 0 && (
          <select
            value={cardFilter}
            onChange={(e) => setCardFilter(e.target.value)}
            className="bg-white border border-gray-100 rounded-xl px-3 py-1.5 text-gray-900 text-xs focus:outline-none focus:border-mint-500 transition-colors shrink-0"
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
          className="bg-white border border-gray-100 rounded-xl px-3 py-1.5 text-gray-900 text-xs focus:outline-none focus:border-mint-500 transition-colors shrink-0"
        >
          <option value="recent">Mais recente</option>
          <option value="oldest">Mais antigo</option>
          <option value="highest">Maior valor</option>
          <option value="lowest">Menor valor</option>
        </select>
      </div>

      {/* Insight hero */}
      <div className="rounded-2xl bg-amber-50/60 border border-amber-200/50 px-4 py-3.5 mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {contextualInsight.icon === 'lamp'  && <Lightbulb  size={18} className="text-amber-500" />}
          {contextualInsight.icon === 'chart' && <BarChart2  size={18} className="text-amber-500" />}
          {contextualInsight.icon === 'trend' && <TrendingUp size={18} className="text-amber-500" />}
          {contextualInsight.icon === 'check' && <CheckCircle size={18} className="text-emerald-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 line-clamp-1">{contextualInsight.title}</p>
          {contextualInsight.action ? (
            <p className="text-xs text-gray-500 hover:text-gray-900 cursor-pointer mt-0.5 transition-colors" onClick={contextualInsight.action}>
              {contextualInsight.subtitle}
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">{contextualInsight.subtitle}</p>
          )}
        </div>
      </div>

      {/* Top gastos */}
      {topGastosByValue.length > 0 && (
        <div className="rounded-2xl bg-white/80 border border-gray-100 p-4 mb-4">
          <p className="text-lg font-semibold text-gray-900">Top gastos</p>
          <p className="text-xs mb-3" style={{ color: '#6b7280', marginTop: '2px' }}>Agrupado por descrição do lançamento</p>
          <div>
            {topGastosByValue.map((g) => (
              <div key={g.displayName} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-800 truncate">{formatBrand(g.displayName)}</span>
                <span className="text-sm font-semibold text-gray-900 flex-shrink-0 ml-3">{formatCurrency(g.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Padrões de gasto */}
      {topGastosByCount.length > 0 && (
        <div className="rounded-2xl bg-white/80 border border-gray-100 p-4 mb-4">
          <p className="text-lg font-semibold text-gray-900 mb-3">Padrões de gasto</p>
          <div>
            {topGastosByCount.map((g) => (
              <div key={g.displayName} className="flex flex-col py-2">
                <span className="text-base font-semibold text-gray-900">{formatBrand(g.displayName)}</span>
                <span className="text-xs text-gray-500 mt-1">{patternContext(g.count)} · {g.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Receitas do período */}
      {showIncomeBreakdown && (
        <div className="rounded-2xl bg-white border border-gray-100 p-4 mb-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Receitas do período</p>
          <div className="space-y-2.5">
            {incomeBySource.map(({ cat, total }) => {
              const pct = totalPeriodIncome > 0 ? (total / totalPeriodIncome) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600 flex items-center gap-1.5">
                      <span>{INCOME_SOURCE_ICONS[cat]}</span>
                      <span>{cat}</span>
                    </span>
                    <span className="text-xs font-semibold text-gray-900">
                      {formatCurrency(total)}{' '}
                      <span className="text-gray-400 font-normal">({Math.round(pct)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: INCOME_SOURCE_COLORS[cat] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-2.5 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-xs font-bold" style={{ color: '#00b87a' }}>{formatCurrency(totalPeriodIncome)}</span>
          </div>
        </div>
      )}

      {/* Lista */}
      {baseEntries.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-5xl mb-3">🧾</p>
          <p className="text-gray-900 font-semibold text-lg mb-2">Nenhum lançamento aqui</p>
          <p className="text-gray-500 text-sm mx-auto mb-5 max-w-[280px]">
            Tudo que você gastar ou receber vai aparecer por aqui. Que tal registrar seu primeiro lançamento?
          </p>
          <Link
            href="/lancamentos"
            className="inline-block px-5 py-2.5 rounded-xl bg-mint hover:bg-mint-700 text-gray-900 text-sm font-semibold transition-all active:scale-95"
          >
            Lançar agora
          </Link>
        </div>
      ) : filteredEntries.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">Nenhum resultado para os filtros aplicados</p>
      ) : (
        <div className="opacity-[0.78] mb-6">
          <p className="text-sm font-medium text-gray-500 mb-3">Lançamentos</p>
          <div className="space-y-2">
          {filteredEntries.map((exp) => {
            const cfg = CATEGORY_CONFIG[exp.category];
            const day = exp.date.slice(8, 10);
            const month = exp.date.slice(5, 7);
            const isIncome = exp.type === 'income';
            const isFuture = exp.date > todayIso;
            return (
              <div key={exp.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate">{formatBrand(exp.description)}</p>
                    {exp.isCredit && exp.creditCardId && (() => {
                      const card = creditCards.find((c) => c.id === exp.creditCardId);
                      return card ? (
                        <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}>
                          {card.nome}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-gray-500 text-xs">{exp.category} · {day}/{month}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="font-semibold text-sm whitespace-nowrap" style={{ color: isFuture ? '#9a9aaa' : isIncome ? '#00b87a' : '#f04e5e' }}>
                    {isIncome ? '+' : ''}{formatCurrency(exp.amount)}
                  </span>
                  {isFuture && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-gray-50 text-gray-500 border border-gray-200">
                      futuro
                    </span>
                  )}
                </div>
                <button onClick={() => setEditingExpense(exp)} className="text-gray-500 hover:text-mint-500 transition-colors flex-shrink-0 ml-2" aria-label="Editar">
                  <Pencil size={15} />
                </button>
                <button onClick={() => setDuplicatingExpense(exp)} className="text-gray-500 hover:text-cyan-400 transition-colors flex-shrink-0" aria-label="Duplicar">
                  <Copy size={15} />
                </button>
                <button onClick={() => setDeletingExpense(exp)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0" aria-label="Excluir">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          </div>
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
