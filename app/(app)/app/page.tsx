'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useNotifications } from '@/lib/useNotifications';
import NotificationsDrawer from '@/components/NotificationsDrawer';
import { OPEN_NOTIF_EVENT } from '@/components/TopbarMobile';
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
  checkAndGenerateIncomeEntries,
  markObligationAsPaid,
  addExpense,
  getAllGoalContributions,
  getCreditCards,
  faturaFromExpenses,
} from '@/lib/storage';
import { getCachedUser } from '@/lib/dataCache';
import { createClient } from '@/lib/supabase/client';
import {
  calculateTotalByType,
  formatCurrency,
  getMonthKey,
} from '@/lib/calculations';
import { getFinancialCurrentPeriod, getFinancialPeriodLabel } from '@/lib/financialPeriod';
import { usePeriod } from '@/lib/periodContext';
import { calculateStreak } from '@/lib/streak';
import { useStreak } from '@/lib/hooks/useStreak';
import {
  Budget,
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
import { anim, hidden } from '../_components/home/_anim';
import SaldoCard from '../_components/home/SaldoCard';
import EntradaSaidaCards from '../_components/home/EntradaSaidaCards';
import FaturaAlertCard from '../_components/home/FaturaAlertCard';
import CartaoCard from '../_components/home/CartaoCard';
import OrcamentoCard from '../_components/home/OrcamentoCard';
import MissaoCard from '../_components/home/MissaoCard';
import ReservaCard from '../_components/home/ReservaCard';
import CompromissosCard from '../_components/home/CompromissosCard';
import ContasDoMes from '../_components/home/ContasDoMes';
import InsightsCard from '../_components/home/InsightsCard';
import AnomaliaCard from '../_components/home/AnomaliaCard';
import HomeModals from '../_components/home/HomeModals';

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { period, setPeriod } = usePeriod();
  const { isFree, loading: subLoading } = useSubscription();
  const { currentStreak } = useStreak();

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
  const [variableAmount, setVariableAmount] = useState(0);
  // P5: modal inline para configurar renda/meta sem sair da tela inicial.
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetIncomeInput, setBudgetIncomeInput] = useState(0);
  const [budgetGoalInput, setBudgetGoalInput] = useState(0);
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
  const [financialStartDay, setFinancialStartDay] = useState<number | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  // ── Data loading ───────────────────────────────────────────────────────────
  async function loadData() {
    const currentMonth = getMonthKey(new Date());
    setLoadError(null);
    try {
      const [exp, bud, rec, obs, contrib, cards] = await retryAsync(() =>
        Promise.all([
          // checkAndGenerateIncomeEntries roda antes de getExpenses para que
          // o salário recorrente vencido apareça já no primeiro render.
          checkAndGenerateIncomeEntries().then(() => getExpenses()),
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
        // Deriva a fatura dos expenses já carregados — zero query extra
        // (antes: 1 getCreditCardFatura por cartão).
        setCardFaturas(
          cards.map((card) => ({
            card,
            total: faturaFromExpenses(exp, card.id, currentMonth),
          }))
        );
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
        const user = await getCachedUser();
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
          .select('avatar_url, avatar_emoji, financial_start_day')
          .eq('id', user.id)
          .single();
        if (profile) {
          setProfileAvatarUrl(profile.avatar_url ?? null);
          setProfileAvatarEmoji(profile.avatar_emoji ?? null);
          const fsDay = (profile.financial_start_day as number | null) ?? null;
          setFinancialStartDay(fsDay);
          const financialPeriod = getFinancialCurrentPeriod(fsDay);
          if (period === getMonthKey(new Date()) && financialPeriod !== period) {
            setPeriod(financialPeriod);
          }
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
        const month = getMonthKey(new Date());
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

  // Sino da TopbarMobile dispara este evento quando o usuário já está em /app
  // (router.push noop) — assim o drawer abre sem precisar recarregar a página.
  useEffect(() => {
    const open = () => setShowNotifDrawer(true);
    window.addEventListener(OPEN_NOTIF_EVENT, open);
    return () => window.removeEventListener(OPEN_NOTIF_EVENT, open);
  }, []);

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
    // Edge cases: fatura zerada e pagamento já em andamento.
    if (faturaTotal <= 0 || payingFaturaId === card.id) return;
    setPayingFaturaId(card.id);
    try {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const ref = `${mm}/${now.getFullYear()}`;
      // O alerta de vencimento paga sempre a fatura do mês corrente.
      const billingMonth = `${now.getFullYear()}-${mm}-01`;
      const expense = await addExpense({
        type: 'expense',
        amount: faturaTotal,
        description: `Pagamento fatura ${card.nome} ${ref}`,
        category: 'Cartão de Crédito',
        date: now.toISOString().slice(0, 10),
        // Saída de caixa (débito), não lançamento da própria fatura.
        // billingMonth amarra o pagamento à fatura para getCreditCardFatura abatê-lo.
        isCredit: false,
        creditCardId: card.id,
        billingMonth,
      });
      // Atualiza estado local → saldo e orçamento livre recalculam na hora.
      setExpenses((prev) => [expense, ...prev]);
      setCardFaturas((prev) =>
        prev.map((cf) => (cf.card.id === card.id ? { ...cf, total: 0 } : cf))
      );
      setCardVencimentoAlert(null);
      addToast('Fatura paga! Lançamento registrado.', 'success');
    } catch (err) {
      // Erro de rede / constraint: mensagem legível e mantém o alerta
      // aberto para nova tentativa (não zera a fatura nem fecha o modal).
      addToast(getErrorMessage(err), 'error');
    } finally {
      setPayingFaturaId(null);
    }
  }

  // P5: salva renda/meta do mês selecionado e atualiza o bloco em tempo real.
  async function handleSaveBudget() {
    setBudgetError('');
    const incomeValue = budgetIncomeInput;
    if (!incomeValue || incomeValue <= 0) {
      setBudgetError('Informe uma renda mensal maior que zero.');
      return;
    }
    const goalValue = budgetGoalInput || 0;
    if (goalValue > incomeValue) {
      setBudgetError('A meta de poupança não pode ser maior que a renda.');
      return;
    }
    setSavingBudget(true);
    try {
      const plan = await upsertMonthlyPlan(period, incomeValue, goalValue);
      setMonthlyPlan(plan);
      setBudgetModalOpen(false);
      setBudgetIncomeInput(0);
      setBudgetGoalInput(0);
      addToast('Orçamento configurado!');
    } catch (err) {
      setBudgetError(getErrorMessage(err));
    } finally {
      setSavingBudget(false);
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const now = new Date();
  const isCurrentMonth = period === getFinancialCurrentPeriod(financialStartDay);
  const isFutureMonth = period > getMonthKey(now);

  const [periodYear, periodMonth] = period.split('-').map(Number);
  const totalDaysInMonth = new Date(periodYear, periodMonth, 0).getDate();
  const todayDay = isCurrentMonth ? now.getDate() : totalDaysInMonth;
  const daysRemaining = isCurrentMonth ? totalDaysInMonth - todayDay : 0;
  const daysForLimit = isCurrentMonth
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
    : 0;

  // 'Saldo inicial' é uma âncora de sistema (positiva ou negativa) que ajusta
  // o saldo cumulativo para bater com o que o user informou no onboarding —
  // não é um movimento real do mês e portanto fica de fora de ENTROU/SAIU.
  const periodEntries = expenses.filter(
    (e) => e.date.slice(0, 7) === period && e.category !== 'Saldo inicial',
  );
  const income = calculateTotalByType(periodEntries, 'income');
  const spent = calculateTotalByType(periodEntries, 'expense');
  // Soma das COMPRAS no crédito do período. NÃO incluir o pagamento de
  // fatura aqui: este valor é usado em debitSpent para tirar as compras de
  // crédito do gasto em caixa (compra no crédito não move caixa até a fatura
  // ser paga; o pagamento, esse sim, entra como débito).
  const periodCreditTotal = periodEntries
    .filter((e) => e.type === 'expense' && e.isCredit === true)
    .reduce((s, e) => s + e.amount, 0);
  const debitSpent = spent - periodCreditTotal;
  const periodExpenses = periodEntries.filter((e) => e.type === 'expense');
  const periodIncomes = periodEntries.filter((e) => e.type === 'income');

  // "SALDO EM CONTA" é CUMULATIVO, não mensal: representa quanto o user tem em
  // conta ao fim do período em vista, somando todas as entries lançadas (incl.
  // saldo inicial gravado em outro mês). O cálculo antigo `income - debitSpent`
  // do mês isolava o resultado mensal — útil pra "resultado do mês", inútil
  // pra saldo: se o user marcava obrigações como pagas mas o salário ainda
  // estava só como recorrente, ele via saldo negativo (bug do beta tester).
  const todayStr = now.toISOString().slice(0, 10);
  const periodLastDay = `${period}-${String(totalDaysInMonth).padStart(2, '0')}`;
  const currentMonthKey = getMonthKey(now);
  // Fronteira de "realizado": mês passado → fim daquele mês; mês corrente/
  // futuro → hoje. Pra mês futuro, projetamos o restante depois.
  const realizedBoundary = period < currentMonthKey ? periodLastDay : todayStr;
  const cumulativeEntries = expenses.filter((e) => e.date <= realizedBoundary);
  const cumulativeIncome = calculateTotalByType(cumulativeEntries, 'income');
  const cumulativeSpent = calculateTotalByType(cumulativeEntries, 'expense');
  const cumulativeCreditTotal = cumulativeEntries
    .filter((e) => e.type === 'expense' && e.isCredit === true)
    .reduce((s, e) => s + e.amount, 0);
  const cumulativeDebitSpent = cumulativeSpent - cumulativeCreditTotal;
  const realizedBalance = cumulativeIncome - cumulativeDebitSpent;

  // Projeção para mês futuro: soma receitas recorrentes esperadas e subtrai
  // despesas recorrentes esperadas em cada mês entre o corrente e o period
  // (inclusive), descontando o que já foi lançado em cada mês. No mês
  // corrente, só conta o que ainda vai vencer (dayOfMonth > hoje) — o que já
  // venceu virou entry via checkAndGenerateIncomeEntries / obligations.
  let projectedIncome = 0;
  let projectedSpent = 0;
  if (isFutureMonth) {
    const months: string[] = [];
    const cur = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(periodYear, periodMonth - 1, 1);
    while (cur <= end) {
      months.push(getMonthKey(cur));
      cur.setMonth(cur.getMonth() + 1);
    }
    const activeRec = recurringExpenses.filter((r) => r.active);
    for (const m of months) {
      const isCur = m === currentMonthKey;
      const loggedIds = new Set(
        expenses
          .filter((e) => e.date.slice(0, 7) === m && e.recurringExpenseId)
          .map((e) => e.recurringExpenseId as string),
      );
      for (const r of activeRec) {
        if (loggedIds.has(r.id)) continue;
        if (isCur && typeof r.dayOfMonth === 'number' && r.dayOfMonth <= now.getDate()) {
          // Já passou do dia neste mês e ainda não foi lançado — não projeta
          // (assume que o user vai marcar manualmente; auto-gen tenta cobrir
          // o caso de income vencido).
          continue;
        }
        if (r.type === 'income') projectedIncome += r.amount;
        else projectedSpent += r.amount;
      }
    }
  }

  const debitBalance = realizedBalance + projectedIncome - projectedSpent;

  // "Fatura atual" = soma das faturas em aberto de TODOS os cartões.
  // cardFaturas vem de getCreditCardFatura (mês corrente), que já abate os
  // pagamentos — mesma fonte da aba Cartões, então os valores batem.
  const cardsComFatura = cardFaturas.filter((cf) => cf.total > 0);
  const faturasTotal = cardsComFatura.reduce((s, cf) => s + cf.total, 0);
  // 1 cartão com fatura → vai direto ao detalhe; vários → lista.
  const faturaHref =
    cardsComFatura.length === 1
      ? `/cartoes/${cardsComFatura[0].card.id}`
      : '/cartoes';

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

  // Compromissos do mês: fixas (recorrentes sem prazo), dívidas (recorrentes
  // COM total_installments) e variáveis (expenses sem recurringExpenseId).
  // Usa recurringExpenses ativas (não obligations) pra funcionar em qualquer
  // mês — obligations sempre vem do mês corrente.
  const fixedTotal = recurringExpenses
    .filter(
      (r) => r.active && r.type === 'expense' && r.totalInstallments == null,
    )
    .reduce((s, r) => s + r.amount, 0);
  const debtTotal = recurringExpenses
    .filter(
      (r) => r.active && r.type === 'expense' && r.totalInstallments != null,
    )
    .reduce((s, r) => s + r.amount, 0);
  const variableTotal = periodExpenses
    .filter(
      (e) =>
        !e.recurringExpenseId &&
        e.category !== 'Saldo inicial' &&
        e.category !== 'Cartão de Crédito',
    )
    .reduce((s, e) => s + e.amount, 0);
  const showCompromissos = recurringExpenses.length > 0;

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
  // Base do orçamento livre: receita real lançada (income). Quando ainda não há
  // receita no mês, cai pro planejado (heroBase − fixedCosts) para o user que
  // configurou renda esperada mas ainda não recebeu / lançou nada.
  const valorLivreParaGastarPlanejado =
    income > 0 ? income - savingsGoal : heroBase - fixedCosts - savingsGoal;
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
  const periodSlashLabel = (() => {
    const raw = periodDateObj.toLocaleDateString('pt-BR', { month: 'long' });
    return `${raw.charAt(0).toUpperCase()}${raw.slice(1)}/${periodYear}`;
  })();
  const periodLabel = getFinancialPeriodLabel(period, financialStartDay);

  const saldoMode: 'current' | 'past' | 'future' = isCurrentMonth
    ? 'current'
    : isFutureMonth
    ? 'future'
    : 'past';

  // ── Streak badge ───────────────────────────────────────────────────────────
  // Renderizado em dois lugares: no navegador de mês (mobile) e num wrapper
  // próprio em desktop (onde o navegador vive na TopbarDesktop). Mesmo elemento
  // reaproveitado para não duplicar estilos.
  const showStreakBadge = isCurrentMonth && currentStreak >= 2;
  const streakBadge = showStreakBadge ? (
    <div
      className={currentStreak >= 7 && currentStreak < 30 ? 'home-streak-pulse' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: currentStreak >= 30 ? '#EDE9FE' : '#FFF3E0',
        border: `1px solid ${currentStreak >= 30 ? '#A78BFA' : '#FFB74D'}`,
        borderRadius: 20,
        padding: '4px 12px',
        fontSize: 12,
        fontWeight: 700,
        color: currentStreak >= 30 ? '#5B5BD6' : '#E65100',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">{currentStreak >= 30 ? '⚡' : '🔥'}</span>
      <span>{currentStreak} dias seguidos</span>
    </div>
  ) : null;

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
      {/* Wordmark e toggle/sino agora vivem na TopbarMobile global do layout (app). */}

      {/* ── 2. HEADER ──────────────────────────────────────────────────────── */}
      <div
        className="mobile-only"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '18px 22px 0',
          position: 'relative',
          zIndex: 50,
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
          {/* Toggle de tema e sino foram movidos para TopbarMobile (layout app). */}

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

      {/* ── 3. MONTH NAVIGATOR + STREAK BADGE (mobile) ─────────────────────── */}
      <div
        className="mobile-only"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: showStreakBadge ? 'space-between' : 'center',
          gap: 12,
          padding: '20px 16px 0',
          marginBottom: 12,
          ...(mounted ? anim(100) : hidden),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', display: 'block' }}>
              {navigatorLabel}
            </span>
            {periodLabel && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginTop: 1 }}>
                {periodLabel}
              </span>
            )}
          </div>
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

        {streakBadge}
      </div>

      {/* ── 3B. STREAK BADGE (desktop) ─────────────────────────────────────── */}
      {/* Em desktop (≥1024px) o navegador de mês vive na TopbarDesktop e o
          wrapper acima fica oculto (mobile-only); aqui o badge aparece alinhado
          à direita, acima do conteúdo de 2 colunas. */}
      {streakBadge && (
        <div
          className="hidden lg:flex"
          style={{ justifyContent: 'flex-end', marginBottom: 12 }}
        >
          {streakBadge}
        </div>
      )}

      <style>{`
        @keyframes homeStreakPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .home-streak-pulse {
          animation: homeStreakPulse 1.8s ease-in-out infinite;
        }
      `}</style>

      {/* ── DESKTOP 2-COL WRAPPER (no-op em mobile) ───────────────────────── */}
      <div className="home-content-wrap">
      <div className="home-left-col">

      {/* ── 4. SALDO HERO CARD ─────────────────────────────────────────────── */}
      <SaldoCard
        debitBalance={debitBalance}
        income={income}
        spent={spent}
        faturasTotal={faturasTotal}
        faturaHref={faturaHref}
        mode={saldoMode}
        periodLabel={periodSlashLabel}
        mounted={mounted}
      />

      {/* ── 5. GRID RECEITA / DESPESA ───────────────────────────────────────── */}
      <EntradaSaidaCards income={income} spent={spent} mounted={mounted} />

      {/* ── 6B. CARTÃO PRINCIPAL ────────────────────────────────────────────── */}
      {(() => {
        if (cardFaturas.length === 0) return null;
        const principal = cardFaturas.reduce(
          (max, cf) => (cf.total > max.total ? cf : max),
          cardFaturas[0]
        );
        return (
          <CartaoCard
            card={principal.card}
            fatura={principal.total}
            mounted={mounted}
            onPagar={() => handlePayFatura(principal.card, principal.total)}
          />
        );
      })()}

      {/* ── 6. ALERTA CONTAS PENDENTES ──────────────────────────────────────── */}
      {isCurrentMonth && pendingObligations.length > 0 && (
        <FaturaAlertCard
          pendingTotal={pendingTotal}
          pendingCount={pendingObligations.length}
          mounted={mounted}
          onClick={() => {
            contasMesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setHighlighting(true);
            setTimeout(() => setHighlighting(false), 2000);
          }}
        />
      )}

      {/* ── 7. ORÇAMENTO CARD ───────────────────────────────────────────────── */}
      <OrcamentoCard
        valorLivreParaGastarPlanejado={valorLivreParaGastarPlanejado}
        orcamentoRestante={orcamentoRestante}
        debitSpent={debitSpent}
        budgetPct={budgetPct}
        monthlyPlan={monthlyPlan}
        isCurrentMonth={isCurrentMonth}
        daysRemaining={daysRemaining}
        budgetOverflows={budgetOverflows}
        pendingObligations={pendingObligations}
        pendingTotal={pendingTotal}
        mounted={mounted}
        onOpenBudgetModal={() => {
          setBudgetError('');
          setBudgetIncomeInput(monthlyPlan?.expectedIncome ?? 0);
          setBudgetGoalInput(monthlyPlan?.savingsGoal ?? 0);
          setBudgetModalOpen(true);
        }}
      />

      {/* ── 7A. MISSÃO DE POUPANÇA ──────────────────────────────────────────── */}
      {/* Self-fetch via getMission/getContributions (ambos cacheados).
          Renderiza convite ou progresso conforme estado da missão. */}
      <MissaoCard mounted={mounted} />

      {/* ── 7C. RESERVA DE EMERGÊNCIA ──────────────────────────────────────────── */}
      {/* Self-fetch via getMonthlyBaseCost + getGoals. Educativo para FREE
          (Pro-gate só dispara no /metas). Não renderiza se source='none'. */}
      <ReservaCard mounted={mounted} />

      {/* ── 7B. COMPROMISSOS DO MÊS ──────────────────────────────────────────── */}
      {showCompromissos && (
        <CompromissosCard
          fixedTotal={fixedTotal}
          debtTotal={debtTotal}
          variableTotal={variableTotal}
          income={heroBase}
          mounted={mounted}
        />
      )}

      </div>{/* /home-left-col */}
      <div className="home-right-col">

      {/* ── 8. CONTAS DO MÊS ────────────────────────────────────────────────── */}
      {isCurrentMonth && (obligations.length > 0 || activeIncomeRecs.length > 0) && (
        <ContasDoMes
          obligations={obligations}
          pendingObligations={pendingObligations}
          activeIncomeRecs={activeIncomeRecs}
          recurringExpenses={recurringExpenses}
          creditCards={creditCards}
          receivedIncomeRecIds={receivedIncomeRecIds}
          todayDay={todayDay}
          payingIds={payingIds}
          receivingIds={receivingIds}
          highlighting={highlighting}
          mounted={mounted}
          sectionRef={contasMesRef}
          onConfirmIncome={handleConfirmIncome}
          onMarkObligationPaid={handleMarkObligationPaid}
          onOpenVariablePay={(obligationId, estimatedAmount) => {
            setVariablePayModal({ obligationId, estimatedAmount });
            setVariableAmount(estimatedAmount);
          }}
        />
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
        <InsightsCard
          expenses={expenses}
          period={period}
          income={income}
          debitSpent={debitSpent}
          budgetPct={budgetPct}
          mounted={mounted}
        />
      )}

      {/* ── FB3. ANOMALIA DE GASTO ──────────────────────────────────────────── */}
      {isCurrentMonth && <AnomaliaCard mounted={mounted} />}

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

      <HomeModals
        variablePayModal={variablePayModal}
        variableAmount={variableAmount}
        onVariableAmountChange={setVariableAmount}
        onCancelVariablePay={() => setVariablePayModal(null)}
        onConfirmVariablePay={() => {
          if (!variablePayModal) return;
          const parsed = variableAmount;
          if (!parsed || parsed <= 0) return;
          const id = variablePayModal.obligationId;
          setVariablePayModal(null);
          handleMarkObligationPaid(id, parsed);
        }}
        budgetModalOpen={budgetModalOpen}
        budgetIncomeInput={budgetIncomeInput}
        budgetGoalInput={budgetGoalInput}
        onBudgetIncomeChange={setBudgetIncomeInput}
        onBudgetGoalChange={setBudgetGoalInput}
        budgetError={budgetError}
        savingBudget={savingBudget}
        onCancelBudget={() => setBudgetModalOpen(false)}
        onSaveBudget={handleSaveBudget}
        period={period}
        cardVencimentoAlert={cardVencimentoAlert}
        onDismissCardAlert={() => setCardVencimentoAlert(null)}
        onPayFatura={handlePayFatura}
      />

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
