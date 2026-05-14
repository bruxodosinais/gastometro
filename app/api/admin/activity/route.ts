import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

type ActivityType = 'signup' | 'upgrade' | 'cancel' | 'feedback';

interface ActivityItem {
  id: string;
  type: ActivityType;
  email: string | null;
  description: string;
  meta?: string | null;
  created_at: string;
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const emailById = new Map<string, string>();
  for (const u of allUsers) {
    if (u.email) emailById.set(u.id, u.email);
  }

  const events: ActivityItem[] = [];

  for (const u of allUsers) {
    if (new Date(u.created_at) >= new Date(thirtyDaysAgo)) {
      events.push({
        id: `signup:${u.id}`,
        type: 'signup',
        email: u.email ?? null,
        description: `${u.email ?? 'usuário'} fez cadastro`,
        created_at: u.created_at,
      });
    }
  }

  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id, plan, status, billing_cycle, updated_at, created_at')
    .gte('updated_at', thirtyDaysAgo);

  for (const s of subs ?? []) {
    const email = emailById.get(s.user_id) ?? null;
    if (s.plan === 'pro' && s.status === 'active') {
      const cycle = s.billing_cycle ?? 'sem ciclo';
      events.push({
        id: `upgrade:${s.user_id}:${s.updated_at}`,
        type: 'upgrade',
        email,
        description: `${email ?? 'usuário'} assinou Pro (${cycle})`,
        meta: cycle,
        created_at: s.updated_at ?? s.created_at ?? new Date().toISOString(),
      });
    }
    if (s.status === 'cancelled') {
      events.push({
        id: `cancel:${s.user_id}:${s.updated_at}`,
        type: 'cancel',
        email,
        description: `${email ?? 'usuário'} cancelou assinatura`,
        created_at: s.updated_at ?? s.created_at ?? new Date().toISOString(),
      });
    }
  }

  const { data: feedbacks } = await admin
    .from('feedback')
    .select('id, user_id, category, message, created_at')
    .gte('created_at', thirtyDaysAgo);

  for (const f of feedbacks ?? []) {
    const email = f.user_id ? emailById.get(f.user_id) ?? null : null;
    const preview = f.message.length > 60 ? `${f.message.slice(0, 60)}…` : f.message;
    events.push({
      id: `feedback:${f.id}`,
      type: 'feedback',
      email,
      description: `${email ?? 'usuário'} enviou feedback (${f.category}): ${preview}`,
      created_at: f.created_at,
    });
  }

  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ items: events });
}
