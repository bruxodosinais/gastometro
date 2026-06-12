import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  findLoggedNotifications,
  getSubscriptionsForUsers,
  logPushHistory,
  recordNotifications,
  sendPushToSubscriptions,
} from '@/lib/push';
import { computeWeeklyReport } from '@/lib/reports';
import { weeklySummaryCopy, type PushCopy } from '@/lib/notifications/copy';

export const maxDuration = 60;

// Chave ISO 8601: ano da quinta-feira da semana corrente + número da semana.
// Espelha components/WeeklyReportModal.tsx#getISOWeekKey.
function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

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
  const now = new Date();
  const weekKey = getISOWeekKey(now);
  const dedupType = `weekly_summary:${weekKey}`;

  // DRY-RUN escopado (?dryRun=1&user=<id>): computa a copy sem ENVIAR e sem
  // gravar log — bypassa opt-in/Pro/dedup só pra inspecionar o texto. Exige
  // ?user=<id> (não varre todos os usuários no preview).
  const dryRun = req.nextUrl.searchParams.get('dryRun');
  const onlyUser = req.nextUrl.searchParams.get('user') || undefined;
  if (dryRun) {
    if (!onlyUser) {
      return NextResponse.json({ error: 'dryRun requer ?user' }, { status: 400 });
    }
    try {
      const report = await computeWeeklyReport(admin, onlyUser, now);
      const hadActivity = !(report.totalSpent === 0 && report.pendingBills.length === 0);
      const copy = weeklySummaryCopy({
        spentBRL: report.totalSpent > 0 ? fmtBRL(report.totalSpent) : null,
        pendingCount: report.pendingBills.length,
        progressPercent: report.missao?.progressPercent ?? null,
      });
      return NextResponse.json({
        dryRun: true,
        user_id: onlyUser,
        hadActivity, // false → o cron real pularia este usuário
        hasMission: report.missao != null,
        progressPercent: report.missao?.progressPercent ?? null,
        ...copy,
      });
    } catch (err) {
      return NextResponse.json({ dryRun: true, error: String(err) }, { status: 500 });
    }
  }

  // 1. Usuários opted-in para resumo semanal push.
  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, push_weekly_summary');
  if (profErr) {
    console.error('[push/cron/weekly-summary] erro profiles:', profErr);
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }
  const optedInIds = (profiles ?? [])
    .filter((p) => p.push_weekly_summary !== false)
    .map((p) => p.id as string);
  if (optedInIds.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 2. Gate Pro — resumo semanal é benefício do plano pago (espelha /api/reports/weekly).
  const { data: subs, error: subsErr } = await admin
    .from('subscriptions')
    .select('user_id')
    .in('user_id', optedInIds)
    .eq('plan', 'pro')
    .eq('status', 'active');
  if (subsErr) {
    console.error('[push/cron/weekly-summary] erro subscriptions:', subsErr);
    return NextResponse.json({ error: subsErr.message }, { status: 500 });
  }
  const proIds = new Set((subs ?? []).map((s) => s.user_id as string));
  const eligibleIds = optedInIds.filter((id) => proIds.has(id));
  if (eligibleIds.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 3. Dedup por semana ISO — se já enviamos nessa semana, pula.
  const alreadySent = await findLoggedNotifications(admin, {
    userIds: eligibleIds,
    types: [dedupType],
  });
  const targetIds = eligibleIds.filter((uid) => !alreadySent.has(`${uid}|${dedupType}`));
  if (targetIds.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, users: 0 });
  }

  // 4. Subscriptions agrupadas por usuário.
  const subscriptions = await getSubscriptionsForUsers(admin, targetIds);
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

  for (const userId of targetIds) {
    const userSubs = subsByUser.get(userId) ?? [];
    if (userSubs.length === 0) continue;

    let copy: PushCopy;
    try {
      const report = await computeWeeklyReport(admin, userId, now);
      // Pula usuários sem nenhuma atividade nem conta pendente — não há o que resumir.
      if (report.totalSpent === 0 && report.pendingBills.length === 0) continue;
      // Tie-to-Missão de graça: report.missao já vem computado (progressPercent).
      copy = weeklySummaryCopy({
        spentBRL: report.totalSpent > 0 ? fmtBRL(report.totalSpent) : null,
        pendingCount: report.pendingBills.length,
        progressPercent: report.missao?.progressPercent ?? null,
      });
    } catch (err) {
      console.error('[push/cron/weekly-summary] erro computeWeeklyReport', userId, err);
      continue;
    }

    const payload = {
      title: copy.title,
      message: copy.body,
      url: '/app',
    };
    const res = await sendPushToSubscriptions(admin, userSubs, payload);
    totalSent += res.sent;
    totalFailed += res.failed;
    if (res.sent > 0) {
      usersNotified += 1;
      logEntries.push({ user_id: userId, type: dedupType });
    }
  }

  await recordNotifications(admin, logEntries);

  await logPushHistory(admin, {
    title: '📊 Seu resumo semanal',
    message: `${usersNotified} usuário(s) notificado(s) — semana ${weekKey}`,
    target: 'cron:weekly-summary',
    sent: totalSent,
    failed: totalFailed,
    createdBy: null,
  });

  return NextResponse.json({
    sent: totalSent,
    failed: totalFailed,
    total: targetIds.length,
    users: usersNotified,
    week: weekKey,
  });
}
