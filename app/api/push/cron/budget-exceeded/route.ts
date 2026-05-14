import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getSubscriptionsForUsers,
  logPushHistory,
  sendPushToSubscriptions,
} from '@/lib/push';

export const maxDuration = 60;

function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Mês atual (YYYY-MM) e janela [primeiro dia, primeiro dia do próximo mês).
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
  const monthEnd = new Date(year, month + 1, 1).toISOString().split('T')[0];

  // 1. Carrega todos os orçamentos (budgets).
  const { data: budgets, error: budgetErr } = await admin
    .from('budgets')
    .select('user_id, category, amount');
  if (budgetErr) {
    console.error('[push/cron/budget-exceeded] erro budgets:', budgetErr);
    return NextResponse.json({ error: budgetErr.message }, { status: 500 });
  }
  if (!budgets || budgets.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 2. Carrega despesas do mês atual.
  const userIdsWithBudgets = Array.from(new Set(budgets.map((b) => b.user_id as string)));
  const { data: expenses, error: expErr } = await admin
    .from('expenses')
    .select('user_id, category, amount, type, date')
    .in('user_id', userIdsWithBudgets)
    .gte('date', monthStart)
    .lt('date', monthEnd)
    .eq('type', 'expense');

  if (expErr) {
    console.error('[push/cron/budget-exceeded] erro expenses:', expErr);
    return NextResponse.json({ error: expErr.message }, { status: 500 });
  }

  // 3. Agrupa gasto por (user_id, category).
  const spentByKey = new Map<string, number>();
  for (const e of expenses ?? []) {
    const key = `${e.user_id}|${e.category}`;
    spentByKey.set(key, (spentByKey.get(key) ?? 0) + Number(e.amount));
  }

  // 4. Identifica orçamentos estourados.
  const breaches = budgets
    .map((b) => {
      const spent = spentByKey.get(`${b.user_id}|${b.category}`) ?? 0;
      const limit = Number(b.amount);
      return {
        user_id: b.user_id as string,
        category: b.category as string,
        spent,
        limit,
        percentage: pct(spent, limit),
      };
    })
    .filter((row) => row.limit > 0 && row.spent > row.limit);

  if (breaches.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 5. Aplica a preferência push_budget_exceeded.
  const breachUserIds = Array.from(new Set(breaches.map((b) => b.user_id)));
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, push_budget_exceeded')
    .in('id', breachUserIds);
  const optedIn = new Set(
    (profiles ?? [])
      .filter((p) => p.push_budget_exceeded !== false)
      .map((p) => p.id as string)
  );
  for (const uid of breachUserIds) {
    if (!(profiles ?? []).some((p) => p.id === uid)) optedIn.add(uid);
  }

  const eligible = breaches.filter((b) => optedIn.has(b.user_id));
  if (eligible.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 6. Carrega subscriptions e dispara um push por estouro.
  const subscriptions = await getSubscriptionsForUsers(
    admin,
    Array.from(new Set(eligible.map((b) => b.user_id)))
  );
  const subsByUser = new Map<string, typeof subscriptions>();
  for (const s of subscriptions) {
    const arr = subsByUser.get(s.user_id) ?? [];
    arr.push(s);
    subsByUser.set(s.user_id, arr);
  }

  let totalSent = 0;
  let totalFailed = 0;
  let usersNotified = 0;

  for (const item of eligible) {
    const userSubs = subsByUser.get(item.user_id) ?? [];
    if (userSubs.length === 0) continue;
    const payload = {
      title: '⚠️ Orçamento estourado',
      message: `${item.category} — ${item.percentage}% usado`,
      url: '/categorias',
    };
    const res = await sendPushToSubscriptions(admin, userSubs, payload);
    totalSent += res.sent;
    totalFailed += res.failed;
    if (res.sent > 0) usersNotified += 1;
  }

  await logPushHistory(admin, {
    title: '⚠️ Orçamento estourado',
    message: `${eligible.length} estouro(s) detectado(s)`,
    target: 'cron:budget-exceeded',
    sent: totalSent,
    failed: totalFailed,
    createdBy: null,
  });

  return NextResponse.json({
    sent: totalSent,
    failed: totalFailed,
    total: eligible.length,
    users: usersNotified,
  });
}
