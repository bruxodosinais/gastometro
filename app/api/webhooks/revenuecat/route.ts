import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Webhook do RevenueCat → torna o BACKEND a fonte de verdade do isPro. Espelha o
// padrão do webhook Kiwify (runtime nodejs, force-dynamic, rate limit best-effort,
// escrita via service role em `subscriptions` — a MESMA tabela que useSubscription
// lê). SÓ este webhook escreve plan/status; o entitlement 'pro' do RevenueCat
// define pro vs free.
//
// Esta rota é RELOCADA para fora do export nativo por scripts/build-native.sh
// (que move `app/api` inteiro) → não vai pro bundle estático do Capacitor.
//
// ⚠️ No painel RevenueCat a URL do webhook TEM que ser https://www.toorganizado.com.br/...
// (com WWW): o apex faz 307 e o redirect cross-host DERRUBA o header Authorization.

const ENTITLEMENT_ID = 'pro';

// Rate limit in-memory (best-effort: serverless multi-instância). Folgado p/ o
// RevenueCat legítimo e barra brute force de token.
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    rateLimitBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Comparação constante-tempo. Se os tamanhos diferem, timingSafeEqual lança —
// fazemos uma comparação fake do mesmo tamanho para não vazar o comprimento.
function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    try {
      timingSafeEqual(a, Buffer.alloc(a.length));
    } catch {
      /* ignora */
    }
    return false;
  }
  return timingSafeEqual(a, b);
}

// ── Tipos do payload RevenueCat ────────────────────────────────────────────
// Body = { api_version, event }. Campos usados abaixo; o resto é ignorado.
type RCEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[];
  entitlement_id?: string; // legado (evento antigo, singular)
  product_id?: string;
  expiration_at_ms?: number;
  store?: string;
  environment?: string;
  // TRANSFER:
  transferred_to?: string[];
  transferred_from?: string[];
  [key: string]: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve o user_id do Supabase entre os candidatos (app_user_id + aliases, ou
// transferred_to no TRANSFER). Pega o 1º que é UUID — os anônimos do RevenueCat
// vêm como "$RCAnonymousID:..." e nunca casam. null = compra ainda não aliasada
// a uma conta → o webhook responde 200 e ignora.
function resolveUserId(candidates: (string | undefined)[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && UUID_RE.test(c)) return c;
  }
  return null;
}

// billing_cycle a partir do product_id. Robusto p/ base plans do Android
// (ex.: 'pro:annual', 'pro:monthly') e ids iOS ('pro_annual', 'pro_monthly').
function detectBillingCycle(productId: string | undefined): 'monthly' | 'annual' | null {
  if (!productId) return null;
  const p = productId.toLowerCase();
  if (p.includes('annual') || p.includes('anual') || p.includes('year')) return 'annual';
  if (p.includes('month') || p.includes('mens')) return 'monthly';
  return null;
}

// 'APP_STORE'/'MAC_APP_STORE' → 'app_store'; 'PLAY_STORE' → 'play_store'; resto
// vira lowercase (auditoria).
function normalizeStore(store: string | undefined): string | null {
  if (!store) return null;
  const s = store.toUpperCase();
  if (s === 'APP_STORE' || s === 'MAC_APP_STORE') return 'app_store';
  if (s === 'PLAY_STORE') return 'play_store';
  return store.toLowerCase();
}

function entitlementOf(ev: RCEvent): string | null {
  const ids = ev.entitlement_ids ?? (ev.entitlement_id ? [ev.entitlement_id] : []);
  if (ids.includes(ENTITLEMENT_ID)) return ENTITLEMENT_ID;
  return ids[0] ?? null;
}

function msToIso(ms: number | undefined): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Estado de `subscriptions` por tipo de evento. undefined = não mexe no campo.
type SubState = {
  plan?: 'pro' | 'free';
  status?: 'active' | 'cancelled' | 'past_due';
  current_period_end?: string | null;
  billing_cycle?: 'monthly' | 'annual' | null;
};

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? '');
}

