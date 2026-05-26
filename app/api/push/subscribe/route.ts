import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

interface Body {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(ip, 'push:subscribe', 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Limite de registros atingido.' }, { status: 429 });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
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
