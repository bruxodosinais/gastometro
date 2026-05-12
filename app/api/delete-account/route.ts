import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { confirm?: boolean };
  if (!body.confirm) {
    return NextResponse.json({ error: 'Confirmação necessária.' }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Configuração do servidor incompleta.' }, { status: 500 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tables = [
    'expenses',
    'recurring_expenses',
    'budgets',
    'monthly_plans',
    'credit_cards',
    'monthly_obligations',
    'goals',
    'goal_contributions',
    'assets',
    'liabilities',
    'profiles',
  ];

  for (const table of tables) {
    await admin.from(table).delete().eq('user_id', user.id);
  }
  // profiles usa coluna id (FK para auth.users)
  await admin.from('profiles').delete().eq('id', user.id);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: 'Erro ao excluir conta. Tente novamente.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
