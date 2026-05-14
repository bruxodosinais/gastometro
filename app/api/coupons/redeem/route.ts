import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { code?: string };
  const code = (body.code ?? '').toUpperCase().trim();
  if (!code) return NextResponse.json({ success: false, error: 'Código obrigatório.' }, { status: 400 });

  const admin = createAdminClient();

  const { data: coupon, error } = await admin
    .from('coupons')
    .select('id, code, days, max_uses, uses, active, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: 'Erro ao validar cupom.' }, { status: 500 });
  if (!coupon) return NextResponse.json({ success: false, error: 'Cupom não encontrado.' }, { status: 404 });
  if (!coupon.active) return NextResponse.json({ success: false, error: 'Cupom inativo.' }, { status: 400 });
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ success: false, error: 'Cupom expirado.' }, { status: 400 });
  }
  if (coupon.max_uses > 0 && coupon.uses >= coupon.max_uses) {
    return NextResponse.json({ success: false, error: 'Cupom esgotado.' }, { status: 400 });
  }

  // Já é Pro ativo? Não aplica.
  const { data: existing } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing && existing.plan === 'pro' && existing.status === 'active') {
    return NextResponse.json({ success: false, error: 'Você já é Pro ativo.' }, { status: 400 });
  }

  const periodEnd = new Date(Date.now() + coupon.days * 24 * 60 * 60 * 1000).toISOString();

  const { error: upsertErr } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: user.id,
        plan: 'pro',
        status: 'active',
        billing_cycle: 'coupon',
        current_period_end: periodEnd,
      },
      { onConflict: 'user_id' },
    );

  if (upsertErr) return NextResponse.json({ success: false, error: 'Erro ao aplicar Pro.' }, { status: 500 });

  await admin
    .from('coupons')
    .update({ uses: coupon.uses + 1 })
    .eq('id', coupon.id);

  return NextResponse.json({ success: true, days: coupon.days, current_period_end: periodEnd });
}
