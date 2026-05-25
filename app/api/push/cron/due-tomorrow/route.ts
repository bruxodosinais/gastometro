import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  findLoggedNotifications,
  getSubscriptionsForUsers,
  logPushHistory,
  recordNotifications,
  sendPushToSubscriptions,
} from '@/lib/push';

export const maxDuration = 60;

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Dia do vencimento alvo = dia de amanhã (1-31), fuso America/Sao_Paulo via offset simples.
  // O cron roda 09:00 UTC = 06:00 BRT — então "amanhã" considera o calendário BRT atual.
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDay = tomorrow.getDate();
  // Mês corrente (não o de amanhã) — quando o vencimento é dia 1, o cron roda
  // no último dia do mês anterior; queremos a chave do mês cujo vencimento
  // estamos avisando, então usamos a data de "amanhã".
  const cycleKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}`;

  // 1. Busca recurring_expenses ativas com due_day = amanhã (type = expense).
  const { data: recurring, error: recErr } = await admin
    .from('recurring_expenses')
    .select('id, user_id, description, amount, due_day, active, type')
    .eq('active', true)
    .eq('due_day', tomorrowDay)
    .eq('type', 'expense');

  if (recErr) {
    console.error('[push/cron/due-tomorrow] erro recurring:', recErr);
    return NextResponse.json({ error: recErr.message }, { status: 500 });
  }
  if (!recurring || recurring.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 2. Filtra usuários que querem receber esse push.
  const userIds = Array.from(new Set(recurring.map((r) => r.user_id as string)));
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, push_due_tomorrow')
    .in('id', userIds);
  const optedIn = new Set(
    (profiles ?? [])
      .filter((p) => p.push_due_tomorrow !== false)
      .map((p) => p.id as string)
  );
  // Para usuários sem linha em profiles, default = true (igual ao schema).
  for (const uid of userIds) {
    if (!(profiles ?? []).some((p) => p.id === uid)) optedIn.add(uid);
  }

  // 3. Agrupa contas por usuário (cada usuário recebe um push por conta).
  const optedInRecurring = recurring.filter((r) => optedIn.has(r.user_id as string));
  if (optedInRecurring.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 3b. Dedup por recorrente + mês — se já avisamos esse "Aluguel" em maio,
  // não avisa de novo até junho mesmo que o cron rode várias vezes.
  const dedupTypes = Array.from(
    new Set(optedInRecurring.map((r) => `due_tomorrow:${r.id as string}:${cycleKey}`))
  );
  const dedupUserIds = Array.from(
    new Set(optedInRecurring.map((r) => r.user_id as string))
  );
  const alreadyNotified = await findLoggedNotifications(admin, {
    userIds: dedupUserIds,
    types: dedupTypes,
  });

  const eligible = optedInRecurring.filter((r) => {
    const key = `${r.user_id as string}|due_tomorrow:${r.id as string}:${cycleKey}`;
    return !alreadyNotified.has(key);
  });
  if (eligible.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 4. Carrega subscriptions por usuário e dispara.
  const subscriptions = await getSubscriptionsForUsers(
    admin,
    Array.from(new Set(eligible.map((r) => r.user_id as string)))
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
  const logEntries: Array<{ user_id: string; type: string }> = [];

  for (const item of eligible) {
    const userId = item.user_id as string;
    const userSubs = subsByUser.get(userId) ?? [];
    if (userSubs.length === 0) continue;
    const description = (item.description as string) ?? 'Conta recorrente';
    const amount = Number(item.amount ?? 0);
    const payload = {
      title: '🔔 Conta vence amanhã',
      message: `${description} — ${fmtBRL(amount)}`,
      url: '/recorrentes',
    };
    const res = await sendPushToSubscriptions(admin, userSubs, payload);
    totalSent += res.sent;
    totalFailed += res.failed;
    if (res.sent > 0) {
      usersNotified += 1;
      logEntries.push({
        user_id: userId,
        type: `due_tomorrow:${item.id as string}:${cycleKey}`,
      });
    }
  }

  await recordNotifications(admin, logEntries);

  await logPushHistory(admin, {
    title: '🔔 Conta vence amanhã',
    message: `${eligible.length} conta(s) detectada(s)`,
    target: 'cron:due-tomorrow',
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
