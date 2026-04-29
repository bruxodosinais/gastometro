'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Pencil, Search, Trash2, X } from 'lucide-react';
import { deleteExpense, getExpenses } from '@/lib/storage';
import EditExpenseModal from '@/components/EditExpenseModal';
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal';
import { ToastContainer, useToast } from '@/components/Toast';
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
  EntryType,
  EXPENSE_CATEGORIES,
  Expense,
  INCOME_CATEGORIES,
} from '@/lib/types';

type QuickFilter = 'today' | '7d' | '30d' | 'thisMonth' | 'prevMonth' | null;
type SortOrder = 'recent' | 'oldest' | 'highest' | 'lowest';

interface TopGasto { displayName: string; total: number; count: number }
interface Insight { icon: string; text: string }

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

export default function HistoricoPage() {
  const { period } = usePeriod();
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
  const { toasts, addToast, removeToast } = useToast();

  // When user navigates via PeriodSelector, switch off quick filter
  useEffect(() => {
    if (prevPeriodRef.current !== period) {
      setQuickFilter(null);
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

  useEffect(() => {
    getExpenses().then((data) => { setExpenses(data); setReady(true); });
  }, []);

  useEffect(() => {
    const refresh = () => getExpenses().then(setExpenses);
    window.addEventListener('focus', refresh);
    window.addEventListener('gastometro_expense_added', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('gastometro_expense_added', refresh);
    };
  }, []);

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  // ── Date range from quick filter or period context ───────────────────────────
  const now = new Date();
  const todayIso = isoDate(now);

  let rangeFrom: string;
  let rangeTo: string;
  let periodLabel: string;

  if (quickFilter === 'today') {
    rangeFrom = rangeTo = todayIso;
    periodLabel = 'Hoje';
  } else if (quickFilter === '7d') {
    const f = new Date(now); f.setDate(f.getDate() - 6);
    rangeFrom = isoDate(f); rangeTo = todayIso;
    periodLabel = 'Últimos 7 dias';
  } else if (quickFilter === '30d') {
    const f = new Date(now); f.setDate(f.getDate() - 29);
    rangeFrom = isoDate(f); rangeTo = todayIso;
    periodLabel = 'Últimos 30 dias';
  } else if (quickFilter === 'thisMonth') {
    const y = now.getFullYear(), m = now.getMonth() + 1;
    const last = new Date(y, m, 0).getDate();
    rangeFrom = `${y}-${String(m).padStart(2, '0')}-01`;
    rangeTo = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    periodLabel = getMonthLabel(getMonthKey(now));
  } else if (quickFilter === 'prevMonth') {
    const pd = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const y = pd.getFullYear(), m = pd.getMonth() + 1;
    const last = new Date(y, m, 0).getDate();
    rangeFrom = `${y}-${String(m).padStart(2, '0')}-01`;
    rangeTo = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
    periodLabel = getMonthLabel(getMonthKey(pd));
  } else {
    const [py, pm] = period.split('-').map(Number);
    const last = new Date(py, pm, 0).getDate();
    rangeFrom = `${period}-01`;
    rangeTo = `${period}-${String(last).padStart(2, '0')}`;
    periodLabel = getMonthLabel(period);
  }

  // ── Summary (all entries in range, no search/type filters) ──────────────────
  const baseEntries = expenses.filter((e) => e.date >= rangeFrom && e.date <= rangeTo);
  const income = calculateTotalByType(baseEntries, 'income');
  const spent = calculateTotalByType(baseEntries, 'expense');
  const balance = income - spent;

  // ── Filtered + sorted list ───────────────────────────────────────────────────
  const categoryOptions: Category[] =
    typeFilter === 'expense' ? EXPENSE_CATEGORIES
    : typeFilter === 'income' ? INCOME_CATEGORIES
    : ([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES.filter((c) => !EXPENSE_CATEGORIES.includes(c as never))] as Category[]);

  function handleTypeFilterChange(type: 'all' | EntryType) {
    setTypeFilter(type);
    if (type === 'expense' && INCOME_CATEGORIES.includes(categoryFilter as never)) setCategoryFilter('all');
    if (type === 'income' && EXPENSE_CATEGORIES.includes(categoryFilter as never)) setCategoryFilter('all');
  }

  const needle = search.trim().toLowerCase();
  const minAmt = minAmount !== '' ? parseFloat(minAmount) : null;
  const maxAmt = maxAmount !== '' ? parseFloat(maxAmount) : null;

  const filteredEntries = baseEntries
    .filter((e) => typeFilter === 'all' || e.type === typeFilter)
    .filter((e) => categoryFilter === 'all' || e.category === categoryFilter)
    .filter((e) => !needle || e.description.toLowerCase().includes(needle))
    .filter((e) => minAmt === null || e.amount >= minAmt)
    .filter((e) => maxAmt === null || e.amount <= maxAmt)
    .sort((a, b) => {
      if (sortOrder === 'oldest') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortOrder === 'highest') return b.amount - a.amount;
      if (sortOrder === 'lowest') return a.amount - b.amount;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  // ── Top gastos (grouping by description) ────────────────────────────────────
  const topGastosMap: Record<string, TopGasto> = {};
  for (const e of filteredEntries.filter((e) => e.type === 'expense')) {
    const key = e.description.trim().toLowerCase();
    if (!topGastosMap[key]) topGastosMap[key] = { displayName: e.description, total: 0, count: 0 };
    topGastosMap[key].total += e.amount;
    topGastosMap[key].count += 1;
  }
  const topGastos = Object.values(topGastosMap).sort((a, b) => b.total - a.total).slice(0, 5);

  // ── Insights ─────────────────────────────────────────────────────────────────
  const rangeFromMs = new Date(rangeFrom + 'T12:00:00').getTime();
  const rangeToMs = new Date(rangeTo + 'T12:00:00').getTime();
  const durationMs = rangeToMs - rangeFromMs;
  const prevRangeToDate = new Date(rangeFromMs - 24 * 60 * 60 * 1000);
  const prevRangeFromDate = new Date(prevRangeToDate.getTime() - durationMs);
  const prevRangeTo = isoDate(prevRangeToDate);
  const prevRangeFrom = isoDate(prevRangeFromDate);
  const prevRangeEntries = expenses.filter((e) => e.date >= prevRangeFrom && e.date <= prevRangeTo);

  const insights: Insight[] = [];

  // Insight 1: top category vs previous comparable range
  const expByCat: Record<string, number> = {};
  for (const e of filteredEntries.filter((e) => e.type === 'expense')) {
    expByCat[e.category as string] = (expByCat[e.category as string] || 0) + e.amount;
  }
  const topCatEntry = Object.entries(expByCat).sort((a, b) => b[1] - a[1])[0];
  if (topCatEntry) {
    const [topCat, topCatTotal] = topCatEntry;
    const prevCatTotal = prevRangeEntries
      .filter((e) => e.type === 'expense' && e.category === topCat)
      .reduce((s, e) => s + e.amount, 0);
    if (prevCatTotal > 0) {
      const pct = ((topCatTotal - prevCatTotal) / prevCatTotal) * 100;
      if (Math.abs(pct) >= 10) {
        insights.push({
          icon: pct > 0 ? '📈' : '📉',
          text: `${topCat} ${pct > 0 ? 'subiu' : 'caiu'} ${Math.abs(Math.round(pct))}% em relação ao período anterior`,
        });
      }
    }
  }

  // Insight 2: best month for savings
  if (insights.length < 2) {
    const monthGroups: Record<string, { income: number; spent: number }> = {};
    for (const e of expenses) {
      const month = e.date.slice(0, 7);
      if (!monthGroups[month]) monthGroups[month] = { income: 0, spent: 0 };
      if (e.type === 'income') monthGroups[month].income += e.amount;
      else monthGroups[month].spent += e.amount;
    }
    const monthsWithIncome = Object.entries(monthGroups).filter(([, v]) => v.income > 0);
    if (monthsWithIncome.length >= 2) {
      const [bestMonth, bestData] = [...monthsWithIncome].sort(
        (a, b) => (b[1].income - b[1].spent) - (a[1].income - a[1].spent)
      )[0];
      const bestBalance = bestData.income - bestData.spent;
      if (bestBalance > 0) {
        const [y, m] = bestMonth.split('-').map(Number);
        const mn = new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        insights.push({
          icon: '🏆',
          text: `${mn.charAt(0).toUpperCase() + mn.slice(1)} foi seu melhor mês (${formatCurrency(bestBalance)} economizados)`,
        });
      }
    }
  }

  return (
    <>
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">
      <h1 className="text-2xl font-bold text-white mb-1">Histórico</h1>
      <p className="text-slate-400 text-sm mb-4 capitalize">{periodLabel}</p>

      {/* Filtros rápidos de período */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-0.5">
        {(Object.entries(QUICK_FILTER_LABELS) as [Exclude<QuickFilter, null>, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setQuickFilter(key)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              quickFilter === key
                ? 'bg-violet-600 text-white'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
        {quickFilter === null && (
          <span className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 text-white">
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
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Ganhos</p>
          <p className="text-green-400 font-bold text-sm">{formatCurrency(income)}</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Gastos</p>
          <p className="text-red-400 font-bold text-sm">{formatCurrency(spent)}</p>
        </div>
        <div className={`rounded-xl p-3 border ${balance >= 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-0.5">Saldo</p>
          <p className={`font-bold text-sm ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(balance))}
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mb-2">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por descrição..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-9 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
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
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="Valor máximo"
          min="0"
          step="0.01"
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Tipo + Categoria + Ordenação */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <div className="flex p-0.5 bg-slate-900 border border-slate-800 rounded-xl flex-1 min-w-0">
          {(['all', 'expense', 'income'] as const).map((t) => (
            <button
              key={t}
              onClick={() => handleTypeFilterChange(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                typeFilter === t ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t === 'all' ? 'Todos' : t === 'expense' ? 'Gastos' : 'Receitas'}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as Category | 'all')}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors shrink-0"
        >
          <option value="all">Todas</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500 transition-colors shrink-0"
        >
          <option value="recent">Mais recente</option>
          <option value="oldest">Mais antigo</option>
          <option value="highest">Maior valor</option>
          <option value="lowest">Menor valor</option>
        </select>
      </div>

      {/* Top gastos do período */}
      {topGastos.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">
            Top gastos do período
          </p>
          <div className="space-y-2.5">
            {topGastos.map((g, i) => (
              <div key={g.displayName} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-slate-600 text-xs font-bold w-4 flex-shrink-0 text-right">{i + 1}</span>
                  <p className="text-slate-300 text-sm truncate">{g.displayName}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-slate-500 text-xs">{g.count}×</span>
                  <span className="text-white font-semibold text-sm">{formatCurrency(g.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights históricos */}
      {insights.length > 0 && (
        <div className="bg-slate-900 border border-violet-500/20 rounded-2xl p-4 mb-4">
          <p className="text-violet-400/80 text-xs font-medium uppercase tracking-wider mb-3">
            Insights
          </p>
          <div className="space-y-2.5">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="text-base leading-none">{insight.icon}</span>
                <span className="text-slate-300 text-sm">{insight.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      {baseEntries.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Nenhum lançamento neste período</p>
      ) : filteredEntries.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Nenhum resultado para os filtros aplicados</p>
      ) : (
        <div className="space-y-2">
          {filteredEntries.map((exp) => {
            const cfg = CATEGORY_CONFIG[exp.category];
            const day = exp.date.slice(8, 10);
            const month = exp.date.slice(5, 7);
            const isIncome = exp.type === 'income';
            const isFuture = exp.date > todayIso;
            return (
              <div key={exp.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{exp.description}</p>
                  <p className="text-slate-500 text-xs">{exp.category} · {day}/{month}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`font-semibold text-sm whitespace-nowrap ${isFuture ? 'text-slate-400' : isIncome ? 'text-green-400' : 'text-white'}`}>
                    {isIncome ? '+' : ''}{formatCurrency(exp.amount)}
                  </span>
                  {isFuture && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                      futuro
                    </span>
                  )}
                </div>
                <button onClick={() => setEditingExpense(exp)} className="text-slate-600 hover:text-violet-400 transition-colors flex-shrink-0 ml-2" aria-label="Editar">
                  <Pencil size={15} />
                </button>
                <button onClick={() => setDuplicatingExpense(exp)} className="text-slate-600 hover:text-cyan-400 transition-colors flex-shrink-0" aria-label="Duplicar">
                  <Copy size={15} />
                </button>
                <button onClick={() => setDeletingExpense(exp)} className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0" aria-label="Excluir">
                  <Trash2 size={15} />
                </button>
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
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
