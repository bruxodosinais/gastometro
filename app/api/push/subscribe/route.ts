import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase/getRequestUser';
import { createAdminClient } from '@/lib/supabase/admin';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

interface Body {
  // Web push (VAPID): caminho atual, intacto.
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  // Nativo (FCM): device token do app + plataforma.
  token?: string;
  platform?: string;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(ip, 'push:subscribe', 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Limite de registros atingido.' }, { status: 429 });
  }

  // Autentica por cookie (web, idêntico ao de antes) OU Bearer (nativo Capacitor).
  const { user, supabase } = await getRequestUser(req);
  if (!user || !supabase) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;

  // ── Ramo NATIVO (FCM): { token, platform } ────────────────────────────────
  // Upsert via service role com onConflict: 'token' — se a conta B logar num
  // aparelho onde a conta A já tinha registrado o mesmo token, a linha é
  // reassociada (a RLS auth.uid()=user_id bloquearia "roubar" a linha de outro
  // usuário, por isso admin). O web (endpoint/keys) fica 100% intacto abaixo.
  const token = body.token?.trim();
  if (token) {
    const platform = body.platform === 'ios' || body.platform === 'android' ? body.platform : null;
    if (!platform) {
      return NextResponse.json({ error: 'platform inválida (ios|android).' }, { status: 400 });
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from('device_tokens')
      .upsert(
        { user_id: user.id, token, platform, updated_at: new Date().toISOString() },
        { onConflict: 'token' },
      );
    if (error) {
      console.error('[push/subscribe] erro upsert device_tokens:', error);
      return NextResponse.json({ error: 'Erro ao salvar token.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // ── Ramo WEB (VAPID): { endpoint, keys } — caminho atual, inalterado ──────
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Subscription inválida.' }, { status: 400 });
  }

  // upsert por (user_id, endpoint) — se o mesmo device renovar as chaves, atualizamos.
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth },
      { onConflict: 'user_id,endpoint' }
    );

  if (error) {
    console.error('[push/subscribe] erro upsert:', error);
    return NextResponse.json({ error: 'Erro ao salvar subscription.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
