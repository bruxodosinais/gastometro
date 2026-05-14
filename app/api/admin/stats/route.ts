import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const admin = createAdminClient();

  // Buscar todos os usuários via auth admin
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 });

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const prevWeekStart = new Date(weekStart); prevWeekStart.setDate(prevWeekStart.getDate() - 7);

  const total = allUsers.length;
  const confirmed = allUsers.filter(u => u.email_confirmed_at).length;
  const unconfirmed = total - confirmed;
  const today = allUsers.filter(u => new Date(u.created_at) >= todayStart).length;
  const thisWeek = allUsers.filter(u => new Date(u.created_at) >= weekStart).length;
  const thisMonth = allUsers.filter(u => new Date(u.created_at) >= monthStart).length;

  // Onboarding stats from user_metadata
  const completedOnboarding = allUsers.filter(u => u.user_metadata?.onboarding_completed === true).length;
  const skippedOnboarding = total - completedOnboarding;

  // Lançamentos (expenses)
  const { data: expenses } = await admin.from('expenses').select('user_id, date');
  const totalLaunches = expenses?.length ?? 0;
  const avgPerUser = total > 0 ? Math.round((totalLaunches / total) * 10) / 10 : 0;

  // Agrupar por dia da semana (0=Dom, 6=Sáb)
  const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  for (const e of (expenses ?? [])) {
    const d = new Date(e.date);
    byDayOfWeek[d.getDay()]++;
  }

  // Crescimento semana a semana
  const thisWeekLaunches = (expenses ?? []).filter(e => new Date(e.date) >= weekStart).length;
  const prevWeekLaunches = (expenses ?? []).filter(e => {
    const d = new Date(e.date);
    return d >= prevWeekStart && d < weekStart;
  }).length;
  const weekGrowth = prevWeekLaunches > 0
    ? Math.round(((thisWeekLaunches - prevWeekLaunches) / prevWeekLaunches) * 100)
    : thisWeekLaunches > 0 ? 100 : 0;

  // Usuários com recorrentes
  const { data: recurringRows } = await admin.from('recurring_expenses').select('user_id');
  const withRecurring = new Set(recurringRows?.map(r => r.user_id) ?? []).size;

  // Usuários com cartão
  const { data: cardRows } = await admin.from('credit_cards').select('user_id');
  const withCreditCard = new Set(cardRows?.map(r => r.user_id) ?? []).size;
  const totalCards = cardRows?.length ?? 0;

  // Usuários com CSV importado (campo is_imported=true ou source='csv')
  const { data: csvRows } = await admin.from('expenses').select('user_id').eq('source', 'csv');
  const withCSVImport = new Set(csvRows?.map(r => r.user_id) ?? []).size;

  // Usuários que nunca lançaram
  const usersWithLaunches = new Set((expenses ?? []).map(e => e.user_id));
  const neverLaunchedUsers = allUsers.filter(u => !usersWithLaunches.has(u.id));

  // Usuários em risco de churn: cadastrado há 7+ dias sem lançamento nos últimos 7 dias
  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);
  const recentlyActive = new Set(
    (expenses ?? []).filter(e => new Date(e.date) >= sevenDaysAgo).map(e => e.user_id)
  );
  const inactiveRiskUsers = allUsers.filter(u => {
    const registeredBefore7Days = new Date(u.created_at) < sevenDaysAgo;
    return registeredBefore7Days && !recentlyActive.has(u.id);
  });

  // Receita / assinaturas
  const { data: subs } = await admin
    .from('subscriptions')
    .select('plan, status, billing_cycle, updated_at');

  const subsArr = subs ?? [];
  const proActive = subsArr.filter(s => s.plan === 'pro' && s.status === 'active');

  const monthlyCount = proActive.filter(s => s.billing_cycle === 'monthly').length;
  const annualCount = proActive.filter(s => s.billing_cycle === 'annual').length;
  const manualCount = proActive.filter(s => s.billing_cycle === 'manual').length;
  const betaCount = proActive.filter(s => s.billing_cycle === 'beta').length;
  const couponCount = proActive.filter(s => s.billing_cycle === 'coupon').length;

  const MONTHLY_PRICE = 19.9;
  const ANNUAL_PRICE = 147;
  const mrrMonthly = monthlyCount * MONTHLY_PRICE;
  const mrrAnnual = annualCount * (ANNUAL_PRICE / 12);
  const mrr = mrrMonthly + mrrAnnual;

  const totalProActive = proActive.length;
  const conversionRate = total > 0 ? Math.round((totalProActive / total) * 1000) / 10 : 0;

  const churnedThisMonth = subsArr.filter(s =>
    s.status === 'cancelled' && s.updated_at && new Date(s.updated_at) >= monthStart
  ).length;

  return NextResponse.json({
    users: {
      total,
      confirmed,
      unconfirmed,
      today,
      thisWeek,
      thisMonth,
      completedOnboarding,
      skippedOnboarding,
      withRecurring,
      withCreditCard,
      withCSVImport,
      neverLaunched: neverLaunchedUsers.length,
      inactiveRisk: inactiveRiskUsers.length,
    },
    launches: {
      total: totalLaunches,
      avgPerUser,
      byDayOfWeek,
      weekGrowth,
    },
    cards: { total: totalCards },
    revenue: {
      mrr: Math.round(mrr * 100) / 100,
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
    },
    churn: {
      neverLaunched: neverLaunchedUsers.map(u => ({
        user_id: u.id,
        email: u.email,
        created_at: u.created_at,
      })),
      inactiveRisk: inactiveRiskUsers.map(u => {
        const lastExpense = (expenses ?? [])
          .filter(e => e.user_id === u.id)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return {
          user_id: u.id,
          email: u.email,
          created_at: u.created_at,
          lastLaunch: lastExpense?.date ?? null,
        };
      }),
    },
  });
}
