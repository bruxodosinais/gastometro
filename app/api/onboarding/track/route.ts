import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestUser } from '@/lib/supabase/getRequestUser';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { preflight, withCors } from '@/lib/cors';
import { ONBOARDING_ACTIONS, ONBOARDING_STEP_KEYS } from '@/lib/onboarding/steps';

// Rota PÚBLICA (o funil começa antes da conta existir). Defesas:
//   • allowlist de `step` e `action` — nada de texto livre indo pro banco;
//   • anon_id limitado a 64 chars e a um alfabeto seguro;
//   • rate limit por IP;
//   • escrita só com service role, RLS fechada na tabela (ninguém lê pelo client).
// O user_id é anexado quando HÁ sessão (cookie na web, Bearer no nativo) — é o
// que liga a sessão anônima do pré-cadastro à conta criada depois.

const ANON_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const PLATFORMS = new Set(['web', 'ios', 'android', 'native']);

// 200 eventos/hora/IP. O funil inteiro tem ~27 passos e o cliente deduplica por
// carga de página; quem estourar isso não é usuário, é script.
const MAX_PER_HOUR = 200;

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!rateLimit(ip, 'onboarding-track', MAX_PER_HOUR, 60 * 60 * 1000)) {
    return withCors(new NextResponse(null, { status: 429 }), req);
  }

  const body = await req.json().catch(() => ({})) as {
    anonId?: string; step?: string; action?: string; platform?: string;
  };

  const anonId = typeof body.anonId === 'string' ? body.anonId.trim() : '';
  const step = typeof body.step === 'string' ? body.step.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : 'view';
  const plat = typeof body.platform === 'string' ? body.platform.trim() : '';

  if (!ANON_ID_RE.test(anonId)) {
    return withCors(NextResponse.json({ error: 'anonId inválido.' }, { status: 400 }), req);
  }
  if (!ONBOARDING_STEP_KEYS.has(step)) {
    return withCors(NextResponse.json({ error: 'step desconhecido.' }, { status: 400 }), req);
  }
  if (!ONBOARDING_ACTIONS.includes(action as never)) {
    return withCors(NextResponse.json({ error: 'action inválida.' }, { status: 400 }), req);
  }

  // Sessão é OPCIONAL aqui: no pré-cadastro ela não existe. Sem sessão o evento
  // entra só com anon_id (é exatamente o caso que queremos medir).
  let userId: string | null = null;
  try {
    const { user } = await getRequestUser(req);
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  const admin = createAdminClient();
  // ignoreDuplicates: colisão no índice (anon_id, step, action) é "já contei
  // esse primeiro toque", não erro. Responde 204 do mesmo jeito.
  await admin
    .from('onboarding_events')
    .upsert(
      {
        anon_id: anonId,
        user_id: userId,
        step,
        action,
        platform: PLATFORMS.has(plat) ? plat : null,
      },
      { onConflict: 'anon_id,step,action', ignoreDuplicates: true },
    );

  return withCors(new NextResponse(null, { status: 204 }), req);
}
