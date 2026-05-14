import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { userId?: string; days?: number };

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!userId) {
    return NextResponse.json({ error: 'userId obrigatório.' }, { status: 400 });
  }

  const days = Number.isFinite(body.days) ? Math.max(1, Math.floor(body.days as number)) : 30;

  const admin = createAdminClient();

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        plan: 'pro',
        status: 'active',
        billing_cycle: 'beta',
        current_period_end: periodEnd,
      },
      { onConflict: 'user_id' },
    );

  if (error) {
    return NextResponse.json({ error: 'Erro ao conceder Pro.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, current_period_end: periodEnd, days });
}
