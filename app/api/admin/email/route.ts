import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

type Segment = 'all' | 'free' | 'pro' | 'inactive' | 'never_launched';

const MAX_PER_SEND = 50;

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY ausente.' }, { status: 500 });

  const body = await req.json().catch(() => ({})) as {
    segment?: Segment;
    subject?: string;
    message?: string;
  };
  const segment: Segment = body.segment ?? 'all';
  const subject = (body.subject ?? '').trim();
  const message = (body.message ?? '').trim();

  if (!subject) return NextResponse.json({ error: 'Assunto obrigatório.' }, { status: 400 });
  if (!message) return NextResponse.json({ error: 'Mensagem obrigatória.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 });

  // Filtra por segmento
  let userIds: string[] = [];
  if (segment === 'all') {
    userIds = allUsers.map(u => u.id);
  } else if (segment === 'inactive') {
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recent } = await admin
      .from('expenses')
      .select('user_id')
      .gte('date', sevenDaysAgo.toISOString().split('T')[0]);
    const activeSet = new Set(recent?.map(r => r.user_id) ?? []);
    userIds = allUsers
      .filter(u => new Date(u.created_at) < sevenDaysAgo && !activeSet.has(u.id))
      .map(u => u.id);
  } else if (segment === 'never_launched') {
    const { data: exps } = await admin.from('expenses').select('user_id');
    const launched = new Set(exps?.map(e => e.user_id) ?? []);
    userIds = allUsers.filter(u => !launched.has(u.id)).map(u => u.id);
  } else {
    const { data: subs } = await admin
      .from('subscriptions')
      .select('user_id, plan, status');
    const subMap = new Map<string, { plan: string; status: string }>();
    for (const s of subs ?? []) subMap.set(s.user_id, { plan: s.plan, status: s.status });
    if (segment === 'pro') {
      userIds = allUsers
        .filter(u => {
          const sub = subMap.get(u.id);
          return sub?.plan === 'pro' && sub?.status === 'active';
        })
        .map(u => u.id);
    } else {
      userIds = allUsers
        .filter(u => {
          const sub = subMap.get(u.id);
          return !sub || sub.plan === 'free' || sub.status !== 'active';
        })
        .map(u => u.id);
    }
  }

  const recipients = allUsers
    .filter(u => userIds.includes(u.id) && u.email)
    .map(u => u.email as string);

  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0, error: 'Nenhum destinatário encontrado.' });
  }

  if (recipients.length > MAX_PER_SEND) {
    return NextResponse.json({
      error: `Segmento tem ${recipients.length} destinatários; máximo por envio é ${MAX_PER_SEND}.`,
    }, { status: 400 });
  }

  const resend = new Resend(apiKey);
  const htmlBody = `
    <div style="font-family: Nunito, Arial, sans-serif; max-width: 540px; margin: auto; padding: 32px 24px; background: #F7F7F5; border-radius: 16px;">
      <h1 style="color: #5B5BD6; margin-bottom: 8px;">TôOrganizado</h1>
      <div style="font-size: 15px; color: #1A1A1A; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</div>
      <p style="margin-top: 32px; font-size: 12px; color: #B4B4AA;">Você está recebendo este e-mail porque tem conta no TôOrganizado.</p>
    </div>
  `;

  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    try {
      const { error } = await resend.emails.send({
        from: 'TôOrganizado <noreply@toorganizado.com.br>',
        to,
        subject,
        html: htmlBody,
      });
      if (error) failed++; else sent++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: recipients.length });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
