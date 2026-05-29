import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(ip, 'coupons:redeem', 10, 15 * 60 * 1000)) {
    return NextResponse.json({ success: false, error: 'Muitas tentativas. Aguarde.' }, { status: 429 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Não autenticado.' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { code?: string };
  const code = (body.code ?? '').toUpperCase().trim();
  if (!code) return NextResponse.json({ success: false, error: 'Código obrigatório.' }, { status: 400 });

  const admin = createAdminClient();

  // Já é Pro ativo? Não consome o cupom (checado ANTES do resgate atômico,
  // que incrementa uses — não dá pra consumir um uso pra quem já é Pro).
  const { data: existing } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing && existing.plan === 'pro' && existing.status === 'active') {
    return NextResponse.json({ success: false, error: 'Você já é Pro ativo.' }, { status: 400 });
  }

  // Validação (ativo/expirado/esgotado) + incremento de uses na MESMA função,
  // de forma atômica — impede resgates concorrentes de estourarem max_uses.
  const { data: result, error: rpcErr } = await admin.rpc('redeem_coupon', {
    p_code: code,
    p_user_id: user.id,
  });
  if (rpcErr) {
    return NextResponse.json({ success: false, error: 'Erro ao validar cupom.' }, { status: 500 });
  }
  const redeem = result as {
    ok: boolean;
    error?: string;
    coupon?: { id: string; days: number; uses: number };
  } | null;
  if (!redeem?.ok || !redeem.coupon) {
    return NextResponse.json(
      { success: false, error: redeem?.error ?? 'Cupom inválido.' },
      { status: 400 },
    );
  }

  const coupon = redeem.coupon;
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

  if (upsertErr) {
    // O uso já foi consumido pela função atômica, mas o Pro não foi aplicado:
    // compensa devolvendo o uso (best-effort) pra não "queimar" o cupom à toa.
    await admin
      .from('coupons')
      .update({ uses: Math.max(0, coupon.uses - 1) })
      .eq('id', coupon.id);
    return NextResponse.json({ success: false, error: 'Erro ao aplicar Pro.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, days: coupon.days, current_period_end: periodEnd });
}
