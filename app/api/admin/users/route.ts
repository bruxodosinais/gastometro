import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';
import { EMPTY_PLATFORM, loadUserPlatforms } from '@/lib/adminPlatform';
import { isRealUser } from '@/lib/cohort';
import { fetchAll } from '@/lib/adminFetchAll';

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
  const expenses = await fetchAll<{ user_id: string; created_at: string }>(
    (from, to) => admin.from('expenses').select('user_id, created_at').order('id').range(from, to),
  );
  const launchCount: Record<string, number> = {};
  // "Visto por último" e dias ativos. `last_sign_in_at` é o último LOGIN — com a
  // sessão salva no app ele quase não muda, então não diz se a pessoa ainda usa.
  // Vale o mais recente entre acesso (user_activity), lançamento e login.
  const lastSeenTs = new Map<string, number>();
  const activeDays = new Map<string, Set<string>>();
  const seen = (userId: string, ts: number, day: string) => {
    if (ts > (lastSeenTs.get(userId) ?? 0)) lastSeenTs.set(userId, ts);
    let set = activeDays.get(userId);
    if (!set) activeDays.set(userId, (set = new Set()));
    set.add(day);
  };
  for (const e of expenses) {
    launchCount[e.user_id] = (launchCount[e.user_id] ?? 0) + 1;
    const ts = new Date(e.created_at).getTime();
    seen(e.user_id, ts, new Date(ts - 3 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  const activity = await fetchAll<{ user_id: string; active_date: string }>(
    (from, to) => admin.from('user_activity').select('user_id, active_date')
      .order('user_id').order('active_date').range(from, to),
  );
  // active_date já é o dia de Brasília; meio-dia local evita virar o dia.
  for (const a of activity) seen(a.user_id, Date.parse(`${a.active_date}T12:00:00-03:00`), a.active_date);

  const { data: profiles } = await admin.from('profiles').select('id, name');
  const nameOf = new Map((profiles ?? []).map(p => [p.id as string, (p.name as string | null) ?? null]));

  // Recorrentes e cartões
  const { data: recurringRows } = await admin.from('recurring_expenses').select('user_id');
  const recurringSet = new Set(recurringRows?.map(r => r.user_id) ?? []);
  const { data: cardRows } = await admin.from('credit_cards').select('user_id');
  const cardSet = new Set(cardRows?.map(r => r.user_id) ?? []);

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentExpenses = await fetchAll<{ user_id: string }>(
    (from, to) => admin.from('expenses').select('user_id').gte('date', sevenDaysAgo.toISOString().split('T')[0]).order('id').range(from, to),
  );
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

  // Plataforma: push nativo + loja + eventos do funil (app 1.4+). Ver lib/adminPlatform.
  const platforms = await loadUserPlatforms(admin);

  let users = allUsers.map(u => {
    const sub = subMap.get(u.id);
    const plat = platforms.get(u.id) ?? EMPTY_PLATFORM;
    const loginTs = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
    const seenTs = Math.max(lastSeenTs.get(u.id) ?? 0, loginTs);
    return {
      id: u.id,
      email: u.email ?? '',
      name: nameOf.get(u.id) ?? (u.user_metadata?.full_name as string | undefined) ?? null,
      created_at: u.created_at,
      last_seen_at: seenTs > 0 ? new Date(seenTs).toISOString() : null,
      active_days: activeDays.get(u.id)?.size ?? 0,
      real_cohort: isRealUser(u.created_at),
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
      app_ios: plat.ios,
      app_android: plat.android,
      signup_platform: plat.signup,
    };
  });

  // Filtros
  if (search) {
    const q = search.toLowerCase();
    users = users.filter(u => u.email.toLowerCase().includes(q) || (u.name ?? '').toLowerCase().includes(q));
  }
  if (filter === 'cohort_real') users = users.filter(u => u.real_cohort);
  if (filter === 'cohort_legacy') users = users.filter(u => !u.real_cohort);
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
  // "Usou o app": push nativo, assinatura na loja OU evento do funil vindo do
  // app (1.4+). Conta antiga que instalou, recusou push e não assinou continua
  // caindo em "Só web" — a plataforma dela nunca foi gravada.
  if (filter === 'ios') users = users.filter(u => u.app_ios);
  if (filter === 'android') users = users.filter(u => u.app_android);
  if (filter === 'web_only') users = users.filter(u => !u.app_ios && !u.app_android);

  // Ordenação
  users.sort((a, b) => {
    if (orderBy === 'launches') return b.launches_count - a.launches_count;
    if (orderBy === 'active_days') return b.active_days - a.active_days;
    if (orderBy === 'last_seen_at') {
      return new Date(b.last_seen_at ?? 0).getTime() - new Date(a.last_seen_at ?? 0).getTime();
    }
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
