import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';
import { calculateStreak } from '@/lib/streak';
import { BADGE_DEFINITIONS } from '@/lib/badges';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import type { Category } from '@/lib/types';

const MONTHLY_PRICE = 19.9;
const ANNUAL_PRICE = 147;

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const admin = createAdminClient();

  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const userEmailMap = new Map<string, string>(
    allUsers.map(u => [u.id, u.email ?? '—']),
  );

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 14);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // ─── USUÁRIOS ─────────────────────────────────────────────────
  const total = allUsers.length;
  const confirmed = allUsers.filter(u => u.email_confirmed_at).length;
  const unconfirmed = total - confirmed;
  const today = allUsers.filter(u => new Date(u.created_at) >= todayStart).length;
  const thisWeek = allUsers.filter(u => new Date(u.created_at) >= weekStart).length;
  const thisMonth = allUsers.filter(u => new Date(u.created_at) >= monthStart).length;
  const completedOnboarding = allUsers.filter(u => u.user_metadata?.onboarding_completed === true).length;
  const skippedOnboarding = total - completedOnboarding;

  const dau24h = allUsers.filter(
    u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= oneDayAgo,
  ).length;

  // ─── LANÇAMENTOS ──────────────────────────────────────────────
  const { data: expenses } = await admin
    .from('expenses')
    .select('user_id, date, category, type');
  const totalLaunches = expenses?.length ?? 0;
  const avgPerUser = total > 0 ? Math.round((totalLaunches / total) * 10) / 10 : 0;

  const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  for (const e of (expenses ?? [])) byDayOfWeek[new Date(e.date).getDay()]++;

  const thisWeekLaunches = (expenses ?? []).filter(e => new Date(e.date) >= weekStart).length;
  const prevWeekLaunches = (expenses ?? []).filter(e => {
    const d = new Date(e.date);
    return d >= prevWeekStart && d < weekStart;
  }).length;
  const weekGrowth = prevWeekLaunches > 0
    ? Math.round(((thisWeekLaunches - prevWeekLaunches) / prevWeekLaunches) * 100)
    : thisWeekLaunches > 0 ? 100 : 0;

  // Top categorias (apenas type='expense')
  const catCount = new Map<string, number>();
  for (const e of (expenses ?? [])) {
    if (e.type === 'expense' && e.category) {
      catCount.set(e.category, (catCount.get(e.category) ?? 0) + 1);
    }
  }
  const topCategories = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({
      category,
      emoji: CATEGORY_CONFIG[category as Category]?.icon ?? '📦',
      count,
    }));

  // Por usuário: expenses agrupadas + último lançamento
  const userExpenses = new Map<string, { date: string }[]>();
  const userLastLaunch = new Map<string, Date>();
  for (const e of (expenses ?? [])) {
    if (!userExpenses.has(e.user_id)) userExpenses.set(e.user_id, []);
    userExpenses.get(e.user_id)!.push({ date: e.date });
    const d = new Date(e.date);
    const prev = userLastLaunch.get(e.user_id);
    if (!prev || d > prev) userLastLaunch.set(e.user_id, d);
  }

  // Top streaks (consecutivos a partir de hoje)
  const topStreaks = [...userExpenses.entries()]
    .map(([uid, exps]) => ({
      email: userEmailMap.get(uid) ?? '—',
      streak: calculateStreak(exps),
    }))
    .filter(x => x.streak > 0)
    .sort((a, b) => b.streak - a.streak)
    .slice(0, 10);

  // Retenção: classifica por última atividade
  let active7d = 0;
  let risk7to14 = 0;
  let lost14plus = 0;
  for (const u of allUsers) {
    const last = userLastLaunch.get(u.id);
    if (!last) { lost14plus++; continue; }
    if (last >= sevenDaysAgo) active7d++;
    else if (last >= fourteenDaysAgo) risk7to14++;
    else lost14plus++;
  }

  // ─── RECORRENTES / CARTÃO / CSV ───────────────────────────────
  const { data: recurringRows } = await admin.from('recurring_expenses').select('user_id');
  const withRecurring = new Set(recurringRows?.map(r => r.user_id) ?? []).size;

  const { data: cardRows } = await admin.from('credit_cards').select('user_id');
  const withCreditCard = new Set(cardRows?.map(r => r.user_id) ?? []).size;
  const totalCards = cardRows?.length ?? 0;

  const { data: csvRows } = await admin.from('expenses').select('user_id').eq('source', 'csv');
  const withCSVImport = new Set(csvRows?.map(r => r.user_id) ?? []).size;

  // Usuários sem lançamentos / em risco (proxy legado)
  const usersWithLaunches = new Set(userExpenses.keys());
  const neverLaunchedUsers = allUsers.filter(u => !usersWithLaunches.has(u.id));

  const recentlyActive = new Set(
    (expenses ?? []).filter(e => new Date(e.date) >= sevenDaysAgo).map(e => e.user_id),
  );
  const inactiveRiskUsers = allUsers.filter(u => {
    return new Date(u.created_at) < sevenDaysAgo && !recentlyActive.has(u.id);
  });

  // ─── ASSINATURAS ──────────────────────────────────────────────
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id, plan, status, billing_cycle, updated_at, created_at, current_period_end');

  const subsArr = subs ?? [];
  const proActive = subsArr.filter(s => s.plan === 'pro' && s.status === 'active');

  const monthlyCount = proActive.filter(s => s.billing_cycle === 'monthly').length;
  const annualCount = proActive.filter(s => s.billing_cycle === 'annual').length;
  const manualCount = proActive.filter(s => s.billing_cycle === 'manual').length;
  const betaCount = proActive.filter(s => s.billing_cycle === 'beta').length;
  const couponCount = proActive.filter(s => s.billing_cycle === 'coupon').length;

  const mrrMonthly = monthlyCount * MONTHLY_PRICE;
  const mrrAnnual = annualCount * (ANNUAL_PRICE / 12);
  const mrr = mrrMonthly + mrrAnnual;

  const totalProActive = proActive.length;
  const conversionRate = total > 0 ? Math.round((totalProActive / total) * 1000) / 10 : 0;

  // Churn do mês
  const churnedSubs = subsArr.filter(s =>
    s.status === 'cancelled' && s.updated_at && new Date(s.updated_at) >= monthStart,
  );
  const churnedThisMonth = churnedSubs.length;
  const churnList = churnedSubs.map(s => ({
    user_id: s.user_id,
    email: userEmailMap.get(s.user_id) ?? '—',
    cancelledAt: s.updated_at,
    billing_cycle: s.billing_cycle,
  }));

  // MRR do mês anterior: subs pro que existiam antes do mês corrente e
  // continuaram ativas até pelo menos o fim do mês anterior (ou seja, ainda
  // não tinham sido canceladas naquele momento).
  const proActivePrevMonth = subsArr.filter(s => {
    if (s.plan !== 'pro') return false;
    if (!s.created_at || new Date(s.created_at) >= monthStart) return false;
    if (s.status === 'active') return true;
    if (s.status === 'cancelled' && s.updated_at && new Date(s.updated_at) >= monthStart) return true;
    return false;
  });
  const mrrPrevMonth =
    proActivePrevMonth.filter(s => s.billing_cycle === 'monthly').length * MONTHLY_PRICE +
    proActivePrevMonth.filter(s => s.billing_cycle === 'annual').length * (ANNUAL_PRICE / 12);

  // Lista de Pro ativos (ordenada por valor mensal)
  const proList = proActive.map(s => ({
    user_id: s.user_id,
    email: userEmailMap.get(s.user_id) ?? '—',
    billing_cycle: s.billing_cycle,
    since: s.updated_at ?? s.created_at ?? null,
    monthlyValue:
      s.billing_cycle === 'monthly' ? MONTHLY_PRICE :
      s.billing_cycle === 'annual' ? Math.round((ANNUAL_PRICE / 12) * 100) / 100 :
      0,
  })).sort((a, b) => b.monthlyValue - a.monthlyValue);

  // ─── MISSÕES ──────────────────────────────────────────────────
  let missionActiveCount = 0;
  let missionAvgProgress = 0;
  let userIdsWithActiveMission = new Set<string>();
  try {
    const { data: activeMissions } = await admin
      .from('savings_missions')
      .select('id, user_id, target_amount')
      .eq('status', 'active');
    if (activeMissions && activeMissions.length > 0) {
      missionActiveCount = activeMissions.length;
      userIdsWithActiveMission = new Set(activeMissions.map(m => m.user_id));

      const missionIds = activeMissions.map(m => m.id);
      const { data: contribs } = await admin
        .from('mission_contributions')
        .select('mission_id, amount')
        .in('mission_id', missionIds);
      const savedByMission = new Map<string, number>();
      for (const c of (contribs ?? [])) {
        savedByMission.set(c.mission_id, (savedByMission.get(c.mission_id) ?? 0) + Number(c.amount));
      }
      const progresses = activeMissions.map(m => {
        const target = Number(m.target_amount);
        const saved = savedByMission.get(m.id) ?? 0;
        return target > 0 ? Math.min(100, (saved / target) * 100) : 0;
      });
      missionAvgProgress = progresses.length > 0
        ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length)
        : 0;
    }
  } catch {
    // mantém defaults zerados
  }

  // Top badges
  let topBadges: { key: string; emoji: string; name: string; count: number }[] = [];
  try {
    const { data: badges } = await admin
      .from('mission_badges')
      .select('badge_key');
    if (badges) {
      const badgeCount = new Map<string, number>();
      for (const b of badges) {
        const k = b.badge_key as string;
        badgeCount.set(k, (badgeCount.get(k) ?? 0) + 1);
      }
      topBadges = [...badgeCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([key, count]) => {
          const def = BADGE_DEFINITIONS[key];
          return {
            key,
            emoji: def?.emoji ?? '🏅',
            name: def?.name ?? key,
            count,
          };
        });
    }
  } catch {
    topBadges = [];
  }

  // ─── FUNIL ────────────────────────────────────────────────────
  const funnel = {
    signup: total,
    confirmed,
    launched: usersWithLaunches.size,
    mission: userIdsWithActiveMission.size,
    pro: totalProActive,
  };

  // ─── SIGN-UPS POR SEMANA (últimas 8 semanas, segunda → segunda) ───
  const signupsByWeek: { weekStart: string; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 7 * i);
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const count = allUsers.filter(u => {
      const c = new Date(u.created_at);
      return c >= start && c < end;
    }).length;
    signupsByWeek.push({
      weekStart: start.toISOString().slice(0, 10),
      count,
    });
  }

  return NextResponse.json({
    users: {
      total, confirmed, unconfirmed, today, thisWeek, thisMonth,
      completedOnboarding, skippedOnboarding,
      withRecurring, withCreditCard, withCSVImport,
      neverLaunched: neverLaunchedUsers.length,
      inactiveRisk: inactiveRiskUsers.length,
      dau24h,
      active7d,
      risk7to14,
      lost14plus,
      withMission: userIdsWithActiveMission.size,
    },
    launches: {
      total: totalLaunches,
      avgPerUser,
      byDayOfWeek,
      weekGrowth,
      topCategories,
    },
    cards: { total: totalCards },
    revenue: {
      mrr: Math.round(mrr * 100) / 100,
      mrrPrevMonth: Math.round(mrrPrevMonth * 100) / 100,
      mrrMonthly: Math.round(mrrMonthly * 100) / 100,
      mrrAnnual: Math.round(mrrAnnual * 100) / 100,
      totalProActive,
      breakdown: {
        monthly: monthlyCount,
        annual: annualCount,
        manual: manualCount,
        beta: betaCount,
        coupon: couponCount,
      },
      conversionRate,
      churnedThisMonth,
      proList,
      churnList,
    },
    churn: {
      neverLaunched: neverLaunchedUsers.map(u => ({
        user_id: u.id,
        email: u.email,
        created_at: u.created_at,
      })),
      inactiveRisk: inactiveRiskUsers.map(u => {
        const lastDate = userLastLaunch.get(u.id);
        return {
          user_id: u.id,
          email: u.email,
          created_at: u.created_at,
          lastLaunch: lastDate ? lastDate.toISOString().slice(0, 10) : null,
        };
      }),
    },
    funnel,
    signupsByWeek,
    topStreaks,
    missions: {
      activeCount: missionActiveCount,
      avgProgressPercent: missionAvgProgress,
      topBadges,
    },
  });
}
