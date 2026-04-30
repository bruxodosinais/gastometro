'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Loader2, Plus, RefreshCw, Star, X } from 'lucide-react';
import { getExpenses, getBudgets, getRecurringExpenses, getMonthlyPlan } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import {
  calculateTotalByType,
  formatCurrency,
  getMonthKey,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import { calculateStreak } from '@/lib/streak';
import PeriodSelector from '@/components/PeriodSelector';
import { Budget, Expense, EXPENSE_CATEGORIES, MonthlyPlan, RecurringExpense } from '@/lib/types';
import dynamic from 'next/dynamic';
import PlanningSection from '@/components/PlanningSection';

const SpendingDonut = dynamic(() => import('@/components/SpendingDonut'), { ssr: false });

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

// expanded animation properties — avoids shorthand + animationDelay conflict warning
function anim(delay: number, duration = 350): React.CSSProperties {
  return {
    animationName: 'block-fade-in',
    animationDuration: `${duration}ms`,
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
    animationDelay: `${delay}ms`,
  };
}
const hidden: React.CSSProperties = { opacity: 0, transform: 'translateY(12px)' };

export default function HomePage() {
  const { period } = usePeriod();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [newBadgeIds, setNewBadgeIds] = useState<Set<string>>(new Set());
  const [resumoData, setResumoData] = useState<ResumoData | null>(null);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [showResumoModal, setShowResumoModal] = useState(false);
  const [showMissoesModal, setShowMissoesModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showBellMenu, setShowBellMenu] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const bellMenuRef = useRef<HTMLDivElement>(null);
  const badgeEarnedRef = useRef({ b1: false, b2: false, b3: false, b4: false, b5: false, b6: false, b7: false, b8: false });
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [heroDisplayValue, setHeroDisplayValue] = useState(0);
  const rafRef = useRef<number>(0);

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
    const stored = localStorage.getItem('gastometro_badges_seen');
    const seen = new Set<string>(stored ? JSON.parse(stored) : []);
    const { b1, b2, b3, b4, b5, b6, b7, b8 } = badgeEarnedRef.current;
    const newOnes = (
      [['primeiro_mil', b1], ['guardiao', b2], ['tres_meses', b3], ['streak_mestre', b4],
       ['streak_15', b5], ['streak_30', b6], ['semana_controlada', b7], ['mes_perfeito', b8]] as [string, boolean][]
    ).filter(([id, earned]) => earned && !seen.has(id)).map(([id]) => id);
    if (newOnes.length > 0) {
      setNewBadgeIds(new Set(newOnes));
      localStorage.setItem('gastometro_badges_seen', JSON.stringify([...seen, ...newOnes]));
      setTimeout(() => setNewBadgeIds(new Set()), 3000);
    }
  }, [ready]);

  // trigger cascade animations after data loads
  useEffect(() => {
    if (ready) setMounted(true);
  }, [ready]);

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

  useEffect(() => {
    if (!ready || !mounted) return;
    const periodEntries = expenses.filter((e) => e.date.slice(0, 7) === period);
    const inc = calculateTotalByType(periodEntries, 'income');
    const sp = calculateTotalByType(periodEntries, 'expense');
    const now2 = new Date();
    const isCur = period === getMonthKey(now2);
    const [py, pm] = period.split('-').map(Number);
    const totalDays = new Date(py, pm, 0).getDate();
    const daysRem = isCur ? totalDays - now2.getDate() : 0;
    const heroBase2 = (monthlyPlan?.expectedIncome ?? 0) > 0 ? monthlyPlan!.expectedIncome : inc;
    const target = isCur && daysRem > 0 ? Math.abs((heroBase2 - sp) / daysRem) : 0;
    if (target === 0) { setHeroDisplayValue(0); return; }
    const duration = 600;
    const startTime = performance.now();
    function step(now3: number) {
      const t = Math.min((now3 - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      setHeroDisplayValue(target * eased);
      if (t < 1) { rafRef.current = requestAnimationFrame(step); }
      else { setHeroDisplayValue(target); }
    }
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, mounted, period, expenses, monthlyPlan]);

  useEffect(() => {
    if (!ready) return;
    setPhraseIndex(0);
    const id = setInterval(() => setPhraseIndex((i) => i + 1), 8000);
    return () => clearInterval(id);
  }, [ready, period]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
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
        const data: ResumoData = { resumo: json.resumo, geradoEm: json.geradoEm, cachedAt: Date.now() };
        setResumoData(data);
        try { localStorage.setItem(RESUMO_CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    finally { setResumoLoading(false); }
  }

  if (!ready) {
    return (
      <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-28 md:pb-10">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="skeleton h-7 w-44 rounded-lg mb-2" />
            <div className="skeleton h-4 w-28 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton w-10 h-10 rounded-2xl" />
            <div className="skeleton w-10 h-10 rounded-2xl" />
          </div>
        </div>
        <div className="skeleton h-4 w-52 rounded mb-6 mt-2" />
        <div className="mt-4 mb-3 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="skeleton h-3 w-28 rounded mb-4" />
          <div className="skeleton h-12 w-52 rounded mb-3" />
          <div className="skeleton h-4 w-40 rounded mb-5" />
          <div className="skeleton h-1.5 rounded-full mb-3" />
          <div className="flex justify-between">
            <div className="skeleton h-3 w-24 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
        </div>
        <div className="flex gap-3 mb-4">
          {[0, 1, 2].map((i) => <div key={i} className="flex-1 skeleton rounded-2xl h-20" />)}
        </div>
        <div className="mb-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="skeleton h-4 w-32 rounded mb-3" />
          {[100, 85, 92, 70].map((w, i) => (
            <div key={i} className="skeleton h-2.5 rounded mb-2" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="skeleton h-4 w-36 rounded mb-3" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 mb-3">
              <div className="skeleton w-8 h-8 rounded-xl flex-shrink-0" />
              <div className="flex-1">
                <div className="skeleton h-3 w-36 rounded mb-1.5" />
                <div className="skeleton h-2.5 w-24 rounded" />
              </div>
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ── Dados do período ─────────────────────────────────────────────────────────
  const periodEntries = expenses.filter((e) => e.date.slice(0, 7) === period);
  const income = calculateTotalByType(periodEntries, 'income');
  const spent = calculateTotalByType(periodEntries, 'expense');
  const balance = income - spent;
  const periodExpenses = periodEntries.filter((e) => e.type === 'expense');

  const budgetAlerts = budgets
    .map((b) => {
      const total = periodExpenses.filter((e) => e.category === b.category).reduce((s, e) => s + e.amount, 0);
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

  // ── Tempo ────────────────────────────────────────────────────────────────────
  const now = new Date();
  const isCurrentMonth = period === getMonthKey(now);
  const [periodYear, periodMonth] = period.split('-').map(Number);
  const totalDaysInMonth = new Date(periodYear, periodMonth, 0).getDate();
  const todayDay = isCurrentMonth ? now.getDate() : totalDaysInMonth;
  const daysRemaining = isCurrentMonth ? totalDaysInMonth - todayDay : 0;
  const dailyAvailable = isCurrentMonth && daysRemaining > 0 ? balance / daysRemaining : null;
  const streak = isCurrentMonth ? calculateStreak(expenses) : 0;

  // ── Missões ──────────────────────────────────────────────────────────────────
  const deliveryDates = new Set(expenses.filter((e) => e.category === 'Delivery').map((e) => e.date));
  let deliveryFreeStreak = 0;
  {
    const cursor = new Date(now);
    while (deliveryFreeStreak < 3) {
      const ds = [cursor.getFullYear(), String(cursor.getMonth() + 1).padStart(2, '0'), String(cursor.getDate()).padStart(2, '0')].join('-');
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

  const missoesEmAndamento = [!m1Done, !m2Done, !m3Done].filter(Boolean).length;
  const missaoPrincipal: { label: string; pct: number } | null =
    !m1Done ? { label: '🛵 3 dias sem delivery', pct: m1Pct }
    : !m2Done ? { label: '🎯 Semana abaixo da meta', pct: m2OverBudget ? 1 : 0 }
    : !m3Done ? { label: '📅 Lançar tudo por 5 dias', pct: m3Pct }
    : null;

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
  const badge5Earned = streak >= 15;
  const badge6Earned = streak >= 30;
  const dailyAvgBudget = totalBudget > 0 ? totalBudget / 30 : income > 0 ? income / 30 : 0;
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  const sevenDaysAgoStr = fmtD(sevenDaysAgo);
  const last7DaysSpent = expenses
    .filter((e) => e.type === 'expense' && e.date >= sevenDaysAgoStr && e.date <= fmtD(now))
    .reduce((s, e) => s + e.amount, 0);
  const badge7Earned = dailyAvgBudget > 0 && last7DaysSpent < dailyAvgBudget * 7;
  const badge8Earned = balance > 0 && !!monthlyPlan && monthlyPlan.savingsGoal > 0 && balance >= monthlyPlan.savingsGoal;
  badgeEarnedRef.current = { b1: badge1Earned, b2: badge2Earned, b3: badge3Earned, b4: badge4Earned, b5: badge5Earned, b6: badge6Earned, b7: badge7Earned, b8: badge8Earned };

  const badges = [
    { id: 'primeiro_mil', icon: '🥉', name: 'Primeiro Mil', desc: 'Economizou R$1.000 em um mês', earned: badge1Earned, bg: 'bg-amber-700/20', border: 'border-amber-700/40', text: 'text-amber-600' },
    { id: 'guardiao', icon: '🥈', name: 'Guardião', desc: 'Economizou R$5.000 em um mês', earned: badge2Earned, bg: 'bg-slate-300/20', border: 'border-slate-300/40', text: 'text-slate-300' },
    { id: 'tres_meses', icon: '🥇', name: '3 Meses Positivos', desc: 'Saldo positivo por 3 meses seguidos', earned: badge3Earned, bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-500' },
    { id: 'streak_mestre', icon: '🔥', name: 'Streak Mestre', desc: '7 dias seguidos registrando', earned: badge4Earned, bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' },
    { id: 'streak_15', icon: '🔥', name: 'Streak 15 dias', desc: '15 dias consecutivos com lançamentos', earned: badge5Earned, bg: 'bg-orange-600/20', border: 'border-orange-500/40', text: 'text-orange-300' },
    { id: 'streak_30', icon: '🏆', name: 'Streak 30 dias', desc: '30 dias consecutivos com lançamentos', earned: badge6Earned, bg: 'bg-yellow-500/15', border: 'border-yellow-400/30', text: 'text-yellow-400' },
    { id: 'semana_controlada', icon: '💚', name: 'Semana Controlada', desc: '7 dias abaixo da média diária de gastos', earned: badge7Earned, bg: 'bg-green-500/15', border: 'border-green-500/30', text: 'text-green-400' },
    { id: 'mes_perfeito', icon: '🌟', name: 'Mês Perfeito', desc: 'Saldo positivo e meta de poupança atingida', earned: badge8Earned, bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-400' },
  ] as const;

  // ── V2: Header ───────────────────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const currentMonthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // ── V2: Hero Card ────────────────────────────────────────────────────────────
  const heroBase = (monthlyPlan?.expectedIncome ?? 0) > 0 ? monthlyPlan!.expectedIncome : income;
  const canSpendToday = isCurrentMonth && daysRemaining > 0 ? (heroBase - spent) / daysRemaining : null;
  const budgetPct = heroBase > 0 ? Math.min((spent / heroBase) * 100, 100) : 0;
  const heroStatus: 'excellent' | 'ok' | 'warning' = budgetPct < 60 ? 'excellent' : budgetPct < 85 ? 'ok' : 'warning';
  const heroStatusLabel = heroStatus === 'excellent' ? 'Excelente controle' : heroStatus === 'ok' ? 'Dentro do plano' : 'Atenção ao ritmo';
  const heroStatusColor = heroStatus === 'excellent' ? 'text-emerald-400' : heroStatus === 'ok' ? 'text-yellow-400' : 'text-red-400';
  const heroBarColor = heroStatus === 'excellent' ? 'bg-violet-500' : heroStatus === 'ok' ? 'bg-yellow-500' : 'bg-red-500';

  // ── Frases dinâmicas ─────────────────────────────────────────────────────────
  const POSITIVE_PHRASES = ['Você está no controle 💚', 'Excelente ritmo esse mês', `${currentMonthLabel} melhor que o esperado`];
  const MEDIUM_PHRASES = ['Ainda dá pra ajustar 🎯', 'Fique atento ao ritmo', 'Metade do mês, metade do orçamento'];
  const CRITICAL_PHRASES = ['Você está acelerando demais ⚠️', 'Risco de estourar o orçamento', 'Revise seus gastos hoje'];
  const dynamicPhrases = !isCurrentMonth
    ? ['Cada lançamento conta. Continue.']
    : budgetPct < 50 ? POSITIVE_PHRASES
    : budgetPct < 80 ? MEDIUM_PHRASES
    : CRITICAL_PHRASES;
  const dynamicPhrase = dynamicPhrases[phraseIndex % dynamicPhrases.length];

  // ── V2: Resumo IA bullets ────────────────────────────────────────────────────
  const categoryTotals = EXPENSE_CATEGORIES.map((cat) => ({
    cat,
    total: periodExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const topCat = categoryTotals[0];

  const compactBullets = [
    balance >= 0 ? `Superávit de ${formatCurrency(balance)} no mês` : `Déficit de ${formatCurrency(Math.abs(balance))} no mês`,
    topCat ? `Maior gasto: ${topCat.cat} (${formatCurrency(topCat.total)})` : 'Nenhum gasto registrado ainda',
    monthlyPlan && monthlyPlan.savingsGoal > 0
      ? balance >= monthlyPlan.savingsGoal
        ? `Meta de poupança atingida ✓ (${formatCurrency(monthlyPlan.savingsGoal)})`
        : `Meta: ${formatCurrency(monthlyPlan.savingsGoal)} · faltam ${formatCurrency(Math.max(monthlyPlan.savingsGoal - balance, 0))}`
      : 'Meta de poupança não definida',
    streak >= 2 ? `${streak} dias seguidos com lançamentos 🔥` : streak === 1 ? '1 dia de registro — continue amanhã' : 'Sem streak ativo — registre algo hoje',
  ];

  // ── V2: Alertas Inteligentes ─────────────────────────────────────────────────
  interface NewAlert { emoji: string; text: string; priority: number; }
  const newAlerts: NewAlert[] = [];
  if (isCurrentMonth) {
    for (const b of budgetAlerts.slice(0, 2)) {
      newAlerts.push({ emoji: '⚠️', text: `${b.category} perto do limite (${Math.round(b.pct)}%)`, priority: b.pct });
    }
    for (const rec of recurringExpenses) {
      if (!rec.active || rec.type !== 'expense') continue;
      const hasEntry = periodEntries.some((e) => e.recurringExpenseId === rec.id);
      if (hasEntry) continue;
      const dayDiff = rec.dayOfMonth - now.getDate();
      if (dayDiff >= 0 && dayDiff <= 3) {
        newAlerts.push({ emoji: '💡', text: `${rec.description} renova em breve`, priority: 90 - dayDiff * 5 });
      }
    }
    if (monthlyPlan && monthlyPlan.expectedIncome > 0 && income < monthlyPlan.expectedIncome) {
      newAlerts.push({ emoji: '📉', text: 'Receita abaixo do previsto', priority: 50 });
    }
  }
  const topNewAlerts = [...newAlerts].sort((a, b) => b.priority - a.priority).slice(0, 2);

  // ── Urgência da missão principal ─────────────────────────────────────────────
  const missaoUrgencia = !isCurrentMonth || !missaoPrincipal
    ? null
    : streak >= 3
    ? `⚡ Se falhar hoje, perde o streak de ${streak} dias`
    : streak >= 1
    ? '💪 Continue, você está quase lá'
    : '🔄 Recomece hoje — um registro já conta';

  return (
    <main className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 pt-8 pb-28 md:pb-10" style={{ animation: 'fade-in 200ms ease-out both' }}>

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
                <button onClick={() => setShowAvatarMenu(false)} className="w-full text-left px-4 py-3 text-slate-300 text-sm hover:bg-slate-800 transition-colors">
                  Perfil
                </button>
                <div className="border-t border-slate-800" />
                <button onClick={() => { setShowAvatarMenu(false); handleLogout(); }} className="w-full text-left px-4 py-3 text-red-400 text-sm hover:bg-slate-800 transition-colors">
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-violet-300/70 text-sm italic mb-4">{dynamicPhrase}</p>

      {/* ── SELETOR DE PERÍODO ─────────────────────────────────────────────────── */}
      <PeriodSelector />

      {/* ── HERO CARD ──────────────────────────────────────────────────────────── */}
      {isCurrentMonth && (
        <div
          className="mt-4 mb-3 bg-gradient-to-br from-violet-600/20 via-violet-500/10 to-transparent border border-violet-500/30 rounded-2xl p-6"
          style={mounted ? anim(0, 600) : hidden}
        >
          <p className="text-violet-300/70 text-xs font-medium uppercase tracking-wider mb-3">Pode gastar hoje</p>

          {daysRemaining > 0 && canSpendToday !== null ? (
            <>
              <p className={`text-5xl font-bold leading-none mb-2 ${canSpendToday < 0 ? 'text-red-400' : 'text-violet-200'}`}>
                {canSpendToday < 0 ? '−' : ''}{formatCurrency(heroDisplayValue)}
              </p>
              <p className="text-slate-400 text-sm mb-4">
                {canSpendToday < 0 ? 'saldo esgotado' : `${daysRemaining} ${daysRemaining === 1 ? 'dia restante' : 'dias restantes'} no mês`}
              </p>
              <div className="h-1.5 bg-slate-800/80 rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${heroBarColor}`} style={{ width: mounted ? `${budgetPct}%` : '0%', transition: 'width 500ms ease-out' }} />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${heroStatusColor}`}>{heroStatusLabel}</span>
                <span className="text-slate-500 text-xs">{Math.round(budgetPct)}% do orçamento</span>
              </div>
            </>
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

          <Link href="/lancamentos" className="mt-4 hidden md:block text-center bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            + Lançar gasto
          </Link>
        </div>
      )}

      {/* ── MINI CARDS: Saldo / Gastos / Receitas ──────────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 mb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible md:snap-none md:mx-0 md:px-0 md:pb-0 md:mb-3">
        <div className={`snap-start flex-shrink-0 w-[78vw] md:w-auto rounded-2xl p-4 border ${balance >= 0 ? 'bg-blue-500/5 border-blue-500/15' : 'bg-red-500/5 border-red-500/15'}`} style={mounted ? anim(100) : hidden}>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Saldo atual</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
            {balance >= 0 ? '' : '−'}{formatCurrency(Math.abs(balance))}
          </p>
          <p className="text-slate-500 text-xs mt-1">receitas − gastos</p>
        </div>
        <div className="snap-start flex-shrink-0 w-[78vw] md:w-auto bg-red-500/5 border border-red-500/15 rounded-2xl p-4" style={mounted ? anim(180) : hidden}>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Gastos do mês</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(spent)}</p>
          <p className="text-slate-500 text-xs mt-1">despesas lançadas</p>
        </div>
        <div className="snap-start flex-shrink-0 w-[78vw] md:w-auto bg-green-500/5 border border-green-500/15 rounded-2xl p-4 pr-4 md:pr-4" style={mounted ? anim(260) : hidden}>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Receitas</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(income)}</p>
          <p className="text-slate-500 text-xs mt-1">entradas do mês</p>
        </div>
      </div>
      {/* indicador de scroll nos mini cards — mobile only */}
      <div className="flex justify-center gap-1 mb-3 md:hidden">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`w-1 h-1 rounded-full ${i === 0 ? 'bg-violet-400/60' : 'bg-slate-700'}`} />
        ))}
      </div>

      {/* ── RESUMO IA COMPACTO ─────────────────────────────────────────────────── */}
      <div className="mb-3 bg-slate-900 border border-white/[0.06] rounded-2xl p-3" style={mounted ? anim(180) : hidden}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star size={13} className="text-violet-400" />
            <p className="text-slate-300 font-medium text-sm">Resumo do mês</p>
            <span className="text-[10px] text-violet-400/50 font-semibold uppercase tracking-wider">IA</span>
          </div>
          <button
            onClick={() => { setShowResumoModal(true); if (!resumoData) loadResumo(); }}
            className="text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors"
          >
            Ver análise →
          </button>
        </div>
        <ul className="space-y-1.5">
          {compactBullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="text-violet-400/40 mt-0.5 flex-shrink-0">•</span>
              <span className="text-slate-400">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── ALERTAS INTELIGENTES ───────────────────────────────────────────────── */}
      <div className="mb-5 bg-slate-900 border border-white/[0.06] rounded-2xl p-4" style={mounted ? anim(240) : hidden}>
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

      {/* ── GRÁFICO DE CATEGORIAS ──────────────────────────────────────────────── */}
      <div className="mb-5 bg-slate-900 border border-slate-800 rounded-2xl p-5" style={mounted ? anim(300) : hidden}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-slate-200 font-semibold text-sm">Gastos por Categoria</h2>
          {topCat && spent > 0 && (
            <span className="text-xs text-slate-500">{Math.round((topCat.total / spent) * 100)}% em {topCat.cat}</span>
          )}
        </div>

        {topCat && (
          <div className="flex items-center gap-2.5 mb-4 px-3 py-2.5 bg-violet-500/10 border border-violet-500/20 rounded-xl">
            <span className="text-slate-400 text-[10px] font-medium uppercase tracking-wider flex-shrink-0">Maior gasto</span>
            <span className="text-base leading-none">{CATEGORY_CONFIG[topCat.cat]?.icon}</span>
            <span className="text-white font-semibold text-sm">{topCat.cat}</span>
            <span className="ml-auto text-violet-300 font-bold text-sm whitespace-nowrap">{formatCurrency(topCat.total)}</span>
            {spent > 0 && (
              <span className="text-slate-400 text-xs whitespace-nowrap">{Math.round((topCat.total / spent) * 100)}%</span>
            )}
          </div>
        )}

        <SpendingDonut entries={periodEntries} />

        {topCat && spent > 0 && (() => {
          const pct = Math.round((topCat.total / spent) * 100);
          const msg = pct > 40
            ? `${topCat.cat} está acima do ideal (${pct}%) — considere reduzir`
            : pct >= 25
            ? `${topCat.cat} representa ${pct}% dos gastos — maior categoria`
            : 'Gastos bem distribuídos — nenhuma categoria domina';
          return <p className="mt-3 text-center text-xs text-slate-500/80">{msg}</p>;
        })()}
      </div>

      {/* ── ÚLTIMAS MOVIMENTAÇÕES ──────────────────────────────────────────────── */}
      <div className="mb-5 bg-slate-900 border border-slate-800 rounded-2xl p-4" style={mounted ? anim(380) : hidden}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold text-sm">Últimas movimentações</h2>
          <Link href="/historico" className="text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors">
            Ver tudo →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-slate-500 text-sm">Nenhum lançamento neste período</p>
            <Link href="/lancamentos" className="text-violet-400 text-sm mt-2 inline-block">Lançar agora →</Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {recent.map((exp, idx) => {
                const cfg = CATEGORY_CONFIG[exp.category];
                const isIncome = exp.type === 'income';
                const day = exp.date.slice(8, 10);
                const month = exp.date.slice(5, 7);
                return (
                  <div key={exp.id} className="flex items-center gap-3" style={mounted ? anim(380 + idx * 60) : hidden}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${cfg.bgClass}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{exp.description}</p>
                      <p className="text-slate-500 text-xs">{exp.category} · {day}/{month}</p>
                    </div>
                    <span className={`font-semibold text-sm whitespace-nowrap ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                      {isIncome ? '+' : '−'}{formatCurrency(exp.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800">
              <Link href="/historico" className="block text-center text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors">
                Ver histórico completo →
              </Link>
            </div>
          </>
        )}
      </div>

      {/* ── MISSÕES COMPACTADAS + CONQUISTAS (mês atual) ───────────────────────── */}
      {isCurrentMonth && (
        <>
          {/* Missões compactas */}
          <div className="mb-3 bg-slate-900 border border-white/[0.06] rounded-2xl p-4" style={mounted ? anim(440) : hidden}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold text-sm">Missões</p>
              <button
                onClick={() => setShowMissoesModal(true)}
                className="text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors"
              >
                Ver missões →
              </button>
            </div>

            <div className="flex items-center gap-5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">{streak >= 2 ? '🔥' : streak === 1 ? '✨' : '💡'}</span>
                <div>
                  <p className="text-white text-sm font-semibold">{streak} {streak === 1 ? 'dia' : 'dias'}</p>
                  <p className="text-slate-500 text-xs">streak</p>
                </div>
              </div>
              <div className="w-px h-8 bg-slate-800 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold">{missoesEmAndamento}</p>
                <p className="text-slate-500 text-xs">em andamento</p>
              </div>
              <div className="w-px h-8 bg-slate-800 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-semibold">{3 - missoesEmAndamento}/3</p>
                <p className="text-slate-500 text-xs">concluídas</p>
              </div>
            </div>

            {missaoPrincipal ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-400 text-xs">{missaoPrincipal.label}</span>
                  <span className="text-slate-400 text-xs">{Math.round(missaoPrincipal.pct * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500" style={{ width: mounted ? `${missaoPrincipal.pct * 100}%` : '0%', transition: 'width 400ms cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                </div>
                {missaoUrgencia && (
                  <p className="mt-2 text-xs text-slate-500">{missaoUrgencia}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-1">
                <span className="text-green-400 text-sm">✅</span>
                <span className="text-green-400 text-sm font-medium">Todas as missões concluídas!</span>
              </div>
            )}
          </div>

          {/* Conquistas — scroll horizontal */}
          <div className="mb-5 bg-slate-900 border border-white/[0.06] rounded-2xl p-4" style={mounted ? anim(500) : hidden}>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Conquistas</p>
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="flex gap-3 pb-1" style={{ minWidth: 'max-content' }}>
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`w-28 flex-shrink-0 rounded-xl p-3 border ${badge.earned ? `${badge.bg} ${badge.border} badge-glow` : 'bg-slate-800/50 border-slate-700/50'} ${newBadgeIds.has(badge.id) ? 'animate-pulse' : ''}`}
                  >
                    <span className={`text-2xl leading-none block mb-1.5 ${badge.earned ? '' : 'grayscale opacity-30'}`}>{badge.icon}</span>
                    <p className={`font-semibold text-xs leading-tight ${badge.earned ? 'text-white' : 'text-slate-600'}`}>{badge.name}</p>
                    <p className={`text-[10px] mt-0.5 leading-tight ${badge.earned ? badge.text : 'text-slate-600'}`}>
                      {badge.earned ? 'Desbloqueada' : 'Bloqueada'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── PLANEJAMENTO MENSAL ────────────────────────────────────────────────── */}
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

      {/* ── CTA FIXO MOBILE ────────────────────────────────────────────────────── */}
      <Link
        href="/lancamentos"
        className="fixed bottom-20 right-4 md:hidden flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm pl-4 pr-5 h-12 rounded-full shadow-xl shadow-violet-900/60 transition-colors z-40"
      >
        <Plus size={18} />
        Lançar
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
                <div className="text-slate-300 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderBotText(resumoData.resumo) }} />
                <div className="flex items-center justify-between mt-4">
                  <p className="text-slate-600 text-[11px]">
                    Gerado em {new Date(resumoData.geradoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
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

      {/* ── MODAL: Missões da semana ───────────────────────────────────────────── */}
      {showMissoesModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMissoesModal(false); }}
        >
          <div className="bg-[#0f1117] border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <p className="text-white font-semibold">Missões da semana</p>
              <button onClick={() => setShowMissoesModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors p-1">
                <X size={18} />
              </button>
            </div>

            {/* Streak no modal */}
            <div className={`rounded-xl p-3 border mb-5 flex items-center gap-3 ${
              streak >= 3 ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30' : 'bg-slate-900 border-slate-800'
            }`}>
              <span className="text-2xl leading-none">{streak >= 2 ? '🔥' : streak === 1 ? '✨' : '💡'}</span>
              <div>
                {streak >= 2 ? <p className="text-white font-semibold text-sm">{streak} dias seguidos registrando</p>
                  : streak === 1 ? <p className="text-white font-semibold text-sm">Começou hoje! Continue amanhã</p>
                  : <p className="text-slate-400 text-sm">Registre algo hoje para começar seu streak</p>}
                {streak >= 2 && <p className="text-slate-500 text-xs mt-0.5">Não perca o ritmo!</p>}
              </div>
            </div>

            <div className="space-y-5">
              {/* Missão 1 */}
              <div>
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="text-base leading-none mt-0.5">🛵</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white text-sm font-medium">3 dias sem delivery</p>
                      {m1Done
                        ? <span className="text-green-400 text-xs font-semibold flex-shrink-0">✅ Feito</span>
                        : <span className="text-slate-400 text-xs flex-shrink-0">{deliveryFreeStreak}/3</span>}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {m1Done ? '3+ dias sem pedir delivery!'
                        : deliveryFreeStreak === 0 ? 'Teve delivery hoje ou ontem'
                        : `${deliveryFreeStreak} dia${deliveryFreeStreak > 1 ? 's' : ''} sem delivery — continue!`}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m1Done ? 'bg-green-500' : 'bg-violet-500'}`} style={{ width: `${Math.round(m1Pct * 100)}%` }} />
                </div>
              </div>

              <div className="border-t border-slate-800" />

              {/* Missão 2 */}
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
                        : <span className="text-slate-400 text-xs flex-shrink-0">—</span>}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {weeklyRef === 0 ? 'Defina orçamento ou registre receita'
                        : m2Done ? `Dentro da meta — sobra ${formatCurrency(weeklyRef - weekSpent)}`
                        : `${formatCurrency(weekSpent)} gasto · meta ${formatCurrency(weeklyRef)}`}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m2Done ? 'bg-green-500' : m2OverBudget ? 'bg-red-500' : 'bg-slate-700'}`} style={{ width: m2Done || m2OverBudget ? '100%' : '0%' }} />
                </div>
              </div>

              <div className="border-t border-slate-800" />

              {/* Missão 3 */}
              <div>
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="text-base leading-none mt-0.5">📅</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-white text-sm font-medium">Lançar tudo por 5 dias</p>
                      {m3Done
                        ? <span className="text-green-400 text-xs font-semibold flex-shrink-0">✅ Feito</span>
                        : <span className="text-slate-400 text-xs flex-shrink-0">{streak}/5</span>}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {m3Done ? '5+ dias seguidos registrando!'
                        : streak === 0 ? 'Registre algo hoje para começar'
                        : `${streak} dia${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''} — faltam ${5 - streak}`}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m3Done ? 'bg-green-500' : 'bg-violet-500'}`} style={{ width: `${Math.round(m3Pct * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
