import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? 're_placeholder');
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  if (!(await isAdmin(user.id))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { email?: string; name?: string };
  if (!body.email) return NextResponse.json({ error: 'E-mail obrigatório.' }, { status: 400 });

  const greeting = body.name ? `Olá, ${body.name}!` : 'Olá!';

  const { error } = await resend.emails.send({
    from: 'TôOrganizado <noreply@toorganizado.com.br>',
    to: body.email,
    subject: 'Você foi convidado para o TôOrganizado',
    html: `
      <div style="font-family: Nunito, Arial, sans-serif; max-width: 500px; margin: auto; padding: 32px 24px; background: #F7F7F5; border-radius: 16px;">
        <h1 style="color: #5B5BD6; margin-bottom: 8px;">TôOrganizado</h1>
        <p style="font-size: 16px; color: #1A1A1A;">${greeting}</p>
        <p style="font-size: 15px; color: #6B6B6B;">Você foi convidado para usar o <strong>TôOrganizado</strong> — o app de controle de gastos pessoais que te ajuda a organizar suas finanças de forma simples e inteligente.</p>
        <a href="https://www.toorganizado.com.br/auth/cadastro" style="display: inline-block; margin-top: 24px; padding: 14px 28px; background: #5B5BD6; color: #fff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px;">Criar minha conta grátis</a>
        <p style="margin-top: 32px; font-size: 12px; color: #B4B4AA;">Se você não esperava este convite, pode ignorar este e-mail com segurança.</p>
      </div>
    `,
  });

  if (error) return NextResponse.json({ error: 'Erro ao enviar e-mail.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
