import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 60;

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthLabelPt(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString('pt-BR', { month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function emailHtml({
  firstName,
  monthLabel,
  monthlyTarget,
}: {
  firstName: string;
  monthLabel: string;
  monthlyTarget: number;
}): string {
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#F7F7F5;font-family:Nunito,system-ui,sans-serif;color:#1A1A1A;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;">
    <p style="font-size:14px;font-weight:700;color:#5B5BD6;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 8px;">Missão de Poupança</p>
    <h1 style="font-size:22px;font-weight:800;margin:0 0 12px;">Ei ${firstName}, ${monthLabel} tá passando 🎯</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px;color:#1A1A1A;">
      Você ainda não registrou um depósito em <strong>${monthLabel}</strong>. Bora colocar mais um tijolo na sua meta?
    </p>
    <p style="font-size:14px;font-weight:700;color:#6B6B6B;margin:0 0 24px;">
      Meta deste mês: <span style="color:#1A1A1A;">${fmtBrl(monthlyTarget)}</span>
    </p>
    <a href="https://toorganizado.com.br/missao" style="display:inline-block;background:#5B5BD6;color:#fff;font-weight:800;text-decoration:none;padding:14px 22px;border-radius:12px;font-size:15px;">
      Registrar agora →
    </a>
    <p style="font-size:12px;color:#B4B4AA;margin:24px 0 0;">
      Quer desativar esses lembretes? Edite sua missão dentro do app.
    </p>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Guard de calendário: o schedule "0 10 5 * *" já filtra para o dia 5, mas
  // execuções manuais (ex.: re-run da Vercel) precisam respeitar a regra.
  const today = new Date();
  if (today.getUTCDate() !== 5) {
    return NextResponse.json({ skipped: 'not_day_5', date: today.toISOString() });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY ausente.' }, { status: 500 });
  }

  const admin = createAdminClient();
  const month = currentMonthKey();
  const monthLabel = monthLabelPt(month);

  // 1) Missões ativas com lembrete ligado.
  const { data: missions, error: missErr } = await admin
    .from('savings_missions')
    .select('id, user_id, monthly_target')
    .eq('status', 'active')
    .eq('reminders_enabled', true);
  if (missErr) {
    console.error('[missao-lembrete] erro listando missões:', missErr);
    return NextResponse.json({ error: missErr.message }, { status: 500 });
  }
  if (!missions || missions.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  // 2) Contribuições do mês corrente para essas missões — uma query só.
  const missionIds = missions.map((m) => m.id as string);
  const { data: contribs, error: contribErr } = await admin
    .from('mission_contributions')
    .select('mission_id')
    .in('mission_id', missionIds)
    .eq('month', month);
  if (contribErr) {
    console.error('[missao-lembrete] erro listando contribuições:', contribErr);
    return NextResponse.json({ error: contribErr.message }, { status: 500 });
  }
  const haveContributed = new Set((contribs ?? []).map((c) => c.mission_id as string));

  // 3) Filtra missões sem contribuição este mês.
  const eligibleMissions = missions.filter((m) => !haveContributed.has(m.id as string));
  if (eligibleMissions.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, allCaughtUp: true });
  }

  // 4) Carrega e-mails + nomes via Auth admin API (mesmo padrão de
  //    reports/weekly). 1000 por página, capamos em 50 páginas defensivamente.
  const userIds = new Set(eligibleMissions.map((m) => m.user_id as string));
  const profileById = new Map<string, { email: string; firstName: string }>();
  let page = 1;
  while (true) {
    const { data, error: listErr } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (listErr || !data) break;
    for (const u of data.users) {
      if (!userIds.has(u.id) || !u.email) continue;
      const meta = (u.user_metadata ?? {}) as Record<string, string>;
      const firstName =
        meta.display_name ||
        meta.full_name?.split(' ')[0] ||
        meta.name?.split(' ')[0] ||
        u.email.split('@')[0];
      profileById.set(u.id, { email: u.email, firstName });
    }
    if (data.users.length < 1000) break;
    page += 1;
    if (page > 50) break;
  }

  const resend = new Resend(apiKey);
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const m of eligibleMissions) {
    const profile = profileById.get(m.user_id as string);
    if (!profile) {
      skipped += 1;
      continue;
    }
    try {
      const { error: sendErr } = await resend.emails.send({
        from: 'TôOrganizado <noreply@toorganizado.com.br>',
        to: profile.email,
        subject: 'Sua Missão de Poupança está esperando você 🎯',
        html: emailHtml({
          firstName: profile.firstName,
          monthLabel,
          monthlyTarget: Number(m.monthly_target),
        }),
      });
      if (sendErr) {
        failed += 1;
        console.error('[missao-lembrete] erro ao enviar', { error: sendErr.message });
      } else {
        sent += 1;
      }
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      console.error('[missao-lembrete] erro ao enviar', { error: message });
    }
  }

  return NextResponse.json({ sent, failed, skipped, total: eligibleMissions.length });
}
