import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeMonthlyReport, renderMonthlyEmailHtml } from '@/lib/reports';

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
    .eq('email_report_monthly', true);

  if (error) {
    console.error('[reports/monthly] erro listando profiles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (profiles ?? []).map((p) => p.id as string);
  if (ids.length === 0) return NextResponse.json({ sent: 0, failed: 0, total: 0 });

  const emailById = new Map<string, string>();
  const firstNameById = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listErr || !data) break;
    for (const u of data.users) {
      if (!u.email) continue;
      emailById.set(u.id, u.email);
      const meta = (u.user_metadata ?? {}) as Record<string, string>;
      firstNameById.set(
        u.id,
        meta.display_name || meta.full_name?.split(' ')[0] || meta.name?.split(' ')[0] || u.email.split('@')[0],
      );
    }
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
      const report = await computeMonthlyReport(admin, userId, now);
      if (report.totalSpent === 0) {
        skipped += 1;
        continue;
      }
      const html = renderMonthlyEmailHtml(report, firstNameById.get(userId) ?? '');
      const { error: sendErr } = await resend.emails.send({
        from: 'TôOrganizado <noreply@toorganizado.com.br>',
        to: email,
        subject: `Seu mês em números — TôOrganizado`,
        html,
      });
      if (sendErr) {
        failed += 1;
        console.error('[reports/monthly] resend erro', userId, sendErr);
      } else {
        sent += 1;
      }
    } catch (err) {
      failed += 1;
      console.error('[reports/monthly] erro processando', userId, err);
    }
  }

  return NextResponse.json({ sent, failed, skipped, total: ids.length });
}
