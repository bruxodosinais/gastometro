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

  let users = allUsers.map(u => ({
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
  }));

  // Filtros
  if (search) users = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));
  if (filter === 'confirmed') users = users.filter(u => u.email_confirmed_at);
  if (filter === 'unconfirmed') users = users.filter(u => !u.email_confirmed_at);
  if (filter === 'active') users = users.filter(u => u.is_active);
  if (filter === 'inactive') users = users.filter(u => !u.is_active);
  if (filter === 'blocked') users = users.filter(u => u.is_blocked);

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
