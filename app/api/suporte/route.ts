import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getRequestUser } from '@/lib/supabase/getRequestUser';

const SUPPORT_INBOX = 'contato@toorganizado.com.br';
const FROM_ADDRESS = 'TôOrganizado <noreply@toorganizado.com.br>';
const MIN_MESSAGE = 20;
const MAX_SUBJECT = 140;
const MAX_MESSAGE = 4000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req: NextRequest) {
  const { user } = await getRequestUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  };

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, 200) : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, MAX_SUBJECT) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE) : '';

  if (!name) return NextResponse.json({ error: 'Nome obrigatório.' }, { status: 400 });
  if (!email || !isValidEmail(email)) return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
  if (!subject) return NextResponse.json({ error: 'Assunto obrigatório.' }, { status: 400 });
  if (message.length < MIN_MESSAGE) {
    return NextResponse.json({ error: `Mensagem precisa ter no mínimo ${MIN_MESSAGE} caracteres.` }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Serviço de e-mail indisponível.' }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const sentAt = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const internalHtml = `
    <div style="font-family: Nunito, Arial, sans-serif; max-width: 540px; margin: auto; padding: 24px; background: #F7F7F5; border-radius: 16px; color: #1A1A1A;">
      <h2 style="color: #5B5BD6; margin: 0 0 12px;">Novo contato — Suporte</h2>
      <p style="margin: 6px 0;"><strong>De:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
      <p style="margin: 6px 0;"><strong>Assunto:</strong> ${escapeHtml(subject)}</p>
      <p style="margin: 12px 0 6px;"><strong>Mensagem:</strong></p>
      <div style="background: #FFFFFF; border: 1px solid #E5E5E1; border-radius: 12px; padding: 14px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</div>
      <p style="margin-top: 18px; font-size: 12px; color: #6B7280;">Enviado em ${escapeHtml(sentAt)} • user_id: ${escapeHtml(user.id)}</p>
    </div>
  `;

  const userHtml = `
    <div style="font-family: Nunito, Arial, sans-serif; max-width: 540px; margin: auto; padding: 24px; background: #F7F7F5; border-radius: 16px; color: #1A1A1A;">
      <h2 style="color: #5B5BD6; margin: 0 0 12px;">Recebemos sua mensagem</h2>
      <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6;">
        Oi ${escapeHtml(name)}, recebemos sua mensagem e responderemos em até 48 horas úteis.
      </p>
      <div style="background: #FFFFFF; border: 1px solid #E5E5E1; border-radius: 12px; padding: 14px;">
        <p style="margin: 0 0 6px; font-size: 13px;"><strong>Assunto:</strong> ${escapeHtml(subject)}</p>
        <p style="margin: 10px 0 4px; font-size: 13px;"><strong>Sua mensagem:</strong></p>
        <div style="font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #1A1A1A;">${escapeHtml(message)}</div>
      </div>
      <p style="margin-top: 24px; font-size: 13px; color: #6B7280;">
        Equipe TôOrganizado<br/>
        <a href="mailto:${SUPPORT_INBOX}" style="color: #5B5BD6;">${SUPPORT_INBOX}</a>
      </p>
    </div>
  `;

  try {
    const internal = await resend.emails.send({
      from: FROM_ADDRESS,
      to: SUPPORT_INBOX,
      replyTo: email,
      subject: `[Suporte] ${subject} — ${name}`,
      html: internalHtml,
    });
    if (internal.error) {
      return NextResponse.json({ error: 'Erro ao enviar mensagem.' }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: 'Erro ao enviar mensagem.' }, { status: 502 });
  }

  // Confirmação ao usuário — falha silenciosa não bloqueia o success.
  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: email,
      subject: 'Recebemos sua mensagem — TôOrganizado',
      html: userHtml,
    });
  } catch {
    // ignora — interno já foi enviado, suporte responde manualmente se preciso
  }

  return NextResponse.json({ success: true });
}
