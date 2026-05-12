import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { reason?: string };
  const admin = createAdminClient();

  const { error } = await admin.from('user_blocks').insert({
    user_id: id,
    blocked_by: user.id,
    reason: body.reason ?? null,
  });
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Erro ao bloquear usuário.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  await admin.from('user_blocks').delete().eq('user_id', id);
  return NextResponse.json({ success: true });
}
