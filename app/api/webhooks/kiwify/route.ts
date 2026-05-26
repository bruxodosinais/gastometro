import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate limit in-memory (best-effort: serverless multi-instância, cada uma com
// seu mapa). 100 req/min por IP é folgado para a Kiwify legítima e barra
// brute force de token na URL.
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

// Comparação resistente a timing attacks. Quando os tamanhos diferem,
// timingSafeEqual lança — fazemos uma comparação fake do mesmo tamanho de
// `provided` para evitar oracle de comprimento.
function safeEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    try {
      timingSafeEqual(a, Buffer.alloc(a.length));
    } catch {
      // ignora
    }
    return false;
  }
  return timingSafeEqual(a, b);
}

function verifyHmac(secret: string, rawBody: string, signature: string): boolean {
  const computed = createHmac('sha1', secret).update(rawBody).digest('hex');
  return safeEqual(signature, computed);
}

type KiwifyPayload = {
  webhook_event?: string;
  webhook_event_type?: string;
  event?: string;
  order_id?: string;
  order_status?: string;
  Customer?: { email?: string; full_name?: string; first_name?: string };
  Subscription?: { id?: string; status?: string };
  Product?: { product_id?: string };
  product_id?: string;
  Commissions?: { charge_amount?: string | number; product_base_price?: string | number };
  CommissionAs?: unknown;
  charge_amount?: string | number;
  approved_date?: string;
  [key: string]: unknown;
};

function getEvent(p: KiwifyPayload): string {
  return (p.webhook_event ?? p.webhook_event_type ?? p.event ?? '').toString();
}

function parsePriceCents(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Math.round(value * 100);
  const cleaned = String(value).replace(/[^0-9.,-]/g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // Kiwify costuma mandar valor em centavos como inteiro grande (ex: "1990").
  // Heurística: se não tem ponto decimal e >= 100, é centavos.
  if (!String(value).includes('.') && !String(value).includes(',') && n >= 100) {
    return Math.round(n);
  }
  return Math.round(n * 100);
}

function detectBillingCycle(p: KiwifyPayload): 'monthly' | 'annual' | null {
  const sub = (p.Subscription ?? {}) as Record<string, unknown>;
  const prod = (p.Product ?? {}) as Record<string, unknown>;
  const subPlan = (sub.plan ?? {}) as Record<string, unknown>;

  const candidates: unknown[] = [
    p.charge_amount,
    p.Commissions?.charge_amount,
    p.Commissions?.product_base_price,
    sub.charge_amount,
    sub.price,
    sub.amount,
    subPlan.price,
    subPlan.amount,
    subPlan.charge_amount,
    prod.price,
    prod.amount,
    (p as Record<string, unknown>).plan_amount,
    (p as Record<string, unknown>).total_amount,
    (p as Record<string, unknown>).amount,
  ];
  for (const c of candidates) {
    const cents = parsePriceCents(c);
    if (cents == null) continue;
    if (cents === 1990 || (cents >= 1900 && cents <= 2099)) return 'monthly';
    if (cents === 14700 || (cents >= 14000 && cents <= 15000)) return 'annual';
  }

  // Fallback por frequência declarada no payload (ex.: "monthly" | "yearly")
  const freqCandidates: unknown[] = [
    subPlan.frequency,
    subPlan.interval,
    sub.frequency,
    sub.interval,
    (p as Record<string, unknown>).frequency,
    (p as Record<string, unknown>).interval,
  ];
  for (const f of freqCandidates) {
    if (typeof f !== 'string') continue;
    const v = f.toLowerCase();
    if (v.includes('year') || v.includes('annual') || v.includes('anual')) return 'annual';
    if (v.includes('month') || v.includes('mens')) return 'monthly';
  }

  return null;
}

function periodEndFromCycle(cycle: 'monthly' | 'annual' | null): string {
  const d = new Date();
  if (cycle === 'annual') d.setDate(d.getDate() + 365);
  else d.setDate(d.getDate() + 30);
  return d.toISOString();
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  // listUsers não filtra por e-mail diretamente; paginar até encontrar.
  let page = 1;
  // perPage máx 1000 no Supabase
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const found = data.users.find((u) => (u.email ?? '').toLowerCase() === normalized);
    if (found) return found.id;
    if (data.users.length < 1000) return null;
    page += 1;
    if (page > 50) return null; // segurança
  }
}

