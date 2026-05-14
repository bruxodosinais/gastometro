import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

interface Body {
  endpoint?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const endpoint = body.endpoint?.trim();
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint obrigatório.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[push/unsubscribe] erro delete:', error);
    return NextResponse.json({ error: 'Erro ao remover subscription.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
