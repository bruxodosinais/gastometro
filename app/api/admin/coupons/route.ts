import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient, isAdmin } from '@/lib/supabase/admin';

async function requireAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) };
  if (!(await isAdmin(user.id))) return { error: NextResponse.json({ error: 'Acesso negado.' }, { status: 403 }) };
  return { user };
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('coupons')
    .select('id, code, days, max_uses, uses, active, created_at, expires_at')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Erro ao buscar cupons.' }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({})) as {
    code?: string;
    days?: number;
    max_uses?: number;
    expires_at?: string | null;
  };

  const code = (body.code ?? generateCode()).toUpperCase().trim();
  const days = Number.isFinite(body.days) ? Math.max(1, Math.floor(body.days as number)) : 30;
  const maxUses = Number.isFinite(body.max_uses) ? Math.max(0, Math.floor(body.max_uses as number)) : 1;
  const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return NextResponse.json({ error: 'Código inválido (use 3-32 caracteres A-Z, 0-9, _ ou -).' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('coupons')
    .insert({
      code,
      days,
      max_uses: maxUses,
      uses: 0,
      active: true,
      created_by: auth.user!.id,
      expires_at: expiresAt,
    })
    .select('id, code, days, max_uses, uses, active, created_at, expires_at')
    .single();

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Código já existe.' }, { status: 400 });
    return NextResponse.json({ error: 'Erro ao criar cupom.' }, { status: 500 });
  }
  return NextResponse.json({ coupon: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({})) as { id?: string; active?: boolean };
  if (!body.id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from('coupons')
    .update({ active: body.active ?? false })
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: 'Erro ao atualizar cupom.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
