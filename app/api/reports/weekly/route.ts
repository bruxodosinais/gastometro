import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeWeeklyReport, renderWeeklyEmailHtml } from '@/lib/reports';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY ausente.' }, { status: 500 });

  const admin = createAdminClient();
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id')
    .eq('email_report_weekly', true);

  if (error) {
    console.error('[reports/weekly] erro listando profiles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const optedInIds = (profiles ?? []).map((p) => p.id as string);
  if (optedInIds.length === 0) return NextResponse.json({ sent: 0, failed: 0, total: 0 });

  // Gate Pro: relatório semanal é benefício do plano pago. Mantém apenas usuários
  // com assinatura ativa em `subscriptions`.
  const { data: subs, error: subsErr } = await admin
    .from('subscriptions')
    .select('user_id')
    .in('user_id', optedInIds)
    .eq('plan', 'pro')
    .eq('status', 'active');
  if (subsErr) {
    console.error('[reports/weekly] erro listando subscriptions:', subsErr);
    return NextResponse.json({ error: subsErr.message }, { status: 500 });
  }
  const proIds = new Set((subs ?? []).map((s) => s.user_id as string));
  const ids = optedInIds.filter((id) => proIds.has(id));
  if (ids.length === 0) return NextResponse.json({ sent: 0, failed: 0, total: 0 });

  // Carrega e-mails via Auth admin API.
  const emailById = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listErr || !data) break;
    for (const u of data.users) if (u.email) emailById.set(u.id, u.email);
    if (data.users.length < 1000) break;
    page += 1;
    if (page > 50) break;
  }

  const resend = new Resend(apiKey);
  const now = new Date();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const userId of ids) {
    const email = emailById.get(userId);
    if (!email) {
      skipped += 1;
      continue;
    }
    try {
      const report = await computeWeeklyReport(admin, userId, now);
      // Pula se não houve atividade nem contas pendentes.
      if (report.totalSpent === 0 && report.pendingBills.length === 0) {
        skipped += 1;
        continue;
      }
      const html = renderWeeklyEmailHtml(report);
      const { error: sendErr } = await resend.emails.send({
        from: 'TôOrganizado <noreply@toorganizado.com.br>',
        to: email,
        subject: `Seu resumo da semana — TôOrganizado`,
        html,
      });
      if (sendErr) {
        failed += 1;
        console.error('[reports/weekly] resend erro', userId, sendErr);
      } else {
        sent += 1;
      }
    } catch (err) {
      failed += 1;
      console.error('[reports/weekly] erro processando', userId, err);
    }
  }

  return NextResponse.json({ sent, failed, skipped, total: ids.length });
}