// Upsert por user_id (naturalmente idempotente). Escreve sempre plan/status/etc +
// revenuecat_app_user_id (coluna da migration). store/entitlement são OPCIONAIS
// (auditoria): se a migration deles não foi aplicada, degrada em cascata sem
// perder a escrita de estado (o que importa p/ o isPro).
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
          `[revenuecat-webhook] colunas ausentes — escrita degradada (nível ${i}). Aplique a migration (revenuecat_app_user_id/store/entitlement).`,
        );
      }
      return;
    }
    if (!isMissingColumn(error) || i === ladder.length - 1) {
      // Falha DURA de escrita (não é coluna-ausente, ou é o degrau core que
      // sempre deveria funcionar). PROPAGA → o POST responde 5xx e NÃO marca
      // dedup, pra o RevenueCat reentregar. Só a degradação por coluna-ausente
      // (acima) é tolerada e cai pro próximo nível.
      console.error('[revenuecat-webhook] upsert error', error);
      throw new Error(`subscriptions upsert failed: ${error.message}`);
    }
  }
}

function ok(payload: Record<string, unknown> = { ok: true }) {
  return NextResponse.json(payload, { status: 200 });
}

// ── Dedup (idempotência) ────────────────────────────────────────────────────
// A marcação em webhook_events acontece SÓ DEPOIS do processamento OK (ver POST),
// para que uma falha de escrita NÃO deixe o evento marcado — assim a reentrega
// do RevenueCat consegue reprocessar. Reprocessar é inócuo (upsert por user_id é
// idempotente); PERDER um evento não é.

