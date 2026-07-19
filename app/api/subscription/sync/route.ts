import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase/getRequestUser';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sync sob demanda da assinatura RevenueCat → `subscriptions` (fonte de verdade
// do isPro). Resolve um gap COMPROVADO em sandbox: a compra é anônima (paywall
// pré-cadastro) e, no alias anônimo→identificado pós-cadastro, o RevenueCat NÃO
// dispara webhook — o único evento é o INITIAL_PURCHASE anônimo, que o webhook
// ignora por não ter UUID. Sem este sync, a linha em `subscriptions` só nasceria
// na próxima renovação (um ano depois, no anual) e o pagante ficaria barrado.
//
// Determinístico: consulta a REST API do RevenueCat (secret key, server-only)
// pelo entitlement 'pro' do usuário e grava NA HORA. O webhook CONTINUA dono das
// renovações/cancelamentos/billing issues — este endpoint só COMPLEMENTA o alias.
//
// Auth Bearer + CORS: espelha as demais rotas nativas (getRequestUser cookie/
// Bearer; preflight OPTIONS e headers de CORS pelo middleware proxy.ts, que lista
// esta rota em NATIVE_API). Relocada para fora do export nativo por
// scripts/build-native.sh (que move `app/api` inteiro).

const ENTITLEMENT_ID = 'pro';
const RC_SUBSCRIBERS_URL = 'https://api.revenuecat.com/v1/subscribers';

// ── Tipos do subscriber REST v1 (campos usados; o resto é ignorado) ─────────
type RCEntitlement = {
  expires_date?: string | null; // ISO; null = lifetime (não-assinatura)
  product_identifier?: string;
};
type RCStoreSubscription = {
  store?: string;
};
type RCSubscriber = {
  entitlements?: Record<string, RCEntitlement>;
  subscriptions?: Record<string, RCStoreSubscription>;
};

// billing_cycle a partir do product_identifier. Mesma heurística do webhook:
// robusta p/ ids iOS ('pro_annual') e base plans Android ('pro:annual').
function detectBillingCycle(productId: string | undefined): 'monthly' | 'annual' | null {
  if (!productId) return null;
  const p = productId.toLowerCase();
  if (p.includes('annual') || p.includes('anual') || p.includes('year')) return 'annual';
  if (p.includes('month') || p.includes('mens')) return 'monthly';
  return null;
}

// 'APP_STORE'/'MAC_APP_STORE' → 'app_store'; 'PLAY_STORE' → 'play_store'; resto
// vira lowercase (auditoria). Mesma normalização do webhook.
function normalizeStore(store: string | undefined): string | null {
  if (!store) return null;
  const s = store.toUpperCase();
  if (s === 'APP_STORE' || s === 'MAC_APP_STORE') return 'app_store';
  if (s === 'PLAY_STORE') return 'play_store';
  return store.toLowerCase();
}

// Entitlement 'pro' ativo? Existe E (expires_date no futuro OU null = lifetime).
function isEntitlementActive(ent: RCEntitlement | undefined): boolean {
  if (!ent) return false;
  const expires = ent.expires_date;
  if (expires === null || expires === undefined) return true; // lifetime
  const t = Date.parse(expires);
  return Number.isFinite(t) && t > Date.now();
}

type SubState = {
  plan: 'pro';
  status: 'active';
  billing_cycle: 'monthly' | 'annual' | null;
  current_period_end?: string;
};

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? '');
}

// Upsert por user_id (idempotente). Escreve plan/status/etc + revenuecat_app_user_id;
// store/entitlement são OPCIONAIS (auditoria). Se as colunas da migration não
// existirem, degrada em cascata sem perder a escrita de estado (o que importa p/
// o isPro). MESMO padrão resiliente do webhook RevenueCat/Kiwify.
async function upsertSubscription(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  state: SubState,
  appUserId: string,
  store: string | null,
  entitlement: string | null,
): Promise<void> {
  const base = { user_id: userId, ...state };
  const ladder: Record<string, unknown>[] = [
    { ...base, revenuecat_app_user_id: appUserId, store, entitlement },
    { ...base, revenuecat_app_user_id: appUserId },
    { ...base },
  ];
  for (let i = 0; i < ladder.length; i++) {
    const { error } = await admin
      .from('subscriptions')
      .upsert(ladder[i], { onConflict: 'user_id' });
    if (!error) {
      if (i > 0) {
        console.warn(
          `[subscription-sync] colunas ausentes — escrita degradada (nível ${i}). Aplique a migration (revenuecat_app_user_id/store/entitlement).`,
        );
      }
      return;
    }
    if (!isMissingColumn(error) || i === ladder.length - 1) {
      console.error('[subscription-sync] upsert error', error);
      throw new Error(`subscriptions upsert failed: ${error.message}`);
    }
  }
}

export async function POST(req: NextRequest) {
  const { user } = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const secret = process.env.REVENUECAT_SECRET_KEY;
  if (!secret) {
    console.error('[subscription-sync] REVENUECAT_SECRET_KEY não configurada');
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  // Consulta o RevenueCat pelo app_user_id = user.id (o alias pós-cadastro já
  // amarrou a compra anônima a este id). 404 = sem compras → { pro: false }.
  let subscriber: RCSubscriber | null = null;
  try {
    const res = await fetch(`${RC_SUBSCRIBERS_URL}/${encodeURIComponent(user.id)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 404) {
      return NextResponse.json({ pro: false });
    }
    if (!res.ok) {
      console.error('[subscription-sync] RevenueCat respondeu', res.status);
      return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
    }
    const body = (await res.json()) as { subscriber?: RCSubscriber };
    subscriber = body.subscriber ?? null;
  } catch (err) {
    console.error('[subscription-sync] falha ao consultar RevenueCat:', err);
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
  }

  const ent = subscriber?.entitlements?.[ENTITLEMENT_ID];
  if (!isEntitlementActive(ent)) {
    // NÃO ativo → no-op. NUNCA rebaixa: não toca em assinaturas Kiwify/manual/
    // coupon existentes — só grava quando o RevenueCat confirma 'pro' ativo.
    return NextResponse.json({ pro: false });
  }

  const productId = ent?.product_identifier;
  const store = normalizeStore(
    productId ? subscriber?.subscriptions?.[productId]?.store : undefined,
  );
  const expires = ent?.expires_date ?? undefined;

  const admin = createAdminClient();
  await upsertSubscription(
    admin,
    user.id,
    {
      plan: 'pro',
      status: 'active',
      billing_cycle: detectBillingCycle(productId),
      ...(expires ? { current_period_end: expires } : {}),
    },
    user.id,
    store,
    ENTITLEMENT_ID,
  );

  return NextResponse.json({ pro: true });
}
