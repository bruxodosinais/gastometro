import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface Body {
  phone?: string;
}

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutos

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Vinculação de WhatsApp é exclusiva do plano Pro.
  const { data: sub } = await admin
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle();
  const isPro = sub?.plan === 'pro' && sub?.status === 'active';
  if (!isPro) {
    return NextResponse.json(
      { error: 'Vinculação de WhatsApp é exclusiva do plano Pro.' },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const phone = (body.phone ?? '').replace(/\D/g, '');

  // Formato esperado: DDI 55 + DDD + número. 12 dígitos (fixo antigo) ou 13 (celular).
  if (!/^\d{12,13}$/.test(phone)) {
    return NextResponse.json({ error: 'Número de telefone inválido.' }, { status: 400 });
  }

  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  const { error: upsertErr } = await admin.from('profiles').upsert({
    id: user.id,
    whatsapp_phone: phone,
    whatsapp_verified: false,
    whatsapp_otp: otp,
    whatsapp_otp_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });

  if (upsertErr) {
    console.error('[whatsapp/link-otp] erro upsert:', upsertErr);
    return NextResponse.json({ error: 'Erro ao gerar código.' }, { status: 500 });
  }

  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const evolutionKey = process.env.EVOLUTION_API_KEY;
  const evolutionInstance = process.env.EVOLUTION_INSTANCE;
  if (!evolutionUrl || !evolutionKey || !evolutionInstance) {
    console.error('[whatsapp/link-otp] Evolution API não configurada.');
    return NextResponse.json({ error: 'Serviço indisponível no momento.' }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${evolutionUrl}/message/sendText/${evolutionInstance}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: phone,
          text: `Seu código de verificação TôOrganizado: ${otp}\n\nVálido por 10 minutos.`,
        }),
      },
    );
    if (!res.ok) {
      console.error('[whatsapp/link-otp] Evolution respondeu', res.status, await res.text().catch(() => ''));
      return NextResponse.json({ error: 'Não foi possível enviar o código.' }, { status: 502 });
    }
  } catch (err) {
    console.error('[whatsapp/link-otp] falha ao chamar Evolution:', err);
    return NextResponse.json({ error: 'Não foi possível enviar o código.' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
