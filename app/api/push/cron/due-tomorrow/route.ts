import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getSubscriptionsForUsers,
  logPushHistory,
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

  // 1. Busca recurring_expenses ativas com due_day = amanhã (type = expense).
  const { data: recurring, error: recErr } = await admin
    .from('recurring_expenses')
    .select('user_id, description, amount, due_day, active, type')
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
  const eligible = recurring.filter((r) => optedIn.has(r.user_id as string));
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

  for (const item of eligible) {
    const userSubs = subsByUser.get(item.user_id as string) ?? [];
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
    if (res.sent > 0) usersNotified += 1;
  }

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
