import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_CATEGORIES = new Set(['bug', 'sugestao', 'elogio', 'outro']);

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    category?: string;
    message?: string;
    page?: string;
  };

  const category = typeof body.category === 'string' ? body.category.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const page = typeof body.page === 'string' ? body.page.trim().slice(0, 200) : null;

  if (!ALLOWED_CATEGORIES.has(category)) {
    return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: 'Mensagem precisa ter no mínimo 10 caracteres.' }, { status: 400 });
  }
  if (message.length > 500) {
    return NextResponse.json({ error: 'Mensagem excede 500 caracteres.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('feedback').insert({
    user_id: user.id,
    category,
    message,
    page,
  });

  if (error) {
    return NextResponse.json({ error: 'Erro ao salvar feedback.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
