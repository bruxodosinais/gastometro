import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20), 100);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('push_history')
    .select('id, title, message, target, sent_count, failed_count, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[push/history] erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
