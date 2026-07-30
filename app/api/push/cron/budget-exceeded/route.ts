import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  findLoggedNotifications,
  getSubscriptionsForUsers,
  logPushHistory,
  recordNotifications,
  sendPushToSubscriptions,
} from '@/lib/push';
import { getDeviceTokensForUsers, sendFcmToTokens } from '@/lib/fcm';
import { budgetExceededCopy } from '@/lib/notifications/copy';

export const maxDuration = 60;

// Threshold mínimo de estouro para notificar — abaixo disso (100% – 110%),
// consideramos uma variação pequena e não vale a pena alertar.
const BREACH_THRESHOLD_PCT = 110;

// Janela de cooldown por usuário (em dias). Se já recebeu qualquer push
// de orçamento estourado nos últimos N dias, pula nessa rodada.
const USER_COOLDOWN_DAYS = 7;

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

  // DRY-RUN escopado (?dryRun=1&user=<id>): computa a copy sem ENVIAR e sem
  // gravar log — bypassa opt-in/cooldown/dedup/subscription só pra inspecionar.
  const dryRun = req.nextUrl.searchParams.get('dryRun');
  const onlyUser = req.nextUrl.searchParams.get('user') || undefined;
  if (dryRun) {
    if (!onlyUser) {
      return NextResponse.json({ error: 'dryRun requer ?user' }, { status: 400 });
    }
    const d = new Date();
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString().split('T')[0];
    const { data: buds } = await admin
      .from('budgets')
      .select('user_id, category, amount')
      .eq('user_id', onlyUser);
    const uids = Array.from(new Set((buds ?? []).map((b) => b.user_id as string)));
    const { data: exps } = uids.length
      ? await admin
          .from('expenses')
          .select('user_id, category, amount')
          .in('user_id', uids)
          .gte('date', mStart)
          .lt('date', mEnd)
          .eq('type', 'expense')
      : { data: [] as { user_id: string; category: string; amount: number }[] };
    const spent = new Map<string, number>();
    for (const e of exps ?? []) {
      const k = `${e.user_id}|${e.category}`;
      spent.set(k, (spent.get(k) ?? 0) + Number(e.amount));
    }
    const breaches = (buds ?? [])
      .map((b) => ({
        user_id: b.user_id as string,
        category: b.category as string,
        percentage: pct(spent.get(`${b.user_id}|${b.category}`) ?? 0, Number(b.amount)),
        limit: Number(b.amount),
      }))
      .filter((r) => r.limit > 0 && r.percentage >= BREACH_THRESHOLD_PCT);
    const { data: missions } = uids.length
      ? await admin.from('savings_missions').select('user_id').in('user_id', uids).eq('status', 'active')
      : { data: [] as { user_id: string }[] };
    const withMission = new Set((missions ?? []).map((m) => m.user_id as string));
    const byUser = new Map<string, string[]>();
    for (const b of [...breaches].sort((a, b2) => b2.percentage - a.percentage)) {
      const arr = byUser.get(b.user_id) ?? [];
      arr.push(b.category);
      byUser.set(b.user_id, arr);
    }
    const payloads = Array.from(byUser.entries()).map(([uid, cats]) => ({
      user_id: uid,
      hasMission: withMission.has(uid),
      ...budgetExceededCopy({ categories: cats, hasMission: withMission.has(uid) }),
    }));
    return NextResponse.json({ dryRun: true, count: payloads.length, payloads });
  }

  // Mês atual (YYYY-MM) e janela [primeiro dia, primeiro dia do próximo mês).
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
  const monthEnd = new Date(year, month + 1, 1).toISOString().split('T')[0];
  const monthKey = monthStart.slice(0, 7); // YYYY-MM

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

  // 4. Identifica orçamentos estourados acima do threshold (110%).
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
    .filter((row) => row.limit > 0 && row.percentage >= BREACH_THRESHOLD_PCT);

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

  const eligibleBreaches = breaches.filter((b) => optedIn.has(b.user_id));
  if (eligibleBreaches.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  const eligibleUserIds = Array.from(new Set(eligibleBreaches.map((b) => b.user_id)));

  // 6a. Cooldown semanal por usuário: se já mandou 'budget_exceeded' nos
  // últimos 7 dias, pula esse usuário inteiro.
  const cooldownSince = new Date(
    now.getTime() - USER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const recentUserHits = await findLoggedNotifications(admin, {
    userIds: eligibleUserIds,
    types: ['budget_exceeded'],
    sinceIso: cooldownSince,
  });
  const usersOnCooldown = new Set<string>();
  for (const uid of eligibleUserIds) {
    if (recentUserHits.has(`${uid}|budget_exceeded`)) usersOnCooldown.add(uid);
  }

  // 6b. Dedup mensal por categoria: tipos tipo 'budget_exceeded:Alimentação:2026-05'.
  const perCategoryTypes = Array.from(
    new Set(
      eligibleBreaches.map((b) => `budget_exceeded:${b.category}:${monthKey}`)
    )
  );
  const monthlyHits = await findLoggedNotifications(admin, {
    userIds: eligibleUserIds,
    types: perCategoryTypes,
  });

  // 7. Para cada usuário (não em cooldown), monta a lista de categorias
  // novas (ainda não notificadas neste mês) e dispara 1 push agrupado.
  const groupedByUser = new Map<string, typeof eligibleBreaches>();
  for (const b of eligibleBreaches) {
    if (usersOnCooldown.has(b.user_id)) continue;
    const monthlyKey = `${b.user_id}|budget_exceeded:${b.category}:${monthKey}`;
    if (monthlyHits.has(monthlyKey)) continue;
    const arr = groupedByUser.get(b.user_id) ?? [];
    arr.push(b);
    groupedByUser.set(b.user_id, arr);
  }

  if (groupedByUser.size === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 8. Carrega subscriptions dos usuários que vão receber push.
  const targetUserIds = Array.from(groupedByUser.keys());
  const subscriptions = await getSubscriptionsForUsers(admin, targetUserIds);
  const subsByUser = new Map<string, typeof subscriptions>();
  for (const s of subscriptions) {
    const arr = subsByUser.get(s.user_id) ?? [];
    arr.push(s);
    subsByUser.set(s.user_id, arr);
  }

  // Tokens FCM (nativo) por usuário — segundo transporte, mesmos destinatários.
  const deviceTokens = await getDeviceTokensForUsers(admin, targetUserIds);
  const tokensByUser = new Map<string, typeof deviceTokens>();
  for (const t of deviceTokens) {
    const arr = tokensByUser.get(t.user_id) ?? [];
    arr.push(t);
    tokensByUser.set(t.user_id, arr);
  }

  // Tie-to-Missão: 1 query batched só pra saber QUEM tem missão ativa (a copy
  // só alterna o fecho com/sem missão — não precisa do progresso).
  const { data: missionRows } = await admin
    .from('savings_missions')
    .select('user_id')
    .in('user_id', targetUserIds)
    .eq('status', 'active');
  const usersWithMission = new Set((missionRows ?? []).map((m) => m.user_id as string));

  let totalSent = 0;
  let totalFailed = 0;
  let usersNotified = 0;
  const logEntries: Array<{ user_id: string; type: string }> = [];

  for (const [userId, items] of groupedByUser.entries()) {
    const userSubs = subsByUser.get(userId) ?? [];
    const userTokens = tokensByUser.get(userId) ?? [];
    if (userSubs.length === 0 && userTokens.length === 0) continue;

    // Ordena por % decrescente para mostrar a mais crítica primeiro.
    const sorted = [...items].sort((a, b) => b.percentage - a.percentage);
    const categories = sorted.map((b) => b.category);
    const copy = budgetExceededCopy({
      categories,
      hasMission: usersWithMission.has(userId),
    });

    const payload = {
      title: copy.title,
      message: copy.body,
      url: '/categorias',
    };
    const [webRes, fcmRes] = await Promise.all([
      sendPushToSubscriptions(admin, userSubs, payload),
      sendFcmToTokens(admin, userTokens, payload),
    ]);
    totalSent += webRes.sent + fcmRes.sent;
    totalFailed += webRes.failed + fcmRes.failed;
    // Dedup por (user, type) vale pros DOIS transportes: loga se qualquer um
    // entregou (senão um usuário só-nativo seria re-notificado toda rodada).
    if (webRes.sent > 0 || fcmRes.sent > 0) {
      usersNotified += 1;
      // Marca o gate semanal por usuário…
      logEntries.push({ user_id: userId, type: 'budget_exceeded' });
      // …e cada categoria como já notificada neste mês.
      for (const cat of categories) {
        logEntries.push({
          user_id: userId,
          type: `budget_exceeded:${cat}:${monthKey}`,
        });
      }
    }
  }

  await recordNotifications(admin, logEntries);

  await logPushHistory(admin, {
    title: '⚠️ Orçamento estourado',
    message: `${usersNotified} usuário(s) notificado(s) — ${eligibleBreaches.length} estouro(s) avaliado(s)`,
    target: 'cron:budget-exceeded',
    sent: totalSent,
    failed: totalFailed,
    createdBy: null,
  });

  return NextResponse.json({
    sent: totalSent,
    failed: totalFailed,
    total: eligibleBreaches.length,
    users: usersNotified,
  });
}
