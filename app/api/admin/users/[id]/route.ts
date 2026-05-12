import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: { user: targetUser } } = await admin.auth.admin.getUserById(id);
  if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

  const [{ data: expenses }, { data: recurring }, { data: cards }, { data: block }] = await Promise.all([
    admin.from('expenses').select('id').eq('user_id', id),
    admin.from('recurring_expenses').select('id').eq('user_id', id),
    admin.from('credit_cards').select('id').eq('user_id', id),
    admin.from('user_blocks').select('id').eq('user_id', id).maybeSingle(),
  ]);

  return NextResponse.json({
    id: targetUser.id,
    email: targetUser.email,
    created_at: targetUser.created_at,
    last_sign_in_at: targetUser.last_sign_in_at,
    email_confirmed_at: targetUser.email_confirmed_at,
    launches_count: expenses?.length ?? 0,
    has_recurring: (recurring?.length ?? 0) > 0,
    has_credit_card: (cards?.length ?? 0) > 0,
    is_blocked: !!block,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  const tables = [
    'expenses', 'recurring_expenses', 'budgets', 'monthly_plans',
    'credit_cards', 'monthly_obligations', 'goals', 'goal_contributions',
    'assets', 'liabilities', 'user_blocks', 'admins',
  ];
  for (const table of tables) {
    await admin.from(table).delete().eq('user_id', id);
  }
  await admin.from('profiles').delete().eq('id', id);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: 'Erro ao excluir usuário.' }, { status: 500 });

  return NextResponse.json({ success: true });
}