// Leitura pura: este event.id já foi processado com sucesso antes? Só consulta,
// não marca. Erro de leitura → false (melhor reprocessar do que pular).
async function alreadyProcessed(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('webhook_events')
    .select('event_id')
    .eq('provider', 'revenuecat')
    .eq('event_id', eventId)
    .limit(1);
  if (error) {
    console.error('[revenuecat] falha ao consultar dedup:', error);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

// Marca o evento como processado. Chamado só após sucesso. 23505 = corrida
// benigna (outra entrega concorrente já registrou) → ignora. Outra falha é só
// logada: o estado já foi gravado; no pior caso um reprocess inócuo no futuro.
async function markProcessed(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  eventType: string,
): Promise<void> {
  const { error } = await admin
    .from('webhook_events')
    .insert({ provider: 'revenuecat', event_id: eventId, event_type: eventType });
  if (error && error.code !== '23505') {
    console.error('[revenuecat] falha ao registrar dedup pós-processamento:', error);
  }
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (!checkRateLimit(ip)) {
    console.warn('[revenuecat] rate limit excedido', { ip });
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Auth: o RevenueCat manda o header Authorization com o valor EXATO que
  // configuramos no painel → compara byte-a-byte (constante-tempo) com o secret.
  const expected = process.env.RC_WEBHOOK_TOKEN;
  if (!expected) {
    console.error('[revenuecat-webhook] RC_WEBHOOK_TOKEN não configurado');
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') ?? '';
  if (!auth || !safeEqual(auth, expected)) {
    console.warn('[revenuecat] Authorization inválido', { ip });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { event?: RCEvent };
  try {
    body = (await req.json()) as { event?: RCEvent };
  } catch {
    console.error('[revenuecat-webhook] payload inválido');
    return ok({ ok: true, ignored: 'invalid-payload' });
  }

  const ev = body.event;
  if (!ev || typeof ev.type !== 'string') {
    return ok({ ok: true, ignored: 'no-event' });
  }
  const type = ev.type.toUpperCase();

  const admin = createAdminClient();

  // ── Idempotência (leitura) ────────────────────────────────────────────────
  // Reentrega já processada com sucesso antes? Só CONSULTA — NÃO marca aqui. A
  // marcação é feita só DEPOIS do processamento OK (ver catch/marca abaixo), pra
  // que uma falha de escrita não deixe o evento marcado e bloqueie a reentrega.
  if (ev.id && (await alreadyProcessed(admin, ev.id))) {
    console.log('[revenuecat] evento duplicado ignorado:', ev.id, type);
    return ok({ ok: true, skipped: true });
  }

  try {
    const result = await processEvent(admin, ev, type);
    // Sucesso → marca dedup AGORA (nunca antes) e responde 200.
    if (ev.id) await markProcessed(admin, ev.id, type);
    return ok(result);
  } catch (err) {
    // Falha DURA (ex.: upsert propagou) → 5xx e SEM marcar dedup, pra o
    // RevenueCat reentregar e reprocessar (upsert por user_id é idempotente).
    console.error('[revenuecat-webhook] processamento falhou:', err);
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}

// Processa um evento e retorna o payload de resposta (200). LANÇA em falha dura
// de escrita — o POST traduz o throw em 5xx e não marca dedup.
async function processEvent(
  admin: ReturnType<typeof createAdminClient>,
  ev: RCEvent,
  type: string,
): Promise<Record<string, unknown>> {
  // Resolve a conta. TRANSFER usa transferred_to (novo dono); demais usam
  // app_user_id + aliases. Anônimo (sem UUID) → 200 e ignora.
  const candidates =
    type === 'TRANSFER'
      ? [...(ev.transferred_to ?? []), ...(ev.aliases ?? []), ev.app_user_id]
      : [ev.app_user_id, ...(ev.aliases ?? [])];
  const userId = resolveUserId(candidates);
  if (!userId) {
    console.log('[revenuecat] app_user_id anônimo — ignorado', { type });
    return { ok: true, ignored: 'anonymous' };
  }

  // Confirma que a conta existe (evita FK violation e mantém 200 limpo).
  const { data: userLookup, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userLookup?.user) {
    console.warn('[revenuecat] user_id não encontrado — ignorado', { type });
    return { ok: true, ignored: 'user-not-found' };
  }

  const appUserId = ev.app_user_id ?? userId;
  const store = normalizeStore(ev.store);
  const entitlement = entitlementOf(ev);
  const cycle = detectBillingCycle(ev.product_id);
  const periodEnd = msToIso(ev.expiration_at_ms);

  switch (type) {
    // Acesso Pro ativo. CANCELLATION entra aqui de propósito: é só auto-renov
    // desligada — o acesso vale até expirar; o EXPIRATION depois rebaixa.
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
    case 'CANCELLATION': {
      await upsertSubscription(
        admin,
        userId,
        {
          plan: 'pro',
          status: 'active',
          billing_cycle: cycle,
          ...(periodEnd ? { current_period_end: periodEnd } : {}),
        },
        appUserId,
        store,
        entitlement,
      );
      return { ok: true, type, userId, plan: 'pro' };
    }

    // Problema de cobrança: período de graça. Mantém plan='pro', marca past_due.
    case 'BILLING_ISSUE': {
      await upsertSubscription(
        admin,
        userId,
        {
          plan: 'pro',
          status: 'past_due',
          ...(cycle ? { billing_cycle: cycle } : {}),
          ...(periodEnd ? { current_period_end: periodEnd } : {}),
        },
        appUserId,
        store,
        entitlement,
      );
      return { ok: true, type, userId, status: 'past_due' };
    }

    // Assinatura expirou de fato → rebaixa pra free.
    case 'EXPIRATION': {
      await upsertSubscription(
        admin,
        userId,
        {
          plan: 'free',
          status: 'cancelled',
          current_period_end: periodEnd ?? new Date().toISOString(),
        },
        appUserId,
        store,
        entitlement,
      );
      return { ok: true, type, userId, plan: 'free' };
    }

    // Edge: assinatura transferida entre app_user_ids. Seta 'pro' no NOVO dono.
    case 'TRANSFER': {
      console.log('[revenuecat] TRANSFER — setando pro no novo app_user_id', {
        userId,
      });
      await upsertSubscription(
        admin,
        userId,
        {
          plan: 'pro',
          status: 'active',
          ...(cycle ? { billing_cycle: cycle } : {}),
          ...(periodEnd ? { current_period_end: periodEnd } : {}),
        },
        appUserId,
        store,
        entitlement,
      );
      return { ok: true, type, userId, plan: 'pro', transfer: true };
    }

    default:
      console.log('[revenuecat-webhook] evento ignorado:', type);
      return { ok: true, ignored: type };
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'revenuecat-webhook' });
}
