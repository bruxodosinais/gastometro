import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const admin = createAdminClient();
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') ?? '1');
  const limit = parseInt(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const filter = searchParams.get('filter') ?? 'all';
  const orderBy = searchParams.get('orderBy') ?? 'created_at';

  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 });

  // Bloqueos
  const { data: blocks } = await admin.from('user_blocks').select('user_id');
  const blockedSet = new Set(blocks?.map(b => b.user_id) ?? []);

  // Lançamentos por usuário
  const { data: expenses } = await admin.from('expenses').select('user_id');
  const launchCount: Record<string, number> = {};
  for (const e of (expenses ?? [])) {
    launchCount[e.user_id] = (launchCount[e.user_id] ?? 0) + 1;
  }

  // Recorrentes e cartões
  const { data: recurringRows } = await admin.from('recurring_expenses').select('user_id');
  const recurringSet = new Set(recurringRows?.map(r => r.user_id) ?? []);
  const { data: cardRows } = await admin.from('credit_cards').select('user_id');
  const cardSet = new Set(cardRows?.map(r => r.user_id) ?? []);

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: recentExpenses } = await admin.from('expenses').select('user_id, date').gte('date', sevenDaysAgo.toISOString().split('T')[0]);
  const activeSet = new Set(recentExpenses?.map(e => e.user_id) ?? []);

  // Assinaturas. `store` ('app_store' | 'play_store') é gravado pelo webhook do
  // RevenueCat e é o que diz de qual loja veio o Pro — o antigo rótulo "Kiwify"
  // não existe mais (checkout web foi removido; só se assina dentro do app).
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id, plan, billing_cycle, store');
  const subMap = new Map<string, { plan: string; billing_cycle: string | null; store: string | null }>();
  for (const s of (subs ?? [])) {
    subMap.set(s.user_id, {
      plan: s.plan,
      billing_cycle: s.billing_cycle ?? null,
      store: (s as { store?: string | null }).store ?? null,
    });
  }

  // Push. Duas fontes distintas e independentes:
  //   device_tokens     → push NATIVO (FCM), com `platform` = 'ios' | 'android'
  //   push_subscriptions → push WEB (VAPID), sem plataforma
  // Um mesmo usuário pode ter as duas (instalou o app E ativou no navegador).
  const { data: deviceTokens } = await admin.from('device_tokens').select('user_id, platform');
  const pushIosSet = new Set<string>();
  const pushAndroidSet = new Set<string>();
  for (const d of (deviceTokens ?? [])) {
    if (d.platform === 'ios') pushIosSet.add(d.user_id);
    else if (d.platform === 'android') pushAndroidSet.add(d.user_id);
  }

  const { data: webPush } = await admin.from('push_subscriptions').select('user_id');
  const pushWebSet = new Set(webPush?.map(r => r.user_id) ?? []);

  let users = allUsers.map(u => {
    const sub = subMap.get(u.id);
    return {
      id: u.id,
      email: u.email ?? '',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      email_confirmed_at: u.email_confirmed_at ?? null,
      launches_count: launchCount[u.id] ?? 0,
      has_recurring: recurringSet.has(u.id),
      has_credit_card: cardSet.has(u.id),
      is_blocked: blockedSet.has(u.id),
      is_active: activeSet.has(u.id),
      plan: sub?.plan ?? 'free',
      billing_cycle: sub?.billing_cycle ?? null,
      store: sub?.store ?? null,
      push_ios: pushIosSet.has(u.id),
      push_android: pushAndroidSet.has(u.id),
      push_web: pushWebSet.has(u.id),
    };
  });

  // Filtros
  if (search) users = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));
  if (filter === 'confirmed') users = users.filter(u => u.email_confirmed_at);
  if (filter === 'unconfirmed') users = users.filter(u => !u.email_confirmed_at);
  if (filter === 'active') users = users.filter(u => u.is_active);
  if (filter === 'inactive') users = users.filter(u => !u.is_active);
  if (filter === 'blocked') users = users.filter(u => u.is_blocked);
  if (filter === 'pro') users = users.filter(u => u.plan === 'pro');
  if (filter === 'free') users = users.filter(u => u.plan !== 'pro');
  // Push ligado = tem QUALQUER canal (nativo iOS/Android ou web).
  if (filter === 'push_on') users = users.filter(u => u.push_ios || u.push_android || u.push_web);
  if (filter === 'push_off') users = users.filter(u => !u.push_ios && !u.push_android && !u.push_web);
  // "Usou o app" é inferido de push nativo OU assinatura feita na loja. Quem
  // instalou e recusou notificação sem assinar NÃO aparece aqui — é o limite
  // de não gravarmos a plataforma no perfil.
  if (filter === 'ios') users = users.filter(u => u.push_ios || u.store === 'app_store');
  if (filter === 'android') users = users.filter(u => u.push_android || u.store === 'play_store');
  if (filter === 'web_only') {
    users = users.filter(u => !u.push_ios && !u.push_android && u.store !== 'app_store' && u.store !== 'play_store');
  }

  // Ordenação
  users.sort((a, b) => {
    if (orderBy === 'launches') return b.launches_count - a.launches_count;
    if (orderBy === 'last_sign_in_at') {
      return new Date(b.last_sign_in_at ?? 0).getTime() - new Date(a.last_sign_in_at ?? 0).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const total = users.length;
  const offset = (page - 1) * limit;
  const paged = users.slice(offset, offset + limit);

  return NextResponse.json({ users: paged, total, page, limit });
}
