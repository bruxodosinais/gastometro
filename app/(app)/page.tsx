'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, ChevronLeft, ChevronRight, Loader2, RefreshCw, X } from 'lucide-react';
import { useNotifications } from '@/lib/useNotifications';
import NotificationsDrawer from '@/components/NotificationsDrawer';
import { ToastContainer, useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/errors';
import { retryAsync } from '@/lib/retry';
import {
  getExpenses,
  getBudgets,
  getRecurringExpenses,
  getMonthlyPlan,
  upsertMonthlyPlan,
  getMonthlyObligations,
  checkAndGenerateObligations,
  markObligationAsPaid,
  addExpense,
  getAllGoalContributions,
  getCreditCards,
  getCreditCardFatura,
} from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import {
  calculateTotalByType,
  formatCurrency,
  formatCompact,
  getMonthKey,
  getMonthLabel,
} from '@/lib/calculations';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { usePeriod } from '@/lib/periodContext';
import { calculateStreak } from '@/lib/streak';
import {
  Budget,
  Category,
  CreditCard as CreditCardType,
  Expense,
  EXPENSE_CATEGORIES,
  GoalContribution,
  MonthlyObligation,
  MonthlyPlan,
  RecurringExpense,
} from '@/lib/types';
import PlanningSection from '@/components/PlanningSection';
import MonthlyCloseModal from '@/components/MonthlyCloseModal';
import { useSubscription } from '@/hooks/useSubscription';

// ── Helpers ───────────────────────────────────────────────────────────────────

function anim(delay: number, duration = 350): React.CSSProperties {
  return {
    animationName: 'up',
    animationDuration: `${duration}ms`,
    animationTimingFunction: 'ease-out',
    animationFillMode: 'both',
    animationDelay: `${delay}ms`,
  };
}
const hidden: React.CSSProperties = { opacity: 0, transform: 'translateY(12px)' };

function AutoValue({
  value,
  className = '',
  style,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}) {
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { period, setPeriod } = usePeriod();
  const { isFree, loading: subLoading } = useSubscription();

  // ── State ──────────────────────────────────────────────────────────────────
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [obligations, setObligations] = useState<MonthlyObligation[]>([]);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlan | null>(null);
  const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
  const [receivingIds, setReceivingIds] = useState<Set<string>>(new Set());
  const [variablePayModal, setVariablePayModal] = useState<{
    obligationId: string;
    estimatedAmount: number;
  } | null>(null);
  const [variableAmount, setVariableAmount] = useState('');
  // P5: modal inline para configurar renda/meta sem sair da tela inicial.
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetIncomeInput, setBudgetIncomeInput] = useState('');
  const [budgetGoalInput, setBudgetGoalInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState('');
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showNotifDrawer, setShowNotifDrawer] = useState(false);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileAvatarEmoji, setProfileAvatarEmoji] = useState<string | null>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const contasMesRef = useRef<HTMLDivElement>(null);
  // Guard contra invocações concorrentes de loadUserAndProfile (mount +
  // visibilitychange podem disparar quase simultaneamente em mobile),
  // evitando "Lock was released because another request stole it" do
  // supabase.auth.getUser().
  const loadingUserRef = useRef(false);
  const [highlighting, setHighlighting] = useState(false);
  const [userName, setUserName] = useState('');
  const [creditCards, setCreditCards] = useState<CreditCardType[]>([]);
  const [cardFaturas, setCardFaturas] = useState<{ card: CreditCardType; total: number }[]>([]);
  const [cardVencimentoAlert, setCardVencimentoAlert] = useState<{
    card: CreditCardType;
    fatura: number;
  } | null>(null);
  const [payingFaturaId, setPayingFaturaId] = useState<string | null>(null);
  const [showMonthlyClose, setShowMonthlyClose] = useState(false);
  const [prevMonthlyPlan, setPrevMonthlyPlan] = useState<MonthlyPlan | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  // ── Data loading ───────────────────────────────────────────────────────────
  async function loadData() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    setLoadError(null);
    try {
      const [exp, bud, rec, obs, contrib, cards] = await retryAsync(() =>
        Promise.all([
          getExpenses(),
          getBudgets(),
          getRecurringExpenses(),
          checkAndGenerateObligations().then(() => getMonthlyObligations(currentMonth)),
          getAllGoalContributions(),
          getCreditCards(),
        ])
      );
      setExpenses(exp);
      setBudgets(bud);
      setRecurringExpenses(rec);
      setObligations(obs);
      setContributions(contrib);
      setCreditCards(cards);
      if (cards.length > 0) {
        const faturas = await Promise.all(
          cards.map(async (card) => ({
            card,
            total: await getCreditCardFatura(card.id, currentMonth),
          }))
        );
        setCardFaturas(faturas);
      }
      setReady(true);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    }
  }

  useEffect(() => {
    loadData();

    async function loadUserAndProfile() {
      if (loadingUserRef.current) return;
      loadingUserRef.current = true;
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const meta = user.user_metadata as Record<string, string> | undefined;
        const name =
          meta?.display_name ||
          meta?.full_name?.split(' ')[0] ||
          meta?.name?.split(' ')[0] ||
          user.email?.split('@')[0] ||
          '';
        setUserName(name.charAt(0).toUpperCase() + name.slice(1));
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, avatar_emoji')
          .eq('id', user.id)
          .single();
        if (profile) {
          setProfileAvatarUrl(profile.avatar_url ?? null);
          setProfileAvatarEmoji(profile.avatar_emoji ?? null);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Lock') && msg.includes('stole it')) {
          // Outra requisição roubou o lock do navigator.locks usado pelo
          // GoTrue. Reagenda fora do finally — o guard será liberado abaixo.
          setTimeout(() => loadUserAndProfile(), 200);
          return;
        }
        console.error('loadUserAndProfile error:', err);
      } finally {
        loadingUserRef.current = false;
      }
    }
    loadUserAndProfile();

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const month = new Date().toISOString().slice(0, 7);
        Promise.all([
          getMonthlyObligations(month),
          getExpenses(),
          getRecurringExpenses(),
        ]).then(([obs, exp, rec]) => {
          setObligations(obs);
          setExpenses(exp);
          setRecurringExpenses(rec);
        });
        loadUserAndProfile();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getMonthlyPlan(period).then(setMonthlyPlan);
  }, [period]);

  useEffect(() => {
    if (ready) setMounted(true);
  }, [ready]);

  // Monthly close modal on day 1
  useEffect(() => {
    if (!ready) return;
    const today = new Date();
    if (today.getDate() !== 1) return;
    const currentMonthKey = getMonthKey(today);
    if (localStorage.getItem(`fechamento_mes_visto_${currentMonthKey}`)) return;
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthKey = getMonthKey(prevMonthDate);
    const hasPrevData = expenses.some((e) => e.date.slice(0, 7) === prevMonthKey);
    if (!hasPrevData) return;
    getMonthlyPlan(prevMonthKey).then((plan) => {
      setPrevMonthlyPlan(plan);
      setShowMonthlyClose(true);
    });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || creditCards.length === 0) return;
    const todayDayNum = new Date().getDate();
    for (const cf of cardFaturas) {
      if (cf.card.diaVencimento === todayDayNum && cf.total > 0) {
        setCardVencimentoAlert({ card: cf.card, fatura: cf.total });
        break;
      }
    }
  }, [ready, creditCards, cardFaturas]);

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

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleMarkObligationPaid(obligationId: string, actualAmount?: number) {
    const ob = obligations.find((o) => o.id === obligationId);
    if (!ob || payingIds.has(obligationId)) return;
    setPayingIds((prev) => new Set([...prev, obligationId]));
    setObligations((prev) =>
      prev.map((o) => (o.id === obligationId ? { ...o, status: 'paid' as const } : o))
    );
    try {
      const { expense } = await markObligationAsPaid(obligationId, ob, actualAmount);
      setExpenses((prev) => [expense, ...prev]);
    } catch (err) {
      setObligations((prev) =>
        prev.map((o) => (o.id === obligationId ? { ...o, status: 'pending' as const } : o))
      );
      addToast(getErrorMessage(err), 'error');
    } finally {
      setPayingIds((prev) => {
        const next = new Set(prev);
        next.delete(obligationId);
        return next;
      });
    }
  }

  async function handleConfirmIncome(rec: RecurringExpense) {
    if (receivingIds.has(rec.id)) return;
    setReceivingIds((prev) => new Set([...prev, rec.id]));
    const date = new Date().toISOString().slice(0, 10);
    try {
      const expense = await addExpense(
        {
          description: rec.description,
          amount: rec.amount,
          category: rec.category,
          type: 'income',
          date,
        },
        rec.id
      );
      setExpenses((prev) => [expense, ...prev]);
    } catch (err) {
      addToast(getErrorMessage(err), 'error');
    } finally {
      setReceivingIds((prev) => {
        const next = new Set(prev);
        next.delete(rec.id);
        return next;
      });
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  async function handlePayFatura(card: CreditCardType, faturaTotal: number) {
    if (payingFaturaId === card.id) return;
    setPayingFaturaId(card.id);
    try {
      const expense = await addExpense({
        type: 'expense',
        amount: faturaTotal,
        description: `Fatura ${card.nome}`,
        category: 'Outros',
        date: new Date().toISOString().slice(0, 10),
      });
      setExpenses((prev) => [expense, ...prev]);
      setCardFaturas((prev) =>
        prev.map((cf) => (cf.card.id === card.id ? { ...cf, total: 0 } : cf))
      );
      setCardVencimentoAlert(null);
    } finally {
      setPayingFaturaId(null);
    }
  }

  // P5: salva renda/meta do mês selecionado e atualiza o bloco em tempo real.
  async function handleSaveBudget() {
    setBudgetError('');
    const incomeValue = parseFloat(budgetIncomeInput.replace(',', '.'));
    if (!budgetIncomeInput.trim() || Number.isNaN(incomeValue) || incomeValue <= 0) {
      setBudgetError('Informe uma renda mensal maior que zero.');
      return;
    }
    let goalValue = 0;
    if (budgetGoalInput.trim()) {
      goalValue = parseFloat(budgetGoalInput.replace(',', '.'));
      if (Number.isNaN(goalValue) || goalValue < 0) {
        setBudgetError('A meta de poupança não pode ser negativa.');
        return;
      }
    }
    if (goalValue > incomeValue) {
      setBudgetError('A meta de poupança não pode ser maior que a renda.');
      return;
    }
    setSavingBudget(true);
    try {
      const plan = await upsertMonthlyPlan(period, incomeValue, goalValue);
      setMonthlyPlan(plan);
      setBudgetModalOpen(false);
      setBudgetIncomeInput('');
      setBudgetGoalInput('');
      addToast('Orçamento configurado!');
    } catch (err) {
      setBudgetError(getErrorMessage(err));
    } finally {
      setSavingBudget(false);
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const now = new Date();
  const isCurrentMonth = period === getMonthKey(now);
  const isFutureMonth = period > getMonthKey(now);

  const [periodYear, periodMonth] = period.split('-').map(Number);
  const totalDaysInMonth = new Date(periodYear, periodMonth, 0).getDate();
  const todayDay = isCurrentMonth ? now.getDate() : totalDaysInMonth;
  const daysRemaining = isCurrentMonth ? totalDaysInMonth - todayDay : 0;
  const daysForLimit = isCurrentMonth
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
    : 0;

  const periodEntries = expenses.filter((e) => e.date.slice(0, 7) === period);
  const income = calculateTotalByType(periodEntries, 'income');
  const spent = calculateTotalByType(periodEntries, 'expense');
  const periodCreditTotal = periodEntries
    .filter((e) => e.type === 'expense' && e.isCredit === true)
    .reduce((s, e) => s + e.amount, 0);
  const debitSpent = spent - periodCreditTotal;
  const debitBalance = income - debitSpent;
  const periodExpenses = periodEntries.filter((e) => e.type === 'expense');
  const periodIncomes = periodEntries.filter((e) => e.type === 'income');

  // Categorias que estouraram o orçamento no período selecionado.
  // Defensivo: só considera budgets com limite > 0 (orçamento zerado ou
  // ausente não conta como estourado). Ordenado pelo maior excedente.
  const budgetOverflows = budgets
    .filter((b) => b.amount > 0)
    .map((b) => {
      const categorySpent = periodExpenses
        .filter((e) => e.category === b.category)
        .reduce((s, e) => s + e.amount, 0);
      return { category: b.category, spent: categorySpent, limit: b.amount };
    })
    .filter((b) => b.spent > b.limit)
    .sort((a, b) => (b.spent - b.limit) - (a.spent - a.limit));

  // Top gastos do período, agrupados por descrição
  const topExpenses = (() => {
    const byDesc = new Map<string, number>();
    for (const e of periodExpenses) {
      const desc = (e.description || 'Sem descrição').trim();
      const key = desc.charAt(0).toUpperCase() + desc.slice(1);
      byDesc.set(key, (byDesc.get(key) ?? 0) + e.amount);
    }
    return Array.from(byDesc.entries())
      .map(([description, total]) => ({ description, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  })();

  // Item só conta como "pendente" para Contas do mês quando o day_of_month
  // do recorrente já chegou (ou está em branco — nesse caso considera-se
  // pendente desde o início do mês).
  const isDayReachedForRec = (dom: number | undefined): boolean =>
    dom == null || dom <= todayDay;

  const pendingObligations = obligations
    .filter((o) => o.status === 'pending')
    .filter((o) => {
      const rec = recurringExpenses.find((r) => r.id === o.recurringExpenseId);
      // Defensivo: receita (ex.: Salário) NUNCA conta como conta a pagar,
      // mesmo que uma obrigação legada tenha sido gerada a partir de uma
      // recorrente type='income'. Só despesas entram em "pendentes" e no
      // total "pra pagar ainda".
      if (rec && rec.type === 'income') return false;
      return rec ? isDayReachedForRec(rec.dayOfMonth) : true;
    });
  const pendingTotal = pendingObligations.reduce((s, o) => s + o.amount, 0);

  const fixedCosts = recurringExpenses
    .filter((r) => r.active && r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);
  const recurringIncome = recurringExpenses
    .filter((r) => r.active && r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);

  const activeIncomeRecs = recurringExpenses.filter((r) => r.active && r.type === 'income');
  const receivedIncomeRecIds = new Set(
    periodEntries
      .filter((e) => e.type === 'income' && e.recurringExpenseId != null)
      .map((e) => e.recurringExpenseId as string)
  );
  const firstIncomeDay = (() => {
    const days = activeIncomeRecs
      .map((r) => r.dayOfMonth)
      .filter((d): d is number => typeof d === 'number');
    return days.length > 0 ? Math.min(...days) : null;
  })();

  const savingsGoal = monthlyPlan?.savingsGoal ?? 0;
  const heroBase = (monthlyPlan?.expectedIncome ?? 0) > 0 ? monthlyPlan!.expectedIncome : income;
  const effectiveIncome = Math.max(recurringIncome, income);
  const valorLivreParaGastarPlanejado = heroBase - fixedCosts - savingsGoal;
  const orcamentoRestante = valorLivreParaGastarPlanejado - debitSpent;

  const budgetPct =
    valorLivreParaGastarPlanejado > 0
      ? Math.min((debitSpent / valorLivreParaGastarPlanejado) * 100, 100)
      : debitSpent > 0
      ? 100
      : 0;

  const streak = isCurrentMonth ? calculateStreak(expenses) : 0;

  // ── Previous month data (for hint) ────────────────────────────────────────
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = getMonthKey(prevMonthDate);
  const prevMonthLabel = prevMonthDate.toLocaleDateString('pt-BR', { month: 'long' });
  const prevMonthLabelCapitalized =
    prevMonthLabel.charAt(0).toUpperCase() + prevMonthLabel.slice(1);
  const prevMonthEntries = expenses.filter((e) => e.date.slice(0, 7) === prevMonthKey);
  const prevMonthIncome = prevMonthEntries
    .filter((e) => e.type === 'income')
    .reduce((s, e) => s + e.amount, 0);
  const prevMonthSpent = prevMonthEntries
    .filter((e) => e.type === 'expense')
    .reduce((s, e) => s + e.amount, 0);
  const prevMonthTopCat = (() => {
    const totals = EXPENSE_CATEGORIES.map((cat) => ({
      cat,
      total: prevMonthEntries
        .filter((e) => e.type === 'expense' && e.category === cat)
        .reduce((s, e) => s + e.amount, 0),
    }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
    return totals[0] ?? null;
  })();

  // ── Notifications ──────────────────────────────────────────────────────────
  const { notifications, unreadCount, readIds, markAsRead, markAllAsRead } = useNotifications({
    expenses,
    budgets,
    recurringExpenses,
    obligations,
    monthlyPlan,
    period,
  });

  // ── Greeting ───────────────────────────────────────────────────────────────
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  // ── Month navigator ────────────────────────────────────────────────────────
  function goPrevMonth() {
    const [y, m] = period.split('-').map(Number);
    setPeriod(getMonthKey(new Date(y, m - 2, 1)));
  }
  function goNextMonth() {
    const [y, m] = period.split('-').map(Number);
    setPeriod(getMonthKey(new Date(y, m, 1)));
  }
  const periodDateObj = new Date(periodYear, periodMonth - 1, 1);
  const navigatorLabel = (() => {
    const raw = periodDateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  // ── Hint ──────────────────────────────────────────────────────────────────
  const hintText = (() => {
    if (!isCurrentMonth) return null;
    if (prevMonthSpent > 0 && spent > 0) {
      const diff = spent - prevMonthSpent;
      if (diff < 0)
        return `Você gastou ${formatCurrency(Math.abs(diff))} a menos que em ${prevMonthLabel} — continue assim!`;
      if (diff > 0)
        return `Você gastou ${formatCurrency(diff)} a mais que em ${prevMonthLabel}. Atenção ao ritmo.`;
    }
    if (streak >= 5)
      return `${streak} dias seguidos registrando. Você está construindo um ótimo hábito!`;
    return null;
  })();

  // ── Insights personalizados ───────────────────────────────────────────────
  const monthInsights: string[] = (() => {
    if (periodExpenses.length === 0) return [];
    const out: string[] = [];

    // Maior categoria do mês
    const totalsByCat = EXPENSE_CATEGORIES.map((cat) => ({
      cat,
      total: periodExpenses
        .filter((e) => e.category === cat)
        .reduce((s, e) => s + e.amount, 0),
    }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
    const topCat = totalsByCat[0];
    if (topCat) {
      out.push(`${topCat.cat} foi sua maior categoria: ${formatCurrency(topCat.total)}`);
    }

    // Comparação com mês anterior
    if (prevMonthSpent > 0 && spent > 0) {
      const diff = spent - prevMonthSpent;
      if (Math.abs(diff) >= 0.01) {
        if (diff > 0) {
          out.push(`Você gastou ${formatCurrency(diff)} a mais que em ${prevMonthLabel}`);
        } else {
          out.push(`Você gastou ${formatCurrency(Math.abs(diff))} a menos que em ${prevMonthLabel}`);
        }
      }
    }

    // Maior despesa individual
    const biggest = periodExpenses.reduce(
      (max, e) => (e.amount > (max?.amount ?? 0) ? e : max),
      null as null | (typeof periodExpenses)[number]
    );
    if (biggest && out.length < 2) {
      const desc = (biggest.description || biggest.category).trim();
      const descCap = desc.charAt(0).toUpperCase() + desc.slice(1);
      out.push(`Sua maior despesa foi ${descCap}: ${formatCurrency(biggest.amount)}`);
    }

    return out.slice(0, 2);
  })();

  // ── Monthly close handlers ─────────────────────────────────────────────────
  function handleCloseMonthlyClose() {
    localStorage.setItem(`fechamento_mes_visto_${getMonthKey(now)}`, 'true');
    setShowMonthlyClose(false);
  }
  function handleViewMonthHistory() {
    localStorage.setItem(`fechamento_mes_visto_${getMonthKey(now)}`, 'true');
    setShowMonthlyClose(false);
    router.push('/historico?filter=prevMonth');
  }

  // ── Loading / error states ─────────────────────────────────────────────────
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
            onClick={loadData}
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

    // Skeleton
    return (
      <main
        className="home-main"
        style={{
          maxWidth: 440,
          margin: '0 auto',
          background: 'var(--bg)',
          paddingBottom: 16,
        }}
      >
        {/* wordmark skeleton */}
        <div style={{ padding: '16px 22px 0' }}>
          <div className="skeleton" style={{ height: 22, width: 140, borderRadius: 8 }} />
        </div>
        {/* header skeleton */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '18px 22px 0',
          }}
        >
          <div>
            <div className="skeleton" style={{ height: 12, width: 80, borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 28, width: 160, borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="skeleton" style={{ width: 38, height: 38, borderRadius: '50%' }} />
            <div className="skeleton" style={{ width: 38, height: 38, borderRadius: '50%' }} />
          </div>
        </div>
        {/* navigator skeleton */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
            padding: '20px 0 4px',
          }}
        >
          <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
          <div className="skeleton" style={{ width: 120, height: 18, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
        </div>
        {/* hero card skeleton */}
        <div
          className="skeleton"
          style={{ margin: '12px 16px 0', height: 140, borderRadius: 16 }}
        />
        {/* grid skeleton */}
        <div
          style={{
            margin: '10px 16px 0',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <div className="skeleton" style={{ height: 96, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 96, borderRadius: 16 }} />
        </div>
        {/* orçamento skeleton */}
        <div
          className="skeleton"
          style={{ margin: '10px 16px 0', height: 100, borderRadius: 16 }}
        />
        {/* contas skeleton */}
        <div style={{ margin: '16px 16px 0' }}>
          <div
            className="skeleton"
            style={{ height: 16, width: 130, borderRadius: 6, marginBottom: 10 }}
          />
          <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
        </div>
      </main>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main
      className="home-main"
      style={{
        maxWidth: 440,
        margin: '0 auto',
        background: 'var(--bg)',
        paddingBottom: 16,
      }}
    >
      {/* ── 1. WORDMARK ────────────────────────────────────────────────────── */}
      <div className="mobile-only" style={{ padding: '16px 22px 0', ...(mounted ? anim(0) : hidden) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              background: 'var(--accent)',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            ✅
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>
            TôOrganizado
          </span>
        </div>
      </div>

      {/* ── 2. HEADER ──────────────────────────────────────────────────────── */}
      <div
        className="mobile-only"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '18px 22px 0',
          ...(mounted ? anim(50) : hidden),
        }}
      >
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 2 }}>
            {greeting} 👋
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
            {userName || 'Olá'}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Notificações */}
          <div style={{ position: 'relative' }}>
            <button
              title="Notificações"
              onClick={() => setShowNotifDrawer(true)}
              style={{
                width: 38,
                height: 38,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--hbtn-shadow)',
                cursor: 'pointer',
              }}
            >
              <Bell size={16} color="var(--text-2)" />
            </button>
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 1,
                  right: 1,
                  width: 8,
                  height: 8,
                  background: 'var(--yellow)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>

          {/* Avatar */}
          <div ref={avatarMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAvatarMenu((v) => !v)}
              title="Menu do perfil"
              style={{
                width: 38,
                height: 38,
                background: 'var(--accent)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: 'none',
                overflow: 'hidden',
                boxShadow: '0 2px 8px var(--avatar-shadow)',
                flexShrink: 0,
              }}
            >
              {(
                <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                  {userName ? userName.charAt(0).toUpperCase() : '?'}
                </span>
              )}
            </button>

            {showAvatarMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 46,
                  width: 140,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  overflow: 'hidden',
                  zIndex: 50,
                }}
              >
                <button
                  onClick={() => {
                    setShowAvatarMenu(false);
                    router.push('/perfil');
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    color: 'var(--text)',
                    fontSize: 14,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Perfil
                </button>
                <div style={{ height: 1, background: 'var(--border-2)' }} />
                <button
                  onClick={() => {
                    setShowAvatarMenu(false);
                    handleLogout();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    color: 'var(--red)',
                    fontSize: 14,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. MONTH NAVIGATOR ─────────────────────────────────────────────── */}
      <div
        className="mobile-only"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '20px 0 4px',
          ...(mounted ? anim(100) : hidden),
        }}
      >
        <button
          onClick={goPrevMonth}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={14} color="var(--text-2)" />
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
          {navigatorLabel}
        </span>
        <button
          onClick={goNextMonth}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronRight size={14} color="var(--text-2)" />
        </button>
      </div>

      {/* ── DESKTOP 2-COL WRAPPER (no-op em mobile) ───────────────────────── */}
      <div className="home-content-wrap">
      <div className="home-left-col">

      {/* ── 4. SALDO HERO CARD ─────────────────────────────────────────────── */}
      <div
        style={{
          margin: '12px 16px 0',
          background: 'var(--accent)',
          borderRadius: 'var(--r)',
          padding: '22px 20px 20px',
          boxShadow: '0 8px 24px var(--accent-shadow)',
          position: 'relative',
          overflow: 'hidden',
          ...(mounted ? anim(150) : hidden),
        }}
      >
        {/* decorative circles */}
        <div
          style={{
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            top: -40,
            right: -30,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            bottom: -20,
            left: 30,
            pointerEvents: 'none',
          }}
        />

        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 4,
            position: 'relative',
          }}
        >
          SALDO EM CONTA
        </p>
        <p
          style={{
            fontSize: 40,
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 6,
            position: 'relative',
          }}
        >
          {formatCurrency(debitBalance)}
        </p>

        {(() => {
          const monthResult = income - spent;
          const positive = monthResult >= 0;
          return (
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: positive ? '#A6F5D5' : '#FFB3B3',
                marginBottom: 14,
                position: 'relative',
              }}
            >
              resultado do mês: {positive ? '' : '−'}{formatCurrency(Math.abs(monthResult))}
            </p>
          );
        })()}

        {periodCreditTotal > 0 && (
          <>
            <div
              style={{
                height: 1,
                background: 'rgba(255,255,255,0.15)',
                marginBottom: 12,
                position: 'relative',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Fatura atual</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#FFB3B3' }}>
                −{formatCurrency(periodCreditTotal)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── 5. GRID RECEITA / DESPESA ───────────────────────────────────────── */}
      <div
        style={{
          margin: '10px 16px 0',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          ...(mounted ? anim(200) : hidden),
        }}
      >
        {/* Entrou */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '14px 16px',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div
            className="eio-icon"
            style={{
              width: 32,
              height: 32,
              background: 'var(--green-bg)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              marginBottom: 8,
            }}
          >
            💰
          </div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 2,
            }}
          >
            ENTROU
          </p>
          <AutoValue
            value={income}
            style={{ fontSize: 19, fontWeight: 800, color: 'var(--green)', margin: 0 }}
          />
          <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>esse mês</p>
        </div>

        {/* Saiu */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '14px 16px',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div
            className="eio-icon"
            style={{
              width: 32,
              height: 32,
              background: 'var(--red-bg)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              marginBottom: 8,
            }}
          >
            💸
          </div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 2,
            }}
          >
            SAIU
          </p>
          <AutoValue
            value={spent}
            style={{ fontSize: 19, fontWeight: 800, color: 'var(--red)', margin: 0 }}
          />
          <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>lançados</p>
        </div>
      </div>

      {/* ── 6. ALERTA CONTAS PENDENTES ──────────────────────────────────────── */}
      {isCurrentMonth && pendingObligations.length > 0 && (
        <div
          style={{
            margin: '10px 16px 0',
            background: 'var(--yellow-bg)',
            border: '1.5px solid rgba(255,184,0,0.25)',
            borderRadius: 'var(--r-sm)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            ...(mounted ? anim(250) : hidden),
          }}
          onClick={() => {
            contasMesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setHighlighting(true);
            setTimeout(() => setHighlighting(false), 2000);
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: 'rgba(255,184,0,0.15)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ⚠️
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--yellow-text)',
                margin: 0,
              }}
            >
              {formatCurrency(pendingTotal)} pra pagar ainda
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              {pendingObligations.length} conta
              {pendingObligations.length > 1 ? 's' : ''} aguarda
              {pendingObligations.length > 1 ? 'm' : ''} confirmação
            </p>
          </div>
          <ChevronRight size={14} color="var(--yellow)" style={{ flexShrink: 0 }} />
        </div>
      )}

      {/* ── 7. ORÇAMENTO CARD ───────────────────────────────────────────────── */}
      {(() => {
        const hasBudget = valorLivreParaGastarPlanejado > 0;
        const isZeroed = hasBudget ? orcamentoRestante <= 0 : debitSpent > 0;
        const showNeutral = !hasBudget && debitSpent === 0;
        const barColor = isZeroed ? 'var(--red)' : 'var(--green)';
        const availableValue = Math.max(orcamentoRestante, 0);

        return (
          <div
            style={{
              margin: '10px 16px 0',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              padding: '18px 20px',
              boxShadow: 'var(--card-shadow)',
              ...(mounted ? anim(300) : hidden),
            }}
          >
            {showNeutral ? (
              <>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--text-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 4,
                  }}
                >
                  ORÇAMENTO LIVRE
                </p>
                <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: '8px 0 4px' }}>
                  Configure seu orçamento
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, marginBottom: 14 }}>
                  Informe sua renda mensal para acompanhar seus gastos.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setBudgetError('');
                    setBudgetIncomeInput(
                      monthlyPlan?.expectedIncome ? String(monthlyPlan.expectedIncome) : ''
                    );
                    setBudgetGoalInput(
                      monthlyPlan?.savingsGoal ? String(monthlyPlan.savingsGoal) : ''
                    );
                    setBudgetModalOpen(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    padding: '10px 18px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Configurar agora
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 4,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-3)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      margin: 0,
                    }}
                  >
                    ORÇAMENTO LIVRE
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetError('');
                      setBudgetIncomeInput(
                        monthlyPlan?.expectedIncome ? String(monthlyPlan.expectedIncome) : ''
                      );
                      setBudgetGoalInput(
                        monthlyPlan?.savingsGoal ? String(monthlyPlan.savingsGoal) : ''
                      );
                      setBudgetModalOpen(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#5B5BD6',
                      lineHeight: 1.1,
                    }}
                  >
                    Editar
                  </button>
                </div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 26,
                        fontWeight: 900,
                        color: isZeroed ? 'var(--red)' : 'var(--green)',
                        margin: 0,
                        lineHeight: 1.1,
                      }}
                    >
                      {formatCurrency(availableValue)}
                    </p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
                      disponível
                    </p>
                    <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
                      de {formatCurrency(valorLivreParaGastarPlanejado)} orçados
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p
                      style={{ fontSize: 20, fontWeight: 800, color: isZeroed ? 'var(--red)' : 'var(--text-2)', margin: 0, lineHeight: 1.1 }}
                    >
                      {Math.round(Math.min(budgetPct, 100))}%
                    </p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>
                      usado
                    </p>
                    {isCurrentMonth && (
                      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                        {daysRemaining} dia{daysRemaining !== 1 ? 's' : ''} restante
                        {daysRemaining !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    height: 6,
                    background: 'var(--border-2)',
                    borderRadius: 3,
                    marginTop: 14,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      width: mounted ? `${Math.min(budgetPct, 100)}%` : '0%',
                      background: barColor,
                      transition: 'width 600ms ease',
                    }}
                  />
                </div>

                {isZeroed ? (
                  <div
                    style={{
                      marginTop: 10,
                      background: 'var(--red-bg)',
                      border: '1.5px solid rgba(255,71,87,0.25)',
                      borderRadius: 8,
                      padding: '8px 12px',
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--red)',
                        margin: 0,
                      }}
                    >
                      Eita! Orçamento zerado.
                    </p>
                  </div>
                ) : budgetOverflows.length > 0 ? (
                  <div
                    style={{
                      marginTop: 10,
                      background: 'var(--red-bg)',
                      border: '1.5px solid rgba(255,71,87,0.25)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', margin: 0 }}>
                      {budgetOverflows.length === 1
                        ? '⚠️ 1 categoria com orçamento estourado'
                        : `⚠️ ${budgetOverflows[0].category} e ${budgetOverflows[1].category} estouraram o orçamento`}
                    </p>
                    <Link
                      href="/categorias"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                        flexShrink: 0,
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Ver categorias
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                    {isCurrentMonth
                      ? `Tudo certo! Faltam ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}.`
                      : 'Orçamento do mês.'}
                  </p>
                )}
                {/* P4: contas fixas pendentes não entram no cálculo do
                    Orçamento Livre. Apenas informa — não mexe na barra nem
                    no percentual. Só aparece com despesas recorrentes não
                    pagas no mês atual e total > 0. */}
                {isCurrentMonth && pendingObligations.length > 0 && pendingTotal > 0 && (
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--yellow-text)',
                      marginTop: 8,
                    }}
                  >
                    ⚠️ {formatCurrency(pendingTotal)} em contas fixas pendentes não
                    incluídas
                  </p>
                )}
              </>
            )}
          </div>
        );
      })()}

      </div>{/* /home-left-col */}
      <div className="home-right-col">

      {/* ── 8. CONTAS DO MÊS ────────────────────────────────────────────────── */}
      {isCurrentMonth && (obligations.length > 0 || activeIncomeRecs.length > 0) && (
        <div
          ref={contasMesRef}
          style={{ margin: '16px 16px 0', ...(mounted ? anim(350) : hidden) }}
        >
          {/* Section header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              Contas do mês
            </p>
            {/* Badge conta apenas despesas fixas pendentes — receitas como
                Salário aparecem na lista, mas nunca no count de pendentes. */}
            {pendingObligations.length > 0 && (
              <span
                style={{
                  background: 'var(--yellow-bg)',
                  color: 'var(--yellow-text)',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 20,
                }}
              >
                {pendingObligations.length} pendente
                {pendingObligations.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Card list */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              overflow: 'hidden',
            }}
          >
            {(() => {
              type RowItem =
                | { kind: 'obligation'; ob: MonthlyObligation }
                | { kind: 'income'; rec: RecurringExpense; received: boolean };

              const sortByDay = (a: RecurringExpense, b: RecurringExpense) =>
                (a.dayOfMonth ?? 99) - (b.dayOfMonth ?? 99);
              const sortObByDue = (a: MonthlyObligation, b: MonthlyObligation) =>
                (a.dueDay ?? 99) - (b.dueDay ?? 99);

              const pendingObligationsRows = pendingObligations.slice().sort(sortObByDue);

              const pendingIncomeRows = activeIncomeRecs
                .filter((r) => !receivedIncomeRecIds.has(r.id))
                .filter((r) => isDayReachedForRec(r.dayOfMonth))
                .sort(sortByDay);

              const rows: RowItem[] = [
                ...pendingIncomeRows.map((r): RowItem => ({ kind: 'income', rec: r, received: false })),
                ...pendingObligationsRows.map((o): RowItem => ({ kind: 'obligation', ob: o })),
                ...activeIncomeRecs
                  .filter((r) => receivedIncomeRecIds.has(r.id))
                  .sort(sortByDay)
                  .map((r): RowItem => ({ kind: 'income', rec: r, received: true })),
                ...obligations
                  .filter((o) => o.status === 'paid')
                  .sort(sortObByDue)
                  .map((o): RowItem => ({ kind: 'obligation', ob: o })),
              ];
              const visible = rows.slice(0, 3);

              return (
                <>
                  <div>
                    {visible.map((item, idx) => {
                      const isLast = idx === visible.length - 1 && rows.length <= 3;
                      const borderStyle = isLast
                        ? {}
                        : { borderBottom: '1px solid var(--border-2)' };

                      if (item.kind === 'income') {
                        const { rec, received } = item;
                        const cfg = CATEGORY_CONFIG[rec.category as Category];
                        const isReceiving = receivingIds.has(rec.id);
                        return (
                          <div
                            key={`income-${rec.id}`}
                            style={{
                              padding: '13px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              opacity: received ? 0.45 : 1,
                              transition: 'opacity 0.2s',
                              ...borderStyle,
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
                                fontSize: 18,
                                flexShrink: 0,
                              }}
                            >
                              {cfg?.icon ?? '💰'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  fontSize: 14,
                                  fontWeight: 700,
                                  color: 'var(--text)',
                                  margin: 0,
                                  textDecoration: received ? 'line-through' : 'none',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {rec.description
                                  ? rec.description.charAt(0).toUpperCase() +
                                    rec.description.slice(1)
                                  : ''}
                              </p>
                              {!received && (
                                <p
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--text-3)',
                                    marginTop: 2,
                                  }}
                                >
                                  {typeof rec.dayOfMonth === 'number' &&
                                  rec.dayOfMonth >= 1 &&
                                  rec.dayOfMonth <= 31
                                    ? `Recebimento dia ${rec.dayOfMonth}`
                                    : 'Recebimento mensal'}
                                </p>
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 800,
                                color: received ? 'var(--text-3)' : 'var(--green)',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                textDecoration: received ? 'line-through' : 'none',
                              }}
                            >
                              +{formatCurrency(rec.amount)}
                            </span>
                            {received ? (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: 'var(--green)',
                                  flexShrink: 0,
                                }}
                              >
                                Pago ✓
                              </span>
                            ) : (
                              <button
                                onClick={() => handleConfirmIncome(rec)}
                                disabled={isReceiving}
                                style={{
                                  width: 27,
                                  height: 27,
                                  borderRadius: '50%',
                                  background: 'var(--green-bg)',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                  opacity: isReceiving ? 0.5 : 1,
                                }}
                                title="Confirmar recebimento"
                              >
                                {isReceiving ? (
                                  <Loader2 size={13} color="var(--green)" className="animate-spin" />
                                ) : (
                                  <Check size={13} color="var(--green)" />
                                )}
                              </button>
                            )}
                          </div>
                        );
                      }

                      const { ob } = item;
                      const cfg = CATEGORY_CONFIG[ob.category as Category];
                      const isPaid = ob.status === 'paid';
                      const isPaying = payingIds.has(ob.id);
                      const hasDueDay =
                        typeof ob.dueDay === 'number' && ob.dueDay >= 1 && ob.dueDay <= 31;
                      const daysLate =
                        !isPaid && hasDueDay && todayDay > ob.dueDay!
                          ? todayDay - ob.dueDay!
                          : 0;
                      const dueToday = !isPaid && hasDueDay && todayDay === ob.dueDay;
                      const dueTomorrow = !isPaid && hasDueDay && ob.dueDay === todayDay + 1;
                      const dueLabelText = isPaid
                        ? ''
                        : !hasDueDay
                        ? '' // sem prazo definido — não mostra "Vence dia X"
                        : daysLate > 0
                        ? `Venceu há ${daysLate} dia${daysLate > 1 ? 's' : ''}`
                        : dueToday
                        ? 'Vence hoje'
                        : dueTomorrow
                        ? 'Vence amanhã'
                        : `Vence dia ${ob.dueDay}`;
                      const dueLabelColor =
                        daysLate > 0
                          ? 'var(--red)'
                          : dueToday
                          ? 'var(--yellow-text)'
                          : 'var(--text-3)';
                      const obRec = recurringExpenses.find(
                        (r) => r.id === ob.recurringExpenseId
                      );
                      const obCardName =
                        obRec?.isCredit && obRec.creditCardId
                          ? creditCards.find((c) => c.id === obRec.creditCardId)?.nome
                          : undefined;

                      return (
                        <div
                          key={ob.id}
                          style={{
                            padding: '13px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            opacity: isPaid ? 0.45 : 1,
                            transition: 'opacity 0.2s',
                            ...(highlighting && !isPaid
                              ? {
                                  background: 'rgba(255,184,0,0.06)',
                                }
                              : {}),
                            ...borderStyle,
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
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            {cfg?.icon ?? '💸'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: 'var(--text)',
                                margin: 0,
                                textDecoration: isPaid ? 'line-through' : 'none',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ob.description
                                ? ob.description.charAt(0).toUpperCase() +
                                  ob.description.slice(1)
                                : ''}
                            </p>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                                marginTop: 2,
                              }}
                            >
                              {!isPaid && (
                                <p
                                  style={{
                                    fontSize: 11,
                                    color: dueLabelColor,
                                    margin: 0,
                                  }}
                                >
                                  {dueLabelText}
                                </p>
                              )}
                              {obCardName && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    background: 'var(--accent-bg)',
                                    color: 'var(--accent)',
                                  }}
                                >
                                  {obCardName}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: isPaid ? 'var(--text-3)' : 'var(--text)',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              textDecoration: isPaid ? 'line-through' : 'none',
                            }}
                          >
                            {formatCurrency(ob.amount)}
                          </span>
                          {isPaid ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: 'var(--green)',
                                flexShrink: 0,
                              }}
                            >
                              Pago ✓
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                const rec = recurringExpenses.find(
                                  (r) => r.id === ob.recurringExpenseId
                                );
                                if (rec?.isVariable) {
                                  setVariablePayModal({
                                    obligationId: ob.id,
                                    estimatedAmount: ob.amount,
                                  });
                                  setVariableAmount(String(ob.amount));
                                } else {
                                  handleMarkObligationPaid(ob.id);
                                }
                              }}
                              disabled={isPaying}
                              style={{
                                width: 27,
                                height: 27,
                                borderRadius: '50%',
                                background: 'var(--accent-bg)',
                                border: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                                opacity: isPaying ? 0.5 : 1,
                              }}
                              title="Marcar como pago"
                            >
                              {isPaying ? (
                                <Loader2 size={13} color="var(--accent)" className="animate-spin" />
                              ) : (
                                <Check size={13} color="var(--accent)" />
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {rows.length > 3 && (
                    <Link
                      href="/recorrentes"
                      style={{
                        display: 'block',
                        padding: '12px 16px',
                        color: 'var(--accent)',
                        fontSize: 13,
                        fontWeight: 700,
                        textDecoration: 'none',
                        borderTop: '1px solid var(--border-2)',
                      }}
                    >
                      Ver todas as {rows.length} contas →
                    </Link>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── 8B. TOP GASTOS (desktop only) ───────────────────────────────────── */}
      {topExpenses.length > 0 && (
        <div
          className="hidden lg:block"
          style={{
            margin: '16px 16px 0',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            overflow: 'hidden',
            ...(mounted ? anim(375) : hidden),
          }}
        >
          <div style={{ padding: '14px 16px 10px' }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              Top gastos
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
              Maiores valores deste mês
            </p>
          </div>
          <div>
            {topExpenses.map((e, idx) => {
              const max = topExpenses[0]?.total || 1;
              const pct = Math.max(8, Math.round((e.total / max) * 100));
              return (
                <div
                  key={`${e.description}-${idx}`}
                  style={{
                    padding: '10px 16px',
                    borderTop: '1px solid var(--border-2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      {e.description}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: 'var(--text)',
                        flexShrink: 0,
                      }}
                    >
                      {formatCurrency(e.total)}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      background: 'var(--border-2)',
                      borderRadius: 2,
                      marginTop: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: mounted ? `${pct}%` : '0%',
                        background: 'var(--accent)',
                        borderRadius: 2,
                        transition: 'width 600ms ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 9. INSIGHTS PERSONALIZADOS ──────────────────────────────────────── */}
      {isCurrentMonth && (
        <div
          style={{
            margin: '12px 16px 0',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            ...(mounted ? anim(400) : hidden),
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: 'var(--accent-bg)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 15,
            }}
          >
            💡
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--text)',
                margin: 0,
                marginBottom: monthInsights.length > 0 ? 6 : 4,
              }}
            >
              Seu mês em números
            </p>
            {monthInsights.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {monthInsights.map((text, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--text-2)',
                      marginTop: i === 0 ? 0 : 4,
                      lineHeight: 1.4,
                    }}
                  >
                    • {text}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', margin: 0, lineHeight: 1.4 }}>
                Lance seus primeiros gastos para ver insights personalizados.
              </p>
            )}
          </div>
        </div>
      )}

      {!subLoading && isFree && (
        <Link
          href="/upgrade"
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent)',
            borderRadius: 12,
            padding: '14px 16px',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            🚀
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              Desbloqueie tudo com o Pro
            </p>
            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-2)', margin: 0, marginTop: 2, lineHeight: 1.4 }}>
              Lançamentos ilimitados, GastôBot, Metas e mais.
            </p>
          </div>
          <span
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            Ver planos
          </span>
        </Link>
      )}

      </div>{/* /home-right-col */}
      </div>{/* /home-content-wrap */}

      {/* ── MODAL: Valor real para despesa variável ──────────────────────────── */}
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
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 4,
              }}
            >
              Confirmar pagamento
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
              Valor estimado: {formatCurrency(variablePayModal.estimatedAmount)} — informe o
              valor real pago
            </p>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-2)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Valor pago (R$)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoFocus
              value={variableAmount}
              onChange={(e) => setVariableAmount(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                outline: 'none',
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setVariablePayModal(null)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
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

      {/* ── MODAL: Configurar orçamento (P5) ─────────────────────────────────── */}
      {budgetModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          style={{ padding: 16 }}
          onClick={() => !savingBudget && setBudgetModalOpen(false)}
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
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
              Configurar orçamento
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
              {getMonthLabel(period)}
            </p>

            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-2)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Renda esperada (R$)
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              autoFocus
              value={budgetIncomeInput}
              onChange={(e) => setBudgetIncomeInput(e.target.value)}
              placeholder="0,00"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                outline: 'none',
                marginBottom: 14,
              }}
            />

            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-2)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Meta de poupança (R$){' '}
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>· opcional</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={budgetGoalInput}
              onChange={(e) => setBudgetGoalInput(e.target.value)}
              placeholder="0,00"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--text)',
                outline: 'none',
                marginBottom: 14,
              }}
            />

            {budgetError && (
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--red)',
                  background: 'var(--red-bg)',
                  borderRadius: 'var(--r-sm)',
                  padding: '10px 14px',
                  textAlign: 'center',
                  marginBottom: 14,
                }}
              >
                {budgetError}
              </p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setBudgetModalOpen(false)}
                disabled={savingBudget}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: savingBudget ? 'default' : 'pointer',
                  opacity: savingBudget ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBudget}
                disabled={savingBudget}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: savingBudget ? 'default' : 'pointer',
                  opacity: savingBudget ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {savingBudget ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Fatura vence hoje ─────────────────────────────────────────── */}
      {cardVencimentoAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 360,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 4,
              }}
            >
              💳 Fatura do {cardVencimentoAlert.card.nome} vence hoje
            </p>
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-2)',
                marginBottom: 20,
              }}
            >
              {formatCurrency(cardVencimentoAlert.fatura)} — deseja registrar o pagamento?
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setCardVencimentoAlert(null)}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-2)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Lembrar depois
              </button>
              <button
                onClick={() =>
                  handlePayFatura(cardVencimentoAlert.card, cardVencimentoAlert.fatura)
                }
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: 'none',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Pagar agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DRAWER: Notificações ─────────────────────────────────────────────── */}
      <NotificationsDrawer
        isOpen={showNotifDrawer}
        onClose={() => setShowNotifDrawer(false)}
        notifications={notifications}
        readIds={readIds}
        unreadCount={unreadCount}
        markAsRead={markAsRead}
        markAllAsRead={markAllAsRead}
      />

      {/* ── MODAL: Fechamento de mês ─────────────────────────────────────────── */}
      {showMonthlyClose && (
        <MonthlyCloseModal
          prevMonthLabel={prevMonthLabelCapitalized}
          income={prevMonthIncome}
          spent={prevMonthSpent}
          topCategory={prevMonthTopCat}
          monthlyPlan={prevMonthlyPlan}
          onClose={handleCloseMonthlyClose}
          onViewHistory={handleViewMonthHistory}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </main>
  );
}
