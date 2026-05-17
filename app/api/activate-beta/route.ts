import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Janela máxima entre a criação da conta e esta chamada. A rota roda no
// cliente logo após o signUp; 5 min cobre latência de rede com folga e
// impede que o endpoint seja usado pra "promover" contas já estabelecidas
// passando um user_id arbitrário.
const MAX_ACCOUNT_AGE_MS = 5 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Concede o plano Pro do beta (?ref=beta) usando a service role — RLS não
// deixa o próprio usuário escrever em `subscriptions`. Chamada pelo cadastro
// logo após o signUp, pra não depender só do callback de confirmação de
// e-mail (que não roda quando o signUp já devolve sessão).
//
// O endpoint não fica mais permissivo que o giveaway público ?ref=beta:
// plan/billing_cycle/status são fixos no servidor (o caller não escolhe o
// plano) e só contas recém-criadas são elegíveis.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { userId?: unknown };
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';

  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'userId inválido.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. O usuário precisa existir de fato em auth.users.
  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  // 2. Só contas recém-criadas (chamada acontece logo após o signUp).
  const createdAt = authUser.user.created_at
    ? new Date(authUser.user.created_at).getTime()
    : 0;
  if (!createdAt || Date.now() - createdAt > MAX_ACCOUNT_AGE_MS) {
    return NextResponse.json({ error: 'Conta não elegível.' }, { status: 403 });
  }

  // 3. Idempotente: se já é Pro, não reescreve (evita duplicar/sobrescrever).
  const { data: existing } = await admin
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing?.plan === 'pro') {
    return NextResponse.json({ success: true, alreadyActive: true });
  }

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan: 'pro',
      status: 'active',
      billing_cycle: 'beta',
      current_period_end: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    return NextResponse.json({ error: 'Erro ao ativar plano beta.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
