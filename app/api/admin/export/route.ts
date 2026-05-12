import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const admin = createAdminClient();
  const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ perPage: 10000 });

  const { data: blocks } = await admin.from('user_blocks').select('user_id');
  const blockedSet = new Set(blocks?.map(b => b.user_id) ?? []);
  const { data: expenses } = await admin.from('expenses').select('user_id');
  const launchCount: Record<string, number> = {};
  for (const e of (expenses ?? [])) launchCount[e.user_id] = (launchCount[e.user_id] ?? 0) + 1;
  const { data: recurringRows } = await admin.from('recurring_expenses').select('user_id');
  const recurringSet = new Set(recurringRows?.map(r => r.user_id) ?? []);
  const { data: cardRows } = await admin.from('credit_cards').select('user_id');
  const cardSet = new Set(cardRows?.map(r => r.user_id) ?? []);

  const header = 'id,email,cadastro,confirmado,ultimo_acesso,lancamentos,tem_recorrente,tem_cartao,bloqueado\n';
  const rows = allUsers.map(u => [
    u.id,
    `"${u.email ?? ''}"`,
    u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : '',
    u.email_confirmed_at ? 'sim' : 'não',
    u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString().split('T')[0] : '',
    launchCount[u.id] ?? 0,
    recurringSet.has(u.id) ? 'sim' : 'não',
    cardSet.has(u.id) ? 'sim' : 'não',
    blockedSet.has(u.id) ? 'sim' : 'não',
  ].join(',')).join('\n');

  const csv = header + rows;
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="usuarios-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
