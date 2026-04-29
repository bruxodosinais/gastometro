'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, Loader2, LogOut, Plus, RefreshCw, Star, X } from 'lucide-react';
import { getExpenses, getBudgets, getRecurringExpenses, getMonthlyPlan } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import {
  calculateTotalByType,
  formatCurrency,
  getCategoryAlerts,
  getMonthKey,
  getMonthLabel,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import { calculateStreak } from '@/lib/streak';
import PeriodSelector from '@/components/PeriodSelector';
import { Budget, CategorySummary, Expense, EXPENSE_CATEGORIES, MonthlyPlan, RecurringExpense } from '@/lib/types';
import dynamic from 'next/dynamic';
import PlanningSection from '@/components/PlanningSection';

const SpendingDonut = dynamic(() => import('@/components/SpendingDonut'), { ssr: false });
const MonthlyBars = dynamic(() => import('@/components/MonthlyBars'), { ssr: false });

interface SmartAlert {
  emoji: string;
  text: string;
  priority: number;
}

type ResumoData = {
  resumo: string;
  geradoEm: string;
  cachedAt: number;
};

const RESUMO_CACHE_KEY = 'gastometro_resumo_semanal';
const RESUMO_CACHE_TTL = 6 * 60 * 60 * 1000;

function renderBotText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

const MOTIVATIONAL_MSGS = [
  'Nenhum gasto hoje ainda — dia econômico! 💪',
  'Sem lançamentos por enquanto. Guarde o dinheiro! 🎯',
  'Dia limpo até agora. Continue assim! ✨',
];

export default function HomePage() {
  const { period } = usePeriod();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
  const [ready, setReady] = useState(false);
  const [dailyChecked, setDailyChecked] = useState(false);
  const [newBadgeIds, setNewBadgeIds] = useState<Set<string>>(new Set());
  const [resumoData, setResumoData] = useState<ResumoData | null>(null);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [showResumoModal, setShowResumoModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showBellMenu, setShowBellMenu] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const bellMenuRef = useRef<HTMLDivElement>(null);
  const badgeEarnedRef = useRef({ b1: false, b2: false, b3: false, b4: false });

  useEffect(() => {
    Promise.all([getExpenses(), getBudgets(), getRecurringExpenses()]).then(([exp, bud, rec]) => {
      setExpenses(exp);
      setBudgets(bud);
      setRecurringExpenses(rec);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    getMonthlyPlan(period).then(setMonthlyPlan);
  }, [period]);

  useEffect(() => {
    if (!ready) return;
    const { b1, b2, b3, b4 } = badgeEarnedRef.current;
    const stored = localStorage.getItem('gastometro_badges_seen');
    const seen = new Set<string>(stored ? JSON.parse(stored) : []);
    const newOnes = (
      [['primeiro_mil', b1], ['guardiao', b2], ['tres_meses', b3], ['streak_mestre', b4]] as [string, boolean][]
    ).filter(([id, earned]) => earned && !seen.has(id)).map(([id]) => id);
    if (newOnes.length > 0) {
      setNewBadgeIds(new Set(newOnes));
      localStorage.setItem('gastometro_badges_seen', JSON.stringify([...seen, ...newOnes]));
      setTimeout(() => setNewBadgeIds(new Set()), 3000);
    }
  }, [ready]);

  useEffect(() => {
    const stored = localStorage.getItem('gastometro_daily_check');
    if (stored) {
      const ts = parseInt(stored, 10);
      if (Date.now() - ts < 24 * 60 * 60 * 1000) setDailyChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!showAvatarMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAvatarMenu]);

  useEffect(() => {
    if (!showBellMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (bellMenuRef.current && !bellMenuRef.current.contains(e.target as Node)) {
        setShowBellMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showBellMenu]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  function handleDailyCheck() {
    localStorage.setItem('gastometro_daily_check', Date.now().toString());
    setDailyChecked(true);
  }

  async function loadResumo(forceRefresh = false) {
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(RESUMO_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as ResumoData;
          if (Date.now() - cached.cachedAt < RESUMO_CACHE_TTL) {
            setResumoData(cached);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    setResumoLoading(true);
    try {
      const res = await fetch('/api/resumo-semanal');
      const json = await res.json();
      if (json.resumo) {
        const data: ResumoData = {
          resumo: json.resumo,
          geradoEm: json.geradoEm,
          cachedAt: Date.now(),
        };
        setResumoData(data);
        try { localStorage.setItem(RESUMO_CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally {
      setResumoLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </main>
    );
  }

  const periodEntries = expenses.filter((e) => e.date.slice(0, 7) === period);
  const income = calculateTotalByType(periodEntries, 'income');
  const spent = calculateTotalByType(periodEntries, 'expense');
  const balance = income - spent;

  const alerts: CategorySummary[] = getCategoryAlerts(expenses, period).filter(
    (a) => a.isAlert
  );

  const periodExpenses = periodEntries.filter((e) => e.type === 'expense');
  const budgetAlerts = budgets
    .map((b) => {
      const total = periodExpenses
        .filter((e) => e.category === b.category)
        .reduce((sum, e) => sum + e.amount, 0);
      return { category: b.category, total, budget: b.amount, pct: (total / b.amount) * 100 };
    })
    .filter((b) => b.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  const recent = [...periodEntries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const fixedCosts = recurringExpenses
    .filter((r) => r.active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);

  // ── Insights ────────────────────────────────────────────────────────────────
  const now = new Date();
  const isCurrentMonth = period === getMonthKey(now);
  const [periodYear, periodMonth] = period.split('-').map(Number);
  const totalDaysInMonth = new Date(periodYear, periodMonth, 0).getDate();
  const todayDay = isCurrentMonth ? now.getDate() : totalDaysInMonth;
  const daysElapsed = Math.max(isCurrentMonth ? todayDay : totalDaysInMonth, 1);
  const daysRemaining = isCurrentMonth ? totalDaysInMonth - todayDay : 0;

  const dailyAvailable = isCurrentMonth && daysRemaining > 0 ? balance / daysRemaining : null;
  const dailySpent = spent / totalDaysInMonth;

  const projectedSpending = isCurrentMonth && spent > 0
    ? (spent / daysElapsed) * totalDaysInMonth
    : spent;
  const projectedOverBudget = income > 0 && projectedSpending > income;

  const prevDate = new Date(periodYear, periodMonth - 2, 15);
  const prevPeriod = getMonthKey(prevDate);
  const prevSpent = calculateTotalByType(
    expenses.filter((e) => e.date.slice(0, 7) === prevPeriod),
    'expense'
  );
  const spentChange = prevSpent > 0 ? ((spent - prevSpent) / prevSpent) * 100 : null;
  const spentDiff = spentChange !== null ? spent - prevSpent : null;

  type ProjStatus = 'ok' | 'warning' | 'over';
  const projectionStatus: ProjStatus | null =
    !isCurrentMonth || spent === 0
      ? null
      : projectedOverBudget
      ? 'over'
      : (income > 0 && projectedSpending > income * 0.85) ||
        (prevSpent > 0 && projectedSpending > prevSpent * 1.2)
      ? 'warning'
      : 'ok';

  const biggestExpense = periodExpenses.reduce<Expense | null>(
    (max, e) => (!max || e.amount > max.amount ? e : max),
    null
  );
  const biggestPct = biggestExpense && spent > 0
    ? (biggestExpense.amount / spent) * 100
    : null;

  const projectedSurplus = income - projectedSpending;

  // ── Engajamento Diário ───────────────────────────────────────────────────────
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  const todayEntries = isCurrentMonth ? expenses.filter((e) => e.date === todayStr) : [];
  const todaySpent = todayEntries.filter((e) => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  const todayIncome = todayEntries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const todayBalance = todayIncome - todaySpent;

  const streak = isCurrentMonth ? calculateStreak(expenses) : 0;

  // ── Missões ──────────────────────────────────────────────────────────────────
  const deliveryDates = new Set(
    expenses.filter((e) => e.category === 'Delivery').map((e) => e.date)
  );
  let deliveryFreeStreak = 0;
  {
    const cursor = new Date(now);
    while (deliveryFreeStreak < 3) {
      const ds = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, '0'),
        String(cursor.getDate()).padStart(2, '0'),
      ].join('-');
      if (deliveryDates.has(ds)) break;
      deliveryFreeStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }
  const m1Done = deliveryFreeStreak >= 3;
  const m1Pct = Math.min(deliveryFreeStreak / 3, 1);

  const dayOfWeek = now.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekMonday = new Date(now);
  weekMonday.setDate(now.getDate() - daysFromMonday);
  const fmtD = (d: Date) =>
    [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  const weekMondayStr = fmtD(weekMonday);
  const weekSunday = new Date(weekMonday);
  weekSunday.setDate(weekMonday.getDate() + 6);
  const weekSundayStr = fmtD(weekSunday);
  const weekSpent = expenses
    .filter((e) => e.type === 'expense' && e.date >= weekMondayStr && e.date <= weekSundayStr)
    .reduce((s, e) => s + e.amount, 0);
  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const weeklyRef = totalBudget > 0 ? totalBudget / 4 : income > 0 ? income / 4 : 0;
  const m2Done = weeklyRef > 0 && weekSpent < weeklyRef;
  const m2OverBudget = weeklyRef > 0 && weekSpent >= weeklyRef;

  const m3Done = streak >= 5;
  const m3Pct = Math.min(streak / 5, 1);

  // ── Medalhas ─────────────────────────────────────────────────────────────────
  const monthBalances = new Map<string, number>();
  for (const e of expenses) {
    const mk = e.date.slice(0, 7);
    monthBalances.set(mk, (monthBalances.get(mk) ?? 0) + (e.type === 'income' ? e.amount : -e.amount));
  }
  const balanceValues = [...monthBalances.values()];
  const badge1Earned = balanceValues.some((b) => b >= 1000);
  const badge2Earned = balanceValues.some((b) => b >= 5000);

  let badge3Earned = false;
  const sortedMonthKeys = [...monthBalances.keys()].sort();
  for (let i = 2; i < sortedMonthKeys.length; i++) {
    const toN = (mk: string) => { const [y, m] = mk.split('-').map(Number); return y * 12 + m; };
    if (
      toN(sortedMonthKeys[i]) - toN(sortedMonthKeys[i - 1]) === 1 &&
      toN(sortedMonthKeys[i - 1]) - toN(sortedMonthKeys[i - 2]) === 1 &&
      (monthBalances.get(sortedMonthKeys[i - 2]) ?? 0) > 0 &&
      (monthBalances.get(sortedMonthKeys[i - 1]) ?? 0) > 0 &&
      (monthBalances.get(sortedMonthKeys[i]) ?? 0) > 0
    ) { badge3Earned = true; break; }
  }

  const badge4Earned = streak >= 7;
  badgeEarnedRef.current = { b1: badge1Earned, b2: badge2Earned, b3: badge3Earned, b4: badge4Earned };

  // ── Alertas inteligentes antigos (máx 3) ────────────────────────────────────
  const smartAlerts: SmartAlert[] = [];
  if (isCurrentMonth) {
    const categoryAlertData = getCategoryAlerts(expenses, period);
    const deliveryData = categoryAlertData.find((a) => a.category === 'Delivery');
    if (deliveryData && deliveryData.average > 0 && deliveryData.percentChange > 20) {
      smartAlerts.push({
        emoji: '🛵',
        text: `Delivery acima da média (+${Math.round(deliveryData.percentChange)}%)`,
        priority: deliveryData.percentChange * 2,
      });
    }
    for (const alert of categoryAlertData) {
      if (alert.category === 'Delivery') continue;
      if (alert.average > 0 && alert.percentChange > 15) {
        smartAlerts.push({
          emoji: '📈',
          text: `${alert.category} subiu ${Math.round(alert.percentChange)}%`,
          priority: alert.percentChange,
        });
      }
    }
    for (const rec of recurringExpenses) {
      if (!rec.active) continue;
      const hasEntry = periodEntries.some((e) => e.recurringExpenseId === rec.id);
      if (!hasEntry) {
        smartAlerts.push({
          emoji: '⚠️',
          text: `${rec.description} ainda não foi lançado esse mês`,
          priority: rec.amount / 10,
        });
      }
    }
  }
  const topSmartAlerts = [...smartAlerts].sort((a, b) => b.priority - a.priority).slice(0, 3);

  const motivationalMsg = MOTIVATIONAL_MSGS[now.getDate() % MOTIVATIONAL_MSGS.length];

  // ── V2: Header ───────────────────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const currentMonthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  let dynamicPhrase = 'Cada lançamento conta. Continue.';
  if (isCurrentMonth) {
    const baseRef = monthlyPlan?.expectedIncome ?? income;
    if (baseRef > 0 && balance > baseRef * 0.3) {
      dynamicPhrase = 'Excelente ritmo este mês.';
    } else if (balance > 0) {
      dynamicPhrase = 'Você está no controle.';
    } else if (dailyAvailable !== null && dailyAvailable > 0) {
      dynamicPhrase = 'Hoje dá para acelerar sua meta.';
    }
  }

  // ── V2: Hero Card ────────────────────────────────────────────────────────────
  const heroBase = (monthlyPlan?.expectedIncome ?? 0) > 0 ? monthlyPlan!.expectedIncome : income;
  const canSpendToday = isCurrentMonth && daysRemaining > 0
    ? (heroBase - spent) / daysRemaining
    : null;
  const budgetPct = heroBase > 0 ? Math.min((spent / heroBase) * 100, 100) : 0;
  const heroStatus: 'excellent' | 'ok' | 'warning' =
    budgetPct < 60 ? 'excellent' : budgetPct < 85 ? 'ok' : 'warning';
  const heroStatusLabel =
    heroStatus === 'excellent' ? 'Excelente controle' :
    heroStatus === 'ok' ? 'Dentro do plano' :
    'Atenção ao ritmo';
  const heroStatusColor =
    heroStatus === 'excellent' ? 'text-emerald-400' :
    heroStatus === 'ok' ? 'text-yellow-400' :
    'text-red-400';
  const heroBarColor =
    heroStatus === 'excellent' ? 'bg-violet-500' :
    heroStatus === 'ok' ? 'bg-yellow-500' :
    'bg-red-500';

  // ── V2: Resumo IA Compacto bullets ───────────────────────────────────────────
  const categoryTotals = EXPENSE_CATEGORIES.map((cat) => ({
    cat,
    total: periodExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const topCat = categoryTotals[0];

  const compactBullets = [
    balance >= 0
      ? `Superávit de ${formatCurrency(balance)} no mês`
      : `Déficit de ${formatCurrency(Math.abs(balance))} no mês`,
    topCat
      ? `Maior gasto: ${topCat.cat} (${formatCurrency(topCat.total)})`
      : 'Nenhum gasto registrado ainda',
    monthlyPlan && monthlyPlan.savingsGoal > 0
      ? balance >= monthlyPlan.savingsGoal
        ? `Meta de poupança atingida ✓ (${formatCurrency(monthlyPlan.savingsGoal)})`
        : `Meta: ${formatCurrency(monthlyPlan.savingsGoal)} · faltam ${formatCurrency(Math.max(monthlyPlan.savingsGoal - balance, 0))}`
      : 'Meta de poupança não definida',
    streak >= 2
      ? `${streak} dias seguidos com lançamentos 🔥`
      : streak === 1
        ? '1 dia de registro — continue amanhã'
        : 'Sem streak ativo — registre algo hoje',
  ];

  // ── V2: Alertas Inteligentes (máx 2) ─────────────────────────────────────────
  interface NewAlert { emoji: string; text: string; priority: number; }
  const newAlerts: NewAlert[] = [];

  if (isCurrentMonth) {
    for (const b of budgetAlerts.slice(0, 2)) {
      newAlerts.push({
        emoji: '⚠️',
        text: `${b.category} perto do limite (${Math.round(b.pct)}%)`,
        priority: b.pct,
      });
    }

    for (const rec of recurringExpenses) {
      if (!rec.active || rec.type !== 'expense') continue;
      const hasEntry = periodEntries.some((e) => e.recurringExpenseId === rec.id);
      if (hasEntry) continue;
      const dayDiff = rec.dayOfMonth - now.getDate();
      if (dayDiff >= 0 && dayDiff <= 3) {
        newAlerts.push({
          emoji: '💡',
          text: `${rec.description} renova em breve`,
          priority: 90 - dayDiff * 5,
        });
      }
    }

    if (monthlyPlan && monthlyPlan.expectedIncome > 0 && income < monthlyPlan.expectedIncome) {
      newAlerts.push({ emoji: '📉', text: 'Receita abaixo do previsto', priority: 50 });
    }
  }

  const topNewAlerts = [...newAlerts].sort((a, b) => b.priority - a.priority).slice(0, 2);

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-6">

      {/* ── HEADER PREMIUM ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting}, Anderson</h1>
          <p className="text-slate-400 text-sm capitalize">{currentMonthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div ref={bellMenuRef} className="relative">
            <button
              title="Notificações"
              onClick={() => setShowBellMenu((v) => !v)}
              className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-violet-300 transition-colors"
            >
              <Bell size={16} />
            </button>
            {showBellMenu && (
              <div className="absolute right-0 top-12 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl px-4 py-3 z-50">
                <p className="text-slate-400 text-sm">🔔 Notificações em breve</p>
              </div>
            )}
          </div>
          <div ref={avatarMenuRef} className="relative">
            <button
              onClick={() => setShowAvatarMenu((v) => !v)}
              title="Menu do perfil"
              className="w-10 h-10 rounded-2xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-300 font-bold text-sm hover:bg-violet-600/30 transition-colors"
            >
              A
            </button>
            {showAvatarMenu && (
              <div className="absolute right-0 top-12 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                <button
                  onClick={() => setShowAvatarMenu(false)}
                  className="w-full text-left px-4 py-3 text-slate-300 text-sm hover:bg-slate-800 transition-colors"
                >
                  Perfil
                </button>
                <div className="border-t border-slate-800" />
                <button
                  onClick={() => { setShowAvatarMenu(false); handleLogout(); }}
                  className="w-full text-left px-4 py-3 text-red-400 text-sm hover:bg-slate-800 transition-colors"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-violet-300/70 text-sm italic mb-4">{dynamicPhrase}</p>

      {/* Seletor de período */}
      <PeriodSelector />

      {/* ── HERO CARD ──────────────────────────────────────────────────────────── */}
      {isCurrentMonth && (
        <div className="mt-4 mb-3 bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-transparent border border-violet-500/30 rounded-2xl p-6">
          <p className="text-violet-300/70 text-xs font-medium uppercase tracking-wider mb-3">
            Pode gastar hoje
          </p>

          {daysRemaining > 0 && canSpendToday !== null ? (
            <>
              <p className={`text-5xl font-bold leading-none mb-2 ${canSpendToday < 0 ? 'text-red-400' : 'text-violet-200'}`}>
                {canSpendToday < 0 ? '−' : ''}{formatCurrency(Math.abs(canSpendToday))}
              </p>
              <p className="text-slate-400 text-sm mb-4">
                {canSpendToday < 0 ? 'saldo esgotado' : `${daysRemaining} dias restantes no mês`}
              </p>
              <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${heroBarColor}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${heroStatusColor}`}>{heroStatusLabel}</span>
                <span className="text-slate-500 text-xs">{Math.round(budgetPct)}% do orçamento</span>
              </div>
            </>
          ) : daysRemaining === 1 ? (
            <div className="mb-2">
              <p className="text-slate-400 text-sm mb-3">Último dia do mês</p>
              <div className="flex gap-5">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Gasto hoje</p>
                  <p className="text-white font-bold text-xl">{formatCurrency(todaySpent)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Sobra no mês</p>
                  <p className={`font-bold text-xl ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {balance >= 0 ? '' : '−'}{formatCurrency(Math.abs(balance))}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-2">
              <p className="text-slate-400 text-sm mb-3">Resumo final do mês</p>
              <div className="flex gap-5 flex-wrap">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Total gasto</p>
                  <p className="text-white font-bold text-xl">{formatCurrency(spent)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Total ganho</p>
                  <p className="text-green-400 font-bold text-xl">{formatCurrency(income)}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Saldo final</p>
                  <p className={`font-bold text-xl ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {balance >= 0 ? '' : '−'}{formatCurrency(Math.abs(balance))}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Link
            href="/lancamentos"
            className="mt-4 block text-center bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            + Lançar gasto
          </Link>
        </div>
      )}

      {/* ── TRIO MINI CARDS ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div className={`rounded-2xl p-4 border ${balance >= 0 ? 'bg-blue-500/5 border-blue-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Saldo atual</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {balance >= 0 ? '' : '−'}{formatCurrency(Math.abs(balance))}
          </p>
          <p className="text-slate-500 text-xs mt-1">receitas − gastos</p>
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Gastos do mês</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(spent)}</p>
          <p className="text-slate-500 text-xs mt-1">despesas lançadas</p>
        </div>
        <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Receitas</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(income)}</p>
          <p className="text-slate-500 text-xs mt-1">entradas do mês</p>
        </div>
      </div>

      {/* ── RESUMO IA COMPACTO ─────────────────────────────────────────────────── */}
      <div className="mb-3 bg-slate-900 border border-violet-500/25 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star size={14} className="text-violet-400" />
            <p className="text-white font-semibold text-sm">Resumo do mês</p>
            <span className="text-[10px] text-violet-400/60 font-semibold uppercase tracking-wider">IA</span>
          </div>
          <button
            onClick={() => { setShowResumoModal(true); if (!resumoData) loadResumo(); }}
            className="text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors"
          >
            Ver análise completa →
          </button>
        </div>
        <ul className="space-y-2">
          {compactBullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="text-violet-400/50 mt-0.5 flex-shrink-0">•</span>
              <span className="text-slate-300">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── ALERTAS INTELIGENTES ───────────────────────────────────────────────── */}
      <div className="mb-5 bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Alertas</p>
        {topNewAlerts.length > 0 ? (
          <div className="space-y-2.5">
            {topNewAlerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="text-base leading-none">{alert.emoji}</span>
                <span className="text-slate-300 text-sm">{alert.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="text-base leading-none">✅</span>
            <span className="text-slate-300 text-sm">Nenhum risco detectado</span>
          </div>
        )}
      </div>

      {/* ── RESTANTE DA HOME ATUAL ─────────────────────────────────────────────── */}
      {isCurrentMonth && (
        <div className="mb-4 space-y-3">

          {/* Streak */}
          <div className={`rounded-2xl p-4 border flex items-center gap-3 ${
            streak >= 3
              ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30'
              : 'bg-slate-900 border-slate-800'
          }`}>
            <span className="text-2xl leading-none">{streak >= 2 ? '🔥' : streak === 1 ? '✨' : '💡'}</span>
            <div>
              {streak >= 2 ? (
                <p className="text-white font-semibold text-sm">{streak} dias seguidos registrando</p>
              ) : streak === 1 ? (
                <p className="text-white font-semibold text-sm">Começou hoje! Continue amanhã</p>
              ) : (
                <p className="text-slate-400 text-sm">Registre algo hoje para começar seu streak</p>
              )}
              {streak >= 2 && <p className="text-slate-500 text-xs mt-0.5">Não perca o ritmo!</p>}
            </div>
          </div>

          {/* Missões da semana */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4">Missões da semana</p>
            <div className="space-y-4">

              <div>
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="text-base leading-none mt-0.5">🛵</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white text-sm font-medium">3 dias sem delivery</p>
                      {m1Done
                        ? <span className="text-green-400 text-xs font-semibold flex-shrink-0">✅ Feito</span>
                        : <span className="text-slate-400 text-xs flex-shrink-0">{deliveryFreeStreak}/3</span>
                      }
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {m1Done
                        ? '3+ dias sem pedir delivery!'
                        : deliveryFreeStreak === 0
                        ? 'Teve delivery hoje ou ontem'
                        : `${deliveryFreeStreak} dia${deliveryFreeStreak > 1 ? 's' : ''} sem delivery — continue!`}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${m1Done ? 'bg-green-500' : 'bg-violet-500'}`}
                    style={{ width: `${Math.round(m1Pct * 100)}%` }}
                  />
                </div>
              </div>

              <div className="border-t border-slate-800" />

              <div>
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="text-base leading-none mt-0.5">🎯</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white text-sm font-medium">Semana abaixo da meta</p>
                      {m2Done
                        ? <span className="text-green-400 text-xs font-semibold flex-shrink-0">✅ Feito</span>
                        : m2OverBudget
                        ? <span className="text-red-400 text-xs font-semibold flex-shrink-0">Excedido</span>
                        : <span className="text-slate-400 text-xs flex-shrink-0">—</span>
                      }
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {weeklyRef === 0
                        ? 'Defina orçamento ou registre receita'
                        : m2Done
                        ? `Dentro da meta — sobra ${formatCurrency(weeklyRef - weekSpent)}`
                        : `${formatCurrency(weekSpent)} gasto · meta ${formatCurrency(weeklyRef)}`}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${m2Done ? 'bg-green-500' : m2OverBudget ? 'bg-red-500' : 'bg-slate-700'}`}
                    style={{ width: m2Done || m2OverBudget ? '100%' : '0%' }}
                  />
                </div>
              </div>

              <div className="border-t border-slate-800" />

              <div>
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="text-base leading-none mt-0.5">📅</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white text-sm font-medium">Lançar tudo por 5 dias</p>
                      {m3Done
                        ? <span className="text-green-400 text-xs font-semibold flex-shrink-0">✅ Feito</span>
                        : <span className="text-slate-400 text-xs flex-shrink-0">{streak}/5</span>
                      }
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {m3Done
                        ? '5+ dias seguidos registrando!'
                        : streak === 0
                        ? 'Registre algo hoje para começar'
                        : `${streak} dia${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''} — faltam ${5 - streak}`}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${m3Done ? 'bg-green-500' : 'bg-violet-500'}`}
                    style={{ width: `${Math.round(m3Pct * 100)}%` }}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Conquistas */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4">Conquistas</p>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { id: 'primeiro_mil', icon: '🥉', name: 'Primeiro Mil', desc: 'Economizou R$1.000 em um mês', earned: badge1Earned, bg: 'bg-amber-700/20', border: 'border-amber-700/40', text: 'text-amber-600' },
                  { id: 'guardiao', icon: '🥈', name: 'Guardião', desc: 'Economizou R$5.000 em um mês', earned: badge2Earned, bg: 'bg-slate-300/20', border: 'border-slate-300/40', text: 'text-slate-300' },
                  { id: 'tres_meses', icon: '🥇', name: '3 Meses Positivos', desc: 'Saldo positivo por 3 meses seguidos', earned: badge3Earned, bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-500' },
                  { id: 'streak_mestre', icon: '🔥', name: 'Streak Mestre', desc: '7 dias seguidos registrando', earned: badge4Earned, bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' },
                ] as const
              ).map((badge) => (
                <div
                  key={badge.id}
                  className={`rounded-xl p-3 border ${badge.earned ? `${badge.bg} ${badge.border}` : 'bg-slate-800/50 border-slate-700/50'} ${newBadgeIds.has(badge.id) ? 'animate-pulse' : ''}`}
                >
                  <span className={`text-3xl leading-none block mb-2 ${badge.earned ? '' : 'grayscale opacity-30'}`}>{badge.icon}</span>
                  <p className={`font-semibold text-sm leading-tight ${badge.earned ? 'text-white' : 'text-slate-600'}`}>{badge.name}</p>
                  <p className={`text-xs mt-1 leading-tight ${badge.earned ? badge.text : 'text-slate-600'}`}>{badge.earned ? badge.desc : 'Bloqueada'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ritmo do mês */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">Fecha em</p>
              <p className={`text-lg font-bold ${income > 0 && projectedSpending > income ? 'text-red-400' : 'text-white'}`}>
                {formatCurrency(projectedSpending)}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">no ritmo atual</p>
            </div>
            <div className={`rounded-2xl p-4 border ${projectedSurplus >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
              <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">Economia prevista</p>
              <p className={`text-lg font-bold ${projectedSurplus >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {projectedSurplus >= 0 ? '' : '−'}{formatCurrency(Math.abs(projectedSurplus))}
              </p>
              <p className="text-slate-500 text-xs mt-0.5">
                {income > 0 ? 'receita − projeção' : 'sem receita registrada'}
              </p>
            </div>
          </div>

          {/* Alertas inteligentes antigos */}
          {topSmartAlerts.length > 0 && (
            <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-4">
              <p className="text-amber-400/80 text-xs font-medium uppercase tracking-wider mb-3">Alertas de tendência</p>
              <div className="space-y-2.5">
                {topSmartAlerts.map((alert, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{alert.emoji}</span>
                    <span className="text-slate-300 text-sm">{alert.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumo do dia */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3 capitalize">
              {now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {todayEntries.length === 0 ? (
              <p className="text-slate-400 text-sm">{motivationalMsg}</p>
            ) : (
              <div className="flex gap-5 flex-wrap">
                {todaySpent > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Gastou</p>
                    <p className="text-white font-semibold text-sm">{formatCurrency(todaySpent)}</p>
                  </div>
                )}
                {todayIncome > 0 && (
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Ganhou</p>
                    <p className="text-green-400 font-semibold text-sm">{formatCurrency(todayIncome)}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">Saldo do dia</p>
                  <p className={`font-semibold text-sm ${todayBalance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {todayBalance >= 0 ? '+' : '−'}{formatCurrency(Math.abs(todayBalance))}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Check diário */}
          {!dailyChecked ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
              <p className="text-slate-300 text-sm">Registrou tudo hoje?</p>
              <button
                onClick={handleDailyCheck}
                className="flex-shrink-0 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                Sim, está tudo aqui ✓
              </button>
            </div>
          ) : (
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 text-center">
              <p className="text-green-400 text-sm font-medium">✓ Tudo registrado hoje!</p>
              <p className="text-slate-500 text-xs mt-1">Você está no controle 🎯</p>
            </div>
          )}

        </div>
      )}

      {/* ── Insights: 5 cards compactos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">
            {isCurrentMonth && daysRemaining > 0 ? 'Ritmo diário disponível' : 'Gasto médio por dia'}
          </p>
          {isCurrentMonth && dailyAvailable !== null ? (
            <>
              <p className={`text-xl font-bold ${dailyAvailable < 0 ? 'text-red-400' : 'text-white'}`}>
                {dailyAvailable < 0 ? `−${formatCurrency(Math.abs(dailyAvailable))}` : `${formatCurrency(dailyAvailable)}/dia`}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                {dailyAvailable < 0 ? 'saldo negativo — ritmo excedido' : `${daysRemaining} dias restantes no mês`}
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-white">{formatCurrency(dailySpent)}/dia</p>
              <p className="text-slate-500 text-xs mt-1">{isCurrentMonth ? 'último dia do mês' : 'média real do período'}</p>
            </>
          )}
        </div>

        <div className={`rounded-2xl p-4 border ${
          projectionStatus === 'over' ? 'bg-red-500/5 border-red-500/20' :
          projectionStatus === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
          'bg-slate-900 border-slate-800'
        }`}>
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">
            {isCurrentMonth ? 'Previsão do mês' : 'Total do mês'}
          </p>
          <p className={`text-xl font-bold ${
            projectionStatus === 'over' ? 'text-red-400' :
            projectionStatus === 'warning' ? 'text-yellow-400' :
            'text-white'
          }`}>{formatCurrency(projectedSpending)}</p>
          <p className={`text-xs mt-1 font-medium ${
            projectionStatus === 'over' ? 'text-red-400/80' :
            projectionStatus === 'warning' ? 'text-yellow-400/80' :
            projectionStatus === 'ok' ? 'text-green-400/80' :
            'text-slate-500'
          }`}>
            {projectionStatus === 'over' ? 'Acima da média' :
             projectionStatus === 'warning' ? 'Próximo do limite' :
             projectionStatus === 'ok' ? 'Dentro do esperado' :
             !isCurrentMonth ? 'gasto real do período' :
             'nenhum gasto registrado ainda'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">vs mês anterior</p>
          {spentChange === null ? (
            <>
              <p className="text-xl font-bold text-slate-500">—</p>
              <p className="text-slate-600 text-xs mt-1">sem dados do mês anterior</p>
            </>
          ) : (
            <>
              <p className={`text-xl font-bold ${spentChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {spentChange > 0 ? '+' : ''}{Math.round(spentChange)}%{' '}
                <span className="text-sm font-semibold opacity-80">
                  ({spentDiff! > 0 ? '+' : ''}{formatCurrency(spentDiff!)})
                </span>
              </p>
              <p className="text-slate-500 text-xs mt-1">{formatCurrency(prevSpent)} em {getMonthLabel(prevPeriod)}</p>
            </>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">Maior gasto do mês</p>
          {biggestExpense ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{CATEGORY_CONFIG[biggestExpense.category].icon}</span>
                <p className="text-xl font-bold text-white">{formatCurrency(biggestExpense.amount)}</p>
              </div>
              <p className="text-slate-500 text-xs mt-1 truncate">{biggestExpense.description}</p>
              {biggestPct !== null && <p className="text-slate-600 text-xs mt-0.5">{Math.round(biggestPct)}% dos gastos do mês</p>}
            </>
          ) : (
            <>
              <p className="text-xl font-bold text-slate-500">—</p>
              <p className="text-slate-600 text-xs mt-1">nenhum gasto ainda</p>
            </>
          )}
        </div>

        <div className={`md:col-span-2 rounded-2xl p-4 border ${
          projectedSurplus >= 0 ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'
        }`}>
          <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider mb-1.5">Sobra prevista</p>
          <div className="flex items-end gap-3 flex-wrap">
            <p className={`text-2xl font-bold ${projectedSurplus >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {projectedSurplus >= 0 ? '' : '−'}{formatCurrency(Math.abs(projectedSurplus))}
            </p>
            <p className="text-slate-500 text-xs mb-0.5">
              {income > 0 ? `receita ${formatCurrency(income)} − previsão ${formatCurrency(projectedSpending)}` : 'sem receita registrada no período'}
            </p>
          </div>
        </div>

      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-slate-200 font-semibold text-sm mb-4">Gastos por Categoria</h2>
          <SpendingDonut entries={periodEntries} />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-slate-200 font-semibold text-sm mb-4">Evolução — últimos 6 meses</h2>
          <MonthlyBars allExpenses={expenses} currentPeriod={period} />
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />Ganhos
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />Gastos
            </div>
          </div>
        </div>
      </div>

      {/* Planejamento mensal */}
      <PlanningSection
        period={period}
        income={income}
        spent={spent}
        fixedCosts={fixedCosts}
        budgets={budgets}
        periodExpenses={periodExpenses}
        monthlyPlan={monthlyPlan}
        onPlanUpdate={setMonthlyPlan}
      />

      {/* Últimas movimentações + alertas antigos */}
      <div className="md:grid md:grid-cols-[1fr_420px] md:gap-6 md:items-start">
        <section>
          <h2 className="text-slate-200 font-semibold text-sm mb-2">Últimas Movimentações</h2>
          {recent.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
              <p className="text-slate-500 text-sm">Nenhum lançamento neste período</p>
              <Link href="/lancamentos" className="text-violet-400 text-sm mt-2 inline-block">Lançar agora →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((exp) => {
                const cfg = CATEGORY_CONFIG[exp.category];
                const day = exp.date.slice(8, 10);
                const month = exp.date.slice(5, 7);
                const isIncome = exp.type === 'income';
                return (
                  <div key={exp.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${cfg.bgClass}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{exp.description}</p>
                      <p className="text-slate-500 text-xs">{exp.category} · {day}/{month}</p>
                    </div>
                    <span className={`font-semibold text-sm whitespace-nowrap ${isIncome ? 'text-green-400' : 'text-white'}`}>
                      {isIncome ? '+' : ''}{formatCurrency(exp.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-4 md:mt-0 space-y-4">
          {alerts.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-amber-400" />
                <h2 className="text-slate-200 font-semibold text-sm">Alertas de Desperdício</h2>
              </div>
              <div className="space-y-2">
                {alerts.map((alert) => {
                  const cfg = CATEGORY_CONFIG[alert.category];
                  return (
                    <div key={alert.category} className={`rounded-xl p-4 border ${cfg.bgClass} ${cfg.borderClass}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cfg.icon}</span>
                          <span className="text-white font-medium text-sm">{alert.category}</span>
                        </div>
                        <span className="text-red-400 font-bold text-sm">+{Math.round(alert.percentChange)}%</span>
                      </div>
                      <p className="text-slate-400 text-xs">{formatCurrency(alert.total)} gasto · média: {formatCurrency(alert.average)}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {budgetAlerts.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-violet-400" />
                <h2 className="text-slate-200 font-semibold text-sm">Alertas de Orçamento</h2>
              </div>
              <div className="space-y-2">
                {budgetAlerts.map((alert) => {
                  const cfg = CATEGORY_CONFIG[alert.category];
                  const barColor = alert.pct > 100 ? 'bg-red-500' : 'bg-yellow-500';
                  return (
                    <div key={alert.category} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cfg.icon}</span>
                          <span className="text-white font-medium text-sm">{alert.category}</span>
                        </div>
                        <span className={`font-bold text-sm ${alert.pct > 100 ? 'text-red-400' : 'text-yellow-400'}`}>{Math.round(alert.pct)}%</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                        <span>{formatCurrency(alert.total)} gasto</span>
                        <span>limite: {formatCurrency(alert.budget)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(alert.pct, 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Botão flutuante */}
      <Link
        href="/lancamentos"
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 w-14 h-14 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center shadow-xl shadow-violet-900/60 transition-colors z-40 md:hidden"
      >
        <Plus size={26} className="text-white" />
      </Link>

      {/* ── MODAL: Análise IA Completa ─────────────────────────────────────────── */}
      {showResumoModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowResumoModal(false); }}
        >
          <div className="bg-[#0f1117] border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star size={15} className="text-violet-400" />
                <p className="text-white font-semibold">Resumo da semana</p>
                <span className="text-[10px] text-violet-400/60 font-semibold uppercase tracking-wider">IA</span>
              </div>
              <button onClick={() => setShowResumoModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
                <X size={18} />
              </button>
            </div>

            {resumoLoading && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Gerando com IA…</span>
                </div>
                {[100, 90, 75, 85, 60].map((w, i) => (
                  <div key={i} className="h-2.5 bg-slate-800 rounded-full animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}

            {!resumoData && !resumoLoading && (
              <button
                onClick={() => loadResumo()}
                className="w-full flex items-center justify-center gap-2 bg-violet-600/15 hover:bg-violet-600/25 text-violet-300 hover:text-violet-200 text-sm font-medium py-2.5 rounded-xl transition-colors border border-violet-500/20"
              >
                ✨ Gerar resumo da semana
              </button>
            )}

            {resumoData && !resumoLoading && (
              <>
                <div
                  className="text-slate-300 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderBotText(resumoData.resumo) }}
                />
                <div className="flex items-center justify-between mt-4">
                  <p className="text-slate-600 text-[11px]">
                    Gerado em{' '}
                    {new Date(resumoData.geradoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                  <button
                    onClick={() => loadResumo(true)}
                    className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-800"
                    title="Atualizar"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </main>
  );
}
