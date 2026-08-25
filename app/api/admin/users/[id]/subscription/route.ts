import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) };
  if (!(await isAdmin(user.id))) return { error: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) };
  return { user };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('subscriptions')
    .select('plan, status, billing_cycle, current_period_end, store, revenuecat_app_user_id, kiwify_order_id, kiwify_subscription_id, updated_at')
    .eq('user_id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'Erro ao buscar assinatura.' }, { status: 500 });

  return NextResponse.json({
    subscription: data ?? {
      plan: 'free',
      status: 'active',
      billing_cycle: null,
      current_period_end: null,
      store: null,
      revenuecat_app_user_id: null,
      kiwify_order_id: null,
      kiwify_subscription_id: null,
      updated_at: null,
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { days?: number };
  const days = Number.isFinite(body.days) ? Math.max(1, Math.floor(body.days as number)) : 30;

  const admin = createAdminClient();
  const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: id,
        plan: 'pro',
        status: 'active',
        billing_cycle: 'manual',
        current_period_end: periodEnd,
      },
      { onConflict: 'user_id' },
    );

  if (error) return NextResponse.json({ error: 'Erro ao conceder Pro.' }, { status: 500 });
  return NextResponse.json({ success: true, current_period_end: periodEnd, days });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from('subscriptions')
    .select('billing_cycle')
    .eq('user_id', id)
    .maybeSingle();

  if (sub && sub.billing_cycle && sub.billing_cycle !== 'manual') {
    return NextResponse.json(
      { error: 'Esta assinatura veio de uma loja (App Store ou Play Store) e não pode ser revogada aqui. O cancelamento é feito pelo próprio usuário na loja.' },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: id,
        plan: 'free',
        status: 'active',
        billing_cycle: null,
        current_period_end: null,
      },
      { onConflict: 'user_id' },
    );

  if (error) return NextResponse.json({ error: 'Erro ao revogar Pro.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
