import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface Body {
  otp?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const otp = (body.otp ?? '').replace(/\D/g, '');
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ error: 'Código inválido.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile, error } = await admin
    .from('profiles')
    .select('whatsapp_otp, whatsapp_otp_expires_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[whatsapp/verify-otp] erro select:', error);
    return NextResponse.json({ error: 'Erro ao verificar código.' }, { status: 500 });
  }

  if (!profile?.whatsapp_otp || !profile.whatsapp_otp_expires_at) {
    return NextResponse.json({ error: 'Nenhum código pendente. Solicite um novo.' }, { status: 400 });
  }

  if (new Date(profile.whatsapp_otp_expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'Código expirado. Solicite um novo.' }, { status: 400 });
  }

  if (profile.whatsapp_otp !== otp) {
    return NextResponse.json({ error: 'Código incorreto.' }, { status: 400 });
  }

  const { error: updateErr } = await admin.from('profiles').upsert({
    id: user.id,
    whatsapp_verified: true,
    whatsapp_otp: null,
    whatsapp_otp_expires_at: null,
    updated_at: new Date().toISOString(),
  });

  if (updateErr) {
    console.error('[whatsapp/verify-otp] erro upsert:', updateErr);
    return NextResponse.json({ error: 'Erro ao confirmar verificação.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
