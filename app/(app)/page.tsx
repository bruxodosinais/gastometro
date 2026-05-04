'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, Loader2, Plus, RefreshCw, Star, X } from 'lucide-react';
import {
  getExpenses,
  getBudgets,
  getRecurringExpenses,
  getMonthlyPlan,
  getMonthlyObligations,
  checkAndGenerateObligations,
  markObligationAsPaid,
  getAllGoalContributions,
} from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import {
  calculateTotalByType,
  formatCurrency,
  formatCompact,
  getMonthKey,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import { calculateStreak } from '@/lib/streak';
import PeriodSelector from '@/components/PeriodSelector';
import { Budget, Category, Expense, EXPENSE_CATEGORIES, GoalContribution, MonthlyObligation, MonthlyPlan, RecurringExpense } from '@/lib/types';
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

// Exibe valor completo; só aplica formato compacto se o texto transbordar o card.
function AutoValue({ value, className = '', style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    setCompact(false);
  }, [value]);

  useLayoutEffect(() => {
    if (compact) return;
    const el = ref.current;
    if (el && el.scrollWidth > el.clientWidth) setCompact(true);
  });

  return (
    <p ref={ref} className={`whitespace-nowrap overflow-hidden ${className}`} style={style}>
      {compact ? formatCompact(value) : formatCurrency(value)}
    </p>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { period } = usePeriod();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [obligations, setObligations] = useState<MonthlyObligation[]>([]);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
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
  const [userName, setUserName] = useState('');
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    Promise.all([
      getExpenses(),
      getBudgets(),
      getRecurringExpenses(),
      checkAndGenerateObligations().then(() => getMonthlyObligations(currentMonth)),
      getAllGoalContributions(),
    ]).then(([exp, bud, rec, obs, contrib]) => {
      setExpenses(exp);
      setBudgets(bud);
      setRecurringExpenses(rec);
      setObligations(obs);
      setContributions(contrib);
      setReady(true);
    });

    // Recarrega obrigações e expenses quando o usuário volta para esta aba
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const month = new Date().toISOString().slice(0, 7);
        Promise.all([getMonthlyObligations(month), getExpenses()]).then(([obs, exp]) => {
          setObligations(obs);
          setExpenses(exp);
        });
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    createClient().auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata as Record<string, string> | undefined;
      const name =
        meta?.display_name ||
        meta?.full_name?.split(' ')[0] ||
        meta?.name?.split(' ')[0] ||
        u.email?.split('@')[0] ||
        '';
      setUserName(name.charAt(0).toUpperCase() + name.slice(1));
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
    const savingsGoal2 = monthlyPlan?.savingsGoal ?? 0;
    const daysForLimit2 = isCur ? totalDays - now2.getDate() + 1 : 0;
    const valorLivre2 = inc - sp - savingsGoal2;
    const target = isCur && valorLivre2 > 0 ? valorLivre2 / Math.max(daysForLimit2, 1) : 0;
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

  useEffect(() => {
    if (showResumoModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showResumoModal]);

  async function handleMarkObligationPaid(obligationId: string) {
    const ob = obligations.find((o) => o.id === obligationId);
    if (!ob || payingIds.has(obligationId)) return;
    setPayingIds((prev) => new Set([...prev, obligationId]));
    setObligations((prev) =>
      prev.map((o) => (o.id === obligationId ? { ...o, status: 'paid' as const } : o))
    );
    try {
      const { expense } = await markObligationAsPaid(obligationId, ob);
      setExpenses((prev) => [expense, ...prev]);
    } catch {
      setObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? { ...o, status: 'pending' as const } : o))
      );
    } finally {
      setPayingIds((prev) => { const next = new Set(prev); next.delete(obligationId); return next; });
    }
  }

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
        <div className="mt-4 mb-3 bg-white border border-gray-100 rounded-2xl p-6">
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
        <div className="mb-3 bg-white border border-gray-100 rounded-2xl p-4">
          <div className="skeleton h-4 w-32 rounded mb-3" />
          {[100, 85, 92, 70].map((w, i) => (
            <div key={i} className="skeleton h-2.5 rounded mb-2" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
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

  // ── Obrigações do mês ────────────────────────────────────────────────────────
  const pendingObligations = obligations.filter((o) => o.status === 'pending');
  const pendingTotal = pendingObligations.reduce((s, o) => s + o.amount, 0);

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
    { id: 'guardiao', icon: '🥈', name: 'Guardião', desc: 'Economizou R$5.000 em um mês', earned: badge2Earned, bg: 'bg-slate-300/20', border: 'border-slate-300/40', text: 'text-gray-700' },
    { id: 'tres_meses', icon: '🥇', name: '3 Meses Positivos', desc: 'Saldo positivo por 3 meses seguidos', earned: badge3Earned, bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-500' },
    { id: 'streak_mestre', icon: '🔥', name: 'Streak Mestre', desc: '7 dias seguidos registrando', earned: badge4Earned, bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400' },
    { id: 'streak_15', icon: '🔥', name: 'Streak 15 dias', desc: '15 dias consecutivos com lançamentos', earned: badge5Earned, bg: 'bg-orange-600/20', border: 'border-orange-500/40', text: 'text-orange-300' },
    { id: 'streak_30', icon: '🏆', name: 'Streak 30 dias', desc: '30 dias consecutivos com lançamentos', earned: badge6Earned, bg: 'bg-yellow-500/15', border: 'border-yellow-400/30', text: 'text-yellow-400' },
    { id: 'semana_controlada', icon: '💚', name: 'Semana Controlada', desc: '7 dias abaixo da média diária de gastos', earned: badge7Earned, bg: 'bg-mint-50', border: 'border-green-500/30', text: 'text-mint-500' },
    { id: 'mes_perfeito', icon: '🌟', name: 'Mês Perfeito', desc: 'Saldo positivo e meta de poupança atingida', earned: badge8Earned, bg: 'bg-mint-50', border: 'border-mint-500/30', text: 'text-mint-500' },
  ] as const;

  // ── V2: Header ───────────────────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const currentMonthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // ── V2: Hero Card ────────────────────────────────────────────────────────────
  const heroBase = (monthlyPlan?.expectedIncome ?? 0) > 0 ? monthlyPlan!.expectedIncome : income;
  const savingsGoal = monthlyPlan?.savingsGoal ?? 0;
  const daysForLimit = isCurrentMonth ? totalDaysInMonth - todayDay + 1 : 0;
  const valorLivreParaGastar = balance - savingsGoal;
  const canSpendToday = isCurrentMonth ? (valorLivreParaGastar > 0 ? valorLivreParaGastar / Math.max(daysForLimit, 1) : 0) : null;
  const valorLivreParaGastarPlanejado = heroBase - fixedCosts - savingsGoal;
  const budgetPctBase = valorLivreParaGastarPlanejado > 0 ? valorLivreParaGastarPlanejado : heroBase;
  const budgetPctFallback = valorLivreParaGastarPlanejado <= 0;
  const budgetPct = budgetPctBase > 0 ? Math.min((spent / budgetPctBase) * 100, 100) : 0;
  const heroStatus: 'excellent' | 'ok' | 'warning' = budgetPct < 60 ? 'excellent' : budgetPct < 85 ? 'ok' : 'warning';
  const heroStatusLabel = valorLivreParaGastar < 0 ? 'Orçamento estourado' : heroStatus === 'excellent' ? 'Excelente controle' : heroStatus === 'ok' ? 'Dentro do plano' : 'Atenção ao ritmo';
  const heroStatusColor = valorLivreParaGastar < 0 ? 'text-white/70' : heroStatus === 'excellent' ? 'text-white/90' : heroStatus === 'ok' ? 'text-white/80' : 'text-white/70';
  const heroBarColor = 'bg-white/90';

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
          <h1 className="text-2xl font-bold text-gray-900">{greeting}{userName ? `, ${userName}` : ''}</h1>
          <p className="text-gray-700 font-medium text-sm capitalize">{currentMonthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div ref={bellMenuRef} className="relative">
            <button
              title="Notificações"
              onClick={() => setShowBellMenu((v) => !v)}
              className="w-10 h-10 rounded-2xl bg-warning-50 border border-warning/20 flex items-center justify-center transition-colors"
              style={{ color: '#ffaa33' }}
            >
              <Bell size={16} />
            </button>
            {showBellMenu && (
              <div className="absolute right-0 top-12 w-48 bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 z-50">
                <p className="text-gray-500 text-sm">🔔 Notificações em breve</p>
              </div>
            )}
          </div>
          <div ref={avatarMenuRef} className="relative">
            <button
              onClick={() => setShowAvatarMenu((v) => !v)}
              title="Menu do perfil"
              className="w-10 h-10 rounded-2xl bg-mint-50 border border-mint-500/40 flex items-center justify-center text-mint-500 font-bold text-sm hover:bg-mint/30 transition-colors"
            >
              {userName ? userName.charAt(0).toUpperCase() : '?'}
            </button>
            {showAvatarMenu && (
              <div className="absolute right-0 top-12 w-40 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                <button onClick={() => { setShowAvatarMenu(false); router.push('/perfil'); }} className="w-full text-left px-4 py-3 text-gray-700 text-sm hover:bg-gray-50 transition-colors">
                  Perfil
                </button>
                <div className="border-t border-gray-100" />
                <button onClick={() => { setShowAvatarMenu(false); handleLogout(); }} className="w-full text-left px-4 py-3 text-red-400 text-sm hover:bg-gray-50 transition-colors">
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-mint-700 text-sm font-medium italic mb-4">{dynamicPhrase}</p>

      {/* ── SELETOR DE PERÍODO ─────────────────────────────────────────────────── */}
      <div className="flex justify-end mb-3">
        <PeriodSelector compact />
      </div>

      {/* ── RESUMO CARDS (1 + 2) ────────────────────────────────────────────────── */}
      <div className="mb-3 space-y-2" style={mounted ? anim(0, 400) : hidden}>
        {/* Saldo — card largo, destaque principal */}
        <div className={`rounded-2xl p-4 border ${balance >= 0 ? '' : 'bg-negative-50 border-negative/20'}`}
          style={balance >= 0 ? { background: '#f0fdf8', border: '1px solid #d4f5e9' } : undefined}>
          <p className="text-gray-700 text-xs font-semibold uppercase tracking-wider mb-1">Saldo</p>
          <AutoValue value={balance} className="text-3xl font-bold leading-none" style={{ color: balance >= 0 ? '#00b87a' : '#f04e5e' }} />
          <p className="text-gray-600 text-xs mt-1 font-medium">receitas − gastos</p>
        </div>
        {/* Receitas + Despesas — 2 cards lado a lado */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-4" style={{ background: '#f0fdf8' }}>
            <p className="text-gray-700 text-xs font-semibold uppercase tracking-wider mb-1">Receitas</p>
            <AutoValue value={income} className="text-xl font-bold leading-none" style={{ color: '#00b87a' }} />
            <p className="text-gray-600 text-xs mt-1 font-medium">entradas do mês</p>
          </div>
          <div className="rounded-2xl p-4 border" style={{ background: '#fff0f2', borderColor: '#fdd0d5' }}>
            <p className="text-gray-700 text-xs font-semibold uppercase tracking-wider mb-1">Despesas</p>
            <AutoValue value={spent} className="text-xl font-bold leading-none" style={{ color: '#f04e5e' }} />
            <p className="text-gray-600 text-xs mt-1 font-medium">lançadas</p>
          </div>
        </div>
      </div>

      {/* ── ALERTA DE CONTAS PENDENTES ─────────────────────────────────────────── */}
      {isCurrentMonth && pendingObligations.length > 0 && (
        <div
          className="mb-3 rounded-2xl p-3.5 flex items-center gap-3 cursor-pointer transition-colors"
          style={{ background: '#fff6e0', border: '1px solid rgba(255,170,51,0.4)', ...(mounted ? anim(50) : hidden) }}
          onClick={() => document.getElementById('contas-do-mes')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="text-lg leading-none flex-shrink-0">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: '#ffaa33' }}>
              {formatCurrency(pendingTotal)} em contas pendentes
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,170,51,0.7)' }}>
              {pendingObligations.length} conta{pendingObligations.length > 1 ? 's' : ''} para confirmar pagamento
            </p>
          </div>
          <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,170,51,0.6)' }}>↓ ver</span>
        </div>
      )}

      {/* ── LIMITE DE HOJE ──────────────────────────────────────────────────────── */}
      {isCurrentMonth && (
        <div
          className="mb-3 rounded-2xl p-4"
          style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)', ...(mounted ? anim(80, 500) : hidden) }}
        >
          {todayDay === 1 && spent === 0 ? (
            <div>
              <p className="text-white font-semibold mb-1">Mês novo!</p>
              <p className="text-white/80 text-sm mb-3">Configure seu orçamento para começar com controle.</p>
              <a href="#planejamento" className="inline-block bg-white/20 hover:bg-white/30 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-colors">
                Configurar orçamento
              </a>
            </div>
          ) : canSpendToday !== null && (
            <>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <p className="text-white/70 text-[10px] font-medium uppercase tracking-wider mb-0.5">Limite de hoje</p>
                  {canSpendToday >= 0 ? (
                    <p className="text-2xl font-bold text-white leading-none">{formatCurrency(heroDisplayValue)}</p>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-white/80 leading-snug">Limite do dia atingido</p>
                      <p className="text-white/60 text-xs">−{formatCurrency(Math.abs(canSpendToday))}</p>
                    </>
                  )}
                </div>
                <div className="text-center shrink-0">
                  <p className="text-white/70 text-[10px] font-medium uppercase tracking-wider mb-0.5">Orçamento</p>
                  <p className="text-xl font-bold text-white leading-none">{Math.round(budgetPct)}%</p>
                  {budgetPctFallback && (
                    <p className="text-white/50 text-[9px] leading-tight mt-0.5">Configure seu plano<br/>para ver o real</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white/70 text-[10px] font-medium uppercase tracking-wider mb-0.5">
                    {daysRemaining === 0 ? 'Último dia' : 'Dias'}
                  </p>
                  <p className="text-xl font-bold text-white leading-none">
                    {daysRemaining === 0 ? '—' : daysRemaining}
                  </p>
                  {daysRemaining > 0 && (
                    <p className="text-white/60 text-[10px]">restantes</p>
                  )}
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.3)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: mounted ? `${budgetPct}%` : '0%', transition: 'width 500ms ease-out', background: 'rgba(255,255,255,0.9)' }}
                />
              </div>
              <span className={`text-xs font-medium ${heroStatusColor}`}>{heroStatusLabel}</span>
            </>
          )}
        </div>
      )}

      {/* ── CONTAS DO MÊS ──────────────────────────────────────────────────────── */}
      {isCurrentMonth && obligations.length > 0 && (
        <div
          id="contas-do-mes"
          className="mb-3 bg-white border border-gray-100 rounded-2xl overflow-hidden"
          style={mounted ? anim(130) : hidden}
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-gray-800 font-semibold text-sm uppercase tracking-wider text-xs">Contas do mês</p>
            {pendingObligations.length > 0 ? (
              <span className="bg-amber-500/15 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                {pendingObligations.length} pendente{pendingObligations.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-mint-500 text-xs font-medium">Tudo em dia</span>
            )}
          </div>

          <div className="divide-y divide-slate-800/60">
              {[...obligations]
                .sort((a, b) => {
                  if (a.status === b.status) return a.dueDay - b.dueDay;
                  return a.status === 'pending' ? -1 : 1;
                })
                .map((ob) => {
                const cfg = CATEGORY_CONFIG[ob.category as Category];
                const isPaid = ob.status === 'paid';
                const isPaying = payingIds.has(ob.id);
                const daysLate = !isPaid && todayDay > ob.dueDay ? todayDay - ob.dueDay : 0;
                const dueToday = !isPaid && todayDay === ob.dueDay;
                const dueLabelText = isPaid ? '' : daysLate > 0
                  ? `Atrasado ${daysLate} dia${daysLate > 1 ? 's' : ''}`
                  : dueToday ? 'Vence hoje' : `Vence dia ${ob.dueDay}`;
                const dueLabelColor = daysLate > 0 ? 'text-red-400' : dueToday ? 'text-amber-400' : 'text-gray-500';
                return (
                  <div
                    key={ob.id}
                    className={`px-4 py-3 flex items-center gap-3 transition-all ${isPaid ? 'opacity-50' : ''}`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${cfg?.bgClass ?? 'bg-gray-50'}`}>
                      {cfg?.icon ?? '💸'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isPaid ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {ob.description}
                      </p>
                      {!isPaid && <p className={`text-xs ${dueLabelColor}`}>{dueLabelText}</p>}
                    </div>
                    <span className={`font-semibold text-sm whitespace-nowrap flex-shrink-0 ${isPaid ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                      {formatCurrency(ob.amount)}
                    </span>
                    {isPaid ? (
                      <span className="text-mint-500 text-xs font-semibold flex-shrink-0">Pago ✓</span>
                    ) : (
                      <button
                        onClick={() => handleMarkObligationPaid(ob.id)}
                        disabled={isPaying}
                        className="w-8 h-8 rounded-xl bg-mint-50 border border-emerald-500/25 flex items-center justify-center text-mint-500 hover:bg-mint-50 transition-colors flex-shrink-0 disabled:opacity-50"
                        title="Marcar como pago"
                      >
                        {isPaying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
        </div>
      )}

      {/* ── LANÇAR GASTO (desktop) ──────────────────────────────────────────────── */}
      <Link
        href="/lancamentos"
        className="mb-4 hidden md:block text-center text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)', ...(mounted ? anim(160) : hidden) }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#00955f')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'linear-gradient(135deg, #00b87a, #00d68f)')}
      >
        + Lançar gasto
      </Link>

      {/* ── RESUMO IA COMPACTO ─────────────────────────────────────────────────── */}
      <div className="mb-3 bg-white border border-white/[0.06] rounded-2xl p-3" style={mounted ? anim(180) : hidden}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star size={13} className="text-mint-500" />
            <p className="text-gray-900 font-semibold text-sm">Resumo do mês</p>
            <span className="text-[10px] text-mint-500 font-semibold uppercase tracking-wider">IA</span>
          </div>
          <button
            onClick={() => { setShowResumoModal(true); if (!resumoData) loadResumo(); }}
            className="text-mint-500 hover:text-mint-500 text-xs font-medium transition-colors"
          >
            Ver análise →
          </button>
        </div>
        <ul className="space-y-1.5">
          {compactBullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span className="text-mint-500 mt-0.5 flex-shrink-0">•</span>
              <span className="text-gray-800">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── ALERTAS INTELIGENTES ───────────────────────────────────────────────── */}
      <div className="mb-5 border border-warning/20 rounded-2xl p-4" style={{ ...(mounted ? anim(240) : hidden), background: '#fff6e0' }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#b45309' }}>Alertas</p>
        {topNewAlerts.length > 0 ? (
          <div className="space-y-2.5">
            {topNewAlerts.map((alert, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="text-base leading-none">{alert.emoji}</span>
                <span className="text-gray-700 text-sm">{alert.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <span className="text-base leading-none">✅</span>
            <span className="text-gray-700 text-sm">Nenhum risco detectado</span>
          </div>
        )}
      </div>

      {/* ── GRÁFICO DE CATEGORIAS ──────────────────────────────────────────────── */}
      <div className="mb-5 bg-white border border-gray-100 rounded-2xl p-5" style={mounted ? anim(300) : hidden}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-800 font-semibold text-sm">Gastos por Categoria</h2>
          {topCat && spent > 0 && (
            <span className="text-xs text-gray-500">{Math.round((topCat.total / spent) * 100)}% em {topCat.cat}</span>
          )}
        </div>

        {topCat && (
          <div className="flex items-center gap-2.5 mb-4 px-3 py-2.5 bg-mint-50 border border-mint-500/20 rounded-xl">
            <span className="text-gray-500 text-[10px] font-medium uppercase tracking-wider flex-shrink-0">Maior gasto</span>
            <span className="text-base leading-none">{CATEGORY_CONFIG[topCat.cat]?.icon}</span>
            <span className="text-gray-900 font-semibold text-sm">{topCat.cat}</span>
            <span className="ml-auto text-mint-500 font-bold text-sm whitespace-nowrap">{formatCurrency(topCat.total)}</span>
            {spent > 0 && (
              <span className="text-gray-500 text-xs whitespace-nowrap">{Math.round((topCat.total / spent) * 100)}%</span>
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
          return <p className="mt-3 text-center text-xs text-gray-500/80">{msg}</p>;
        })()}
      </div>

      {/* ── ÚLTIMAS MOVIMENTAÇÕES ──────────────────────────────────────────────── */}
      <div className="mb-5 bg-white border border-gray-100 rounded-2xl p-4" style={mounted ? anim(380) : hidden}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-900 font-semibold text-sm">Últimas movimentações</h2>
          <Link href="/historico" className="text-mint-500 hover:text-mint-500 text-xs font-medium transition-colors">
            Ver tudo →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-gray-500 text-sm">Nenhum lançamento neste período</p>
            <Link href="/lancamentos" className="text-mint-500 text-sm mt-2 inline-block">Lançar agora →</Link>
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
                      <p className="text-gray-900 text-sm font-medium truncate">{exp.description}</p>
                      <p className="text-gray-500 text-xs">{exp.category} · {day}/{month}</p>
                    </div>
                    <span className="font-semibold text-sm whitespace-nowrap" style={{ color: isIncome ? '#00b87a' : '#f04e5e' }}>
                      {isIncome ? '+' : '−'}{formatCurrency(exp.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <Link href="/historico" className="block text-center text-mint-500 hover:text-mint-500 text-xs font-medium transition-colors">
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
          <div className="mb-3 bg-white border border-white/[0.06] rounded-2xl p-4" style={mounted ? anim(440) : hidden}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-900 font-semibold text-sm">Missões</p>
              <button
                onClick={() => setShowMissoesModal(true)}
                className="text-mint-500 hover:text-mint-500 text-xs font-medium transition-colors"
              >
                Ver missões →
              </button>
            </div>

            <div className="flex items-center gap-5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl leading-none">{streak >= 2 ? '🔥' : streak === 1 ? '✨' : '💡'}</span>
                <div>
                  <p className="text-gray-900 text-sm font-semibold">{streak} {streak === 1 ? 'dia' : 'dias'}</p>
                  <p className="text-gray-500 text-xs">streak</p>
                </div>
              </div>
              <div className="w-px h-8 bg-gray-50 flex-shrink-0" />
              <div>
                <p className="text-gray-900 text-sm font-semibold">{missoesEmAndamento}</p>
                <p className="text-gray-500 text-xs">em andamento</p>
              </div>
              <div className="w-px h-8 bg-gray-50 flex-shrink-0" />
              <div>
                <p className="text-gray-900 text-sm font-semibold">{3 - missoesEmAndamento}/3</p>
                <p className="text-gray-500 text-xs">concluídas</p>
              </div>
            </div>

            {missaoPrincipal ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-gray-500 text-xs">{missaoPrincipal.label}</span>
                  <span className="text-gray-500 text-xs">{Math.round(missaoPrincipal.pct * 100)}%</span>
                </div>
                <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-mint-500" style={{ width: mounted ? `${missaoPrincipal.pct * 100}%` : '0%', transition: 'width 400ms cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
                </div>
                {missaoUrgencia && (
                  <p className="mt-2 text-xs text-gray-500">{missaoUrgencia}</p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 py-1">
                <span className="text-mint-500 text-sm">✅</span>
                <span className="text-mint-500 text-sm font-medium">Todas as missões concluídas!</span>
              </div>
            )}
          </div>

          {/* Conquistas — scroll horizontal */}
          <div className="mb-5 bg-white border border-white/[0.06] rounded-2xl p-4" style={mounted ? anim(500) : hidden}>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-3">Conquistas</p>
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="flex gap-3 pb-1" style={{ minWidth: 'max-content' }}>
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`w-28 flex-shrink-0 rounded-xl p-3 border ${badge.earned ? `${badge.bg} ${badge.border} badge-glow` : 'bg-gray-50/50 border-gray-200/50'} ${newBadgeIds.has(badge.id) ? 'animate-pulse' : ''}`}
                  >
                    <span className={`text-2xl leading-none block mb-1.5 ${badge.earned ? '' : 'grayscale opacity-30'}`}>{badge.icon}</span>
                    <p className={`font-semibold text-xs leading-tight ${badge.earned ? 'text-gray-900' : 'text-gray-500'}`}>{badge.name}</p>
                    <p className={`text-[10px] mt-0.5 leading-tight ${badge.earned ? badge.text : 'text-gray-500'}`}>
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
      <div id="planejamento">
      <PlanningSection
        period={period}
        income={income}
        spent={spent}
        fixedCosts={fixedCosts}
        budgets={budgets}
        periodExpenses={periodExpenses}
        monthlyPlan={monthlyPlan}
        contributions={contributions}
        onPlanUpdate={setMonthlyPlan}
      />
      </div>

      {/* ── CTA FIXO MOBILE ────────────────────────────────────────────────────── */}
      <Link
        href="/lancamentos"
        className="fixed bottom-20 right-4 md:hidden flex items-center gap-2 text-white font-semibold text-sm pl-4 pr-5 h-12 rounded-full shadow-xl shadow-mint-500/40 transition-colors z-40"
        style={{ background: 'linear-gradient(135deg, #00b87a, #00d68f)' }}
      >
        <Plus size={18} />
        Lançar
      </Link>

      {/* ── MODAL: Análise IA Completa ─────────────────────────────────────────── */}
      {showResumoModal && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-hidden"
          style={{ touchAction: 'none' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowResumoModal(false); }}
        >
          <div className="bg-white border border-gray-100 rounded-2xl p-6 w-full max-w-lg max-h-[70vh] overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star size={15} className="text-mint-500" />
                <p className="text-gray-900 font-semibold">Resumo da semana</p>
                <span className="text-[10px] text-mint-500 font-semibold uppercase tracking-wider">IA</span>
              </div>
              <button onClick={() => setShowResumoModal(false)} className="text-gray-500 hover:text-gray-700 transition-colors p-1">
                <X size={18} />
              </button>
            </div>

            {resumoLoading && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <Loader2 size={12} className="animate-spin" />
                  <span>Gerando com IA…</span>
                </div>
                {[100, 90, 75, 85, 60].map((w, i) => (
                  <div key={i} className="h-2.5 bg-gray-50 rounded-full animate-pulse" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}

            {!resumoData && !resumoLoading && (
              <button
                onClick={() => loadResumo()}
                className="w-full flex items-center justify-center gap-2 bg-mint-50 hover:bg-mint/25 text-mint-500 hover:text-mint-700 text-sm font-medium py-2.5 rounded-xl transition-colors border border-mint-500/20"
              >
                ✨ Gerar resumo da semana
              </button>
            )}

            {resumoData && !resumoLoading && (
              <>
                <div className="text-gray-700 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderBotText(resumoData.resumo) }} />
                <div className="flex items-center justify-between mt-4">
                  <p className="text-gray-500 text-[11px]">
                    Gerado em {new Date(resumoData.geradoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                  <button
                    onClick={() => loadResumo(true)}
                    className="text-gray-500 hover:text-gray-700 transition-colors p-1 rounded-lg hover:bg-gray-50"
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
          <div className="bg-white border border-gray-100 rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <p className="text-gray-900 font-semibold">Missões da semana</p>
              <button onClick={() => setShowMissoesModal(false)} className="text-gray-500 hover:text-gray-700 transition-colors p-1">
                <X size={18} />
              </button>
            </div>

            {/* Streak no modal */}
            <div className={`rounded-xl p-3 border mb-5 flex items-center gap-3 ${
              streak >= 3 ? 'bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30' : 'bg-white border-gray-100'
            }`}>
              <span className="text-2xl leading-none">{streak >= 2 ? '🔥' : streak === 1 ? '✨' : '💡'}</span>
              <div>
                {streak >= 2 ? <p className="text-gray-900 font-semibold text-sm">{streak} dias seguidos registrando</p>
                  : streak === 1 ? <p className="text-gray-900 font-semibold text-sm">Começou hoje! Continue amanhã</p>
                  : <p className="text-gray-500 text-sm">Registre algo hoje para começar seu streak</p>}
                {streak >= 2 && <p className="text-gray-500 text-xs mt-0.5">Não perca o ritmo!</p>}
              </div>
            </div>

            <div className="space-y-5">
              {/* Missão 1 */}
              <div>
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="text-base leading-none mt-0.5">🛵</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-gray-900 text-sm font-medium">3 dias sem delivery</p>
                      {m1Done
                        ? <span className="text-mint-500 text-xs font-semibold flex-shrink-0">✅ Feito</span>
                        : <span className="text-gray-500 text-xs flex-shrink-0">{deliveryFreeStreak}/3</span>}
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {m1Done ? '3+ dias sem pedir delivery!'
                        : deliveryFreeStreak === 0 ? 'Teve delivery hoje ou ontem'
                        : `${deliveryFreeStreak} dia${deliveryFreeStreak > 1 ? 's' : ''} sem delivery — continue!`}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-gray-50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m1Done ? 'bg-mint' : 'bg-mint-500'}`} style={{ width: `${Math.round(m1Pct * 100)}%` }} />
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* Missão 2 */}
              <div>
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="text-base leading-none mt-0.5">🎯</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-gray-900 text-sm font-medium">Semana abaixo da meta</p>
                      {m2Done
                        ? <span className="text-mint-500 text-xs font-semibold flex-shrink-0">✅ Feito</span>
                        : m2OverBudget
                        ? <span className="text-red-400 text-xs font-semibold flex-shrink-0">Excedido</span>
                        : <span className="text-gray-500 text-xs flex-shrink-0">—</span>}
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {weeklyRef === 0 ? 'Defina orçamento ou registre receita'
                        : m2Done ? `Dentro da meta — sobra ${formatCurrency(weeklyRef - weekSpent)}`
                        : `${formatCurrency(weekSpent)} gasto · meta ${formatCurrency(weeklyRef)}`}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-gray-50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m2Done ? 'bg-mint' : m2OverBudget ? 'bg-red-500' : 'bg-gray-100'}`} style={{ width: m2Done || m2OverBudget ? '100%' : '0%' }} />
                </div>
              </div>

              <div className="border-t border-gray-100" />

              {/* Missão 3 */}
              <div>
                <div className="flex items-start gap-2.5 mb-2">
                  <span className="text-base leading-none mt-0.5">📅</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-gray-900 text-sm font-medium">Lançar tudo por 5 dias</p>
                      {m3Done
                        ? <span className="text-mint-500 text-xs font-semibold flex-shrink-0">✅ Feito</span>
                        : <span className="text-gray-500 text-xs flex-shrink-0">{streak}/5</span>}
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {m3Done ? '5+ dias seguidos registrando!'
                        : streak === 0 ? 'Registre algo hoje para começar'
                        : `${streak} dia${streak > 1 ? 's' : ''} seguido${streak > 1 ? 's' : ''} — faltam ${5 - streak}`}
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-gray-50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${m3Done ? 'bg-mint' : 'bg-mint-500'}`} style={{ width: `${Math.round(m3Pct * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
