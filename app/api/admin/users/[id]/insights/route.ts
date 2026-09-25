import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';
import { loadUserInsights } from '@/lib/adminUserInsights';

// Raio-X de um usuário para /admin/usuario?id=… — ver lib/adminUserInsights.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { id } = await params;
  const insights = await loadUserInsights(createAdminClient(), id);
  if (!insights) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

  return NextResponse.json(insights);
}