async function sendWelcomeProEmail(email: string, name?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[kiwify-webhook] RESEND_API_KEY ausente; pulando e-mail de boas-vindas');
    return;
  }
  try {
    const resend = new Resend(apiKey);
    const greeting = name ? `Olá, ${name}!` : 'Olá!';
    await resend.emails.send({
      from: 'TôOrganizado <noreply@toorganizado.com.br>',
      to: email,
      subject: 'Bem-vindo ao TôOrganizado Pro 🚀',
      html: `
        <div style="font-family: Nunito, Arial, sans-serif; max-width: 540px; margin: auto; padding: 32px 24px; background: #F7F7F5; border-radius: 16px;">
          <h1 style="color: #5B5BD6; margin-bottom: 8px;">TôOrganizado Pro</h1>
          <p style="font-size: 16px; color: #1A1A1A;">${greeting}</p>
          <p style="font-size: 15px; color: #6B6B6B;">Sua assinatura <strong>Pro</strong> foi ativada com sucesso. Agora você tem acesso a:</p>
          <ul style="font-size: 14px; color: #1A1A1A; line-height: 1.7;">
            <li>Lançamentos ilimitados</li>
            <li>Recorrentes ilimitados</li>
            <li>GastôBot sem limites</li>
            <li>Metas financeiras</li>
            <li>Controle de patrimônio</li>
            <li>Cartões de crédito</li>
          </ul>
          <a href="https://www.toorganizado.com.br" style="display: inline-block; margin-top: 24px; padding: 14px 28px; background: #5B5BD6; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">Abrir o app</a>
          <p style="margin-top: 32px; font-size: 12px; color: #B4B4AA;">Qualquer dúvida, basta responder este e-mail.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[kiwify-webhook] erro Resend:', err);
  }
}

function ok(payload: Record<string, unknown> = { ok: true }) {
  return NextResponse.json(payload, { status: 200 });
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  if (!checkRateLimit(ip)) {
    console.warn('[kiwify] rate limit excedido', { ip });
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Dois modos de auth, em ordem de preferência:
  //   1) HMAC: KIWIFY_WEBHOOK_SECRET setado + ?signature= no query string.
  //      Kiwify envia HMAC-SHA1(rawBody, secret) em hex. Imune a replay
  //      de token vazado, pois o atacante precisaria do secret para
  //      assinar QUALQUER payload.
  //   2) Token estático (legado): KIWIFY_WEBHOOK_TOKEN comparado a
  //      Authorization Bearer / ?token= / ?signature=. Mantido para
  //      compat com configs antigas; deve ser desativado migrando o
  //      webhook na Kiwify para o secret HMAC.
  const hmacSecret = process.env.KIWIFY_WEBHOOK_SECRET;
  const expectedToken = process.env.KIWIFY_WEBHOOK_TOKEN;
  if (!hmacSecret && !expectedToken) {
    console.error('[kiwify-webhook] nenhum método de auth configurado (defina KIWIFY_WEBHOOK_SECRET para HMAC ou KIWIFY_WEBHOOK_TOKEN para legado)');
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  // Lê o body como texto UMA vez. Necessário para HMAC (precisa do raw)
  // e para o fallback de form-urlencoded.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const url = new URL(req.url);
  const signature = url.searchParams.get('signature');
  const qToken = url.searchParams.get('token');
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();

  let authenticated = false;
  if (hmacSecret && signature) {
    authenticated = verifyHmac(hmacSecret, rawBody, signature);
  }
  if (!authenticated && expectedToken) {
    const provided = auth || qToken || signature || '';
    authenticated = provided.length > 0 && safeEqual(provided, expectedToken);
  }
  if (!authenticated) {
    console.warn('[kiwify] token inválido', { ip });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: KiwifyPayload;
  try {
    payload = JSON.parse(rawBody) as KiwifyPayload;
  } catch {
    console.error('[kiwify-webhook] payload inválido');
    return ok({ ok: true, ignored: 'invalid-payload' });
  }

  const event = getEvent(payload).toLowerCase();

  // TEMP DEBUG — remover após inspecionar o formato real do payload da Kiwify
  // (em especial os campos que carregam o preço/cycle do plano comprado).
  // Habilitar com KIWIFY_DEBUG=1 no .env.local.
  if (process.env.KIWIFY_DEBUG === '1') {
    try {
      console.log('[kiwify-webhook][DEBUG] event:', event);
      console.log('[kiwify-webhook][DEBUG] payload keys:', Object.keys(payload));
      console.log(
        '[kiwify-webhook][DEBUG] payload:',
        JSON.stringify(payload, null, 2),
      );
      console.log(
        '[kiwify-webhook][DEBUG] detected cycle:',
        detectBillingCycle(payload),
      );
    } catch {
      // ignora falha de log
    }
  }

  const admin = createAdminClient();

  try {
    if (
      event === 'order_approved' ||
      event === 'order_paid' ||
      event === 'subscription_approved' ||
      event === 'subscription_renewed'
    ) {
      const email = payload.Customer?.email;
      const orderId = payload.order_id ?? null;
      const subId = payload.Subscription?.id ?? null;
      if (!email) {
        console.warn('[kiwify] webhook error', { event });
        return ok({ ok: true, ignored: 'no-email' });
      }
      const userId = await findUserIdByEmail(admin, email);
      if (!userId) {
        console.warn('[kiwify] webhook error', { event });
        return ok({ ok: true, ignored: 'user-not-found' });
      }

      const cycle = detectBillingCycle(payload);
      const periodEnd = periodEndFromCycle(cycle);

      const { error } = await admin
        .from('subscriptions')
        .upsert(
          {
            user_id: userId,
            plan: 'pro',
            status: 'active',
            billing_cycle: cycle,
            kiwify_order_id: orderId,
            kiwify_subscription_id: subId,
            current_period_end: periodEnd,
          },
          { onConflict: 'user_id' },
        );
      if (error) {
        console.error('[kiwify-webhook] upsert error', error);
      } else {
        const customerName =
          payload.Customer?.first_name ?? payload.Customer?.full_name?.split(' ')[0];
        await sendWelcomeProEmail(email, customerName);
      }
      return ok();
    }

    if (
      event === 'order_refunded' ||
      event === 'order_cancelled' ||
      event === 'order_canceled' ||
      event === 'subscription_cancelled' ||
      event === 'subscription_canceled' ||
      event === 'chargeback'
    ) {
      const orderId = payload.order_id ?? null;
      const subId = payload.Subscription?.id ?? null;
      let query = admin.from('subscriptions').select('user_id');
      if (subId) query = query.eq('kiwify_subscription_id', subId);
      else if (orderId) query = query.eq('kiwify_order_id', orderId);
      else {
        // fallback por email
        const email = payload.Customer?.email;
        if (!email) return ok({ ok: true, ignored: 'no-identifier' });
        const userId = await findUserIdByEmail(admin, email);
        if (!userId) return ok({ ok: true, ignored: 'user-not-found' });
        await admin
          .from('subscriptions')
          .update({
            plan: 'free',
            status: 'cancelled',
            current_period_end: new Date().toISOString(),
          })
          .eq('user_id', userId);
        return ok();
      }
      const { data: rows } = await query;
      const userIds = (rows ?? []).map((r) => r.user_id as string);
      if (userIds.length === 0) {
        return ok({ ok: true, ignored: 'subscription-not-found' });
      }
      const { error } = await admin
        .from('subscriptions')
        .update({
          plan: 'free',
          status: 'cancelled',
          current_period_end: new Date().toISOString(),
        })
        .in('user_id', userIds);
      if (error) console.error('[kiwify-webhook] update cancel error', error);
      return ok();
    }

    if (event === 'subscription_reactivated' || event === 'subscription_renewed_after_overdue') {
      const subId = payload.Subscription?.id ?? null;
      const orderId = payload.order_id ?? null;
      const update = admin.from('subscriptions').update({ plan: 'pro', status: 'active' });
      let q;
      if (subId) q = update.eq('kiwify_subscription_id', subId);
      else if (orderId) q = update.eq('kiwify_order_id', orderId);
      else {
        const email = payload.Customer?.email;
        if (!email) return ok({ ok: true, ignored: 'no-identifier' });
        const userId = await findUserIdByEmail(admin, email);
        if (!userId) return ok({ ok: true, ignored: 'user-not-found' });
        q = update.eq('user_id', userId);
      }
      const { error } = await q;
      if (error) console.error('[kiwify-webhook] reactivate error', error);
      return ok();
    }

    if (event === 'subscription_overdue' || event === 'subscription_past_due') {
      const subId = payload.Subscription?.id ?? null;
      const orderId = payload.order_id ?? null;
      const update = admin.from('subscriptions').update({ status: 'past_due' });
      let q;
      if (subId) q = update.eq('kiwify_subscription_id', subId);
      else if (orderId) q = update.eq('kiwify_order_id', orderId);
      else {
        const email = payload.Customer?.email;
        if (!email) return ok({ ok: true, ignored: 'no-identifier' });
        const userId = await findUserIdByEmail(admin, email);
        if (!userId) return ok({ ok: true, ignored: 'user-not-found' });
        q = update.eq('user_id', userId);
      }
      const { error } = await q;
      if (error) console.error('[kiwify-webhook] overdue error', error);
      return ok();
    }

    console.log('[kiwify-webhook] evento ignorado:', event);
    return ok({ ok: true, ignored: event || 'unknown' });
  } catch (err) {
    console.error('[kiwify-webhook] erro inesperado:', err);
    return ok({ ok: true, ignored: 'error' });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: 'kiwify-webhook' });
}
