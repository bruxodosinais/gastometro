import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 60;

// UTC-3 (Brasília)
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;

// Retorna a janela de datas (em horário BR) para usuários criados há exatamente
// `daysAgo` dias. Ex.: daysAgo=3, hoje BR = 2026-06-01 → { gte: '2026-05-29', lt: '2026-05-30' }
function dayWindow(daysAgo: number): { gte: string; lt: string } {
  const now = new Date();
  const brNow = new Date(now.getTime() - BR_OFFSET_MS);
  const target = new Date(brNow);
  target.setUTCDate(target.getUTCDate() - daysAgo);
  const gte = target.toISOString().slice(0, 10);
  const lt = new Date(target.getTime() + 86_400_000).toISOString().slice(0, 10);
  return { gte, lt };
}

// Converte um timestamp UTC para data no horário BR.
function toBRDate(utcIso: string): string {
  return new Date(new Date(utcIso).getTime() - BR_OFFSET_MS).toISOString().slice(0, 10);
}

// ── Templates ──────────────────────────────────────────────────────────────────

function emailD0Welcome(name: string): { subject: string; html: string } {
  const greeting = name ? `Olá, ${name}!` : 'Olá!';
  return {
    subject: 'Bem-vindo ao TôOrganizado! 👋',
    html: `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#F7F7F5;font-family:Nunito,Arial,sans-serif;color:#1A1A1A;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px;">
    <h1 style="font-size:22px;font-weight:800;color:#5B5BD6;margin:0 0 16px;">${greeting}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
      Você deu o primeiro passo para organizar suas finanças. Que ótimo! 🎉
    </p>
    <p style="font-size:14px;font-weight:700;color:#6B6B6B;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.08em;">
      3 passos para começar
    </p>
    <ol style="font-size:14px;line-height:2.2;padding-left:20px;margin:0 0 28px;color:#1A1A1A;">
      <li>Adicione sua <strong>renda mensal</strong> nas configurações</li>
      <li>Lance seu <strong>primeiro gasto</strong> pelo botão + na home</li>
      <li>Defina uma <strong>Missão de Poupança</strong> para guardar todo mês</li>
    </ol>
    <a href="https://toorganizado.com.br/app"
       style="display:inline-block;background:#5B5BD6;color:#ffffff;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">
      Começar agora →
    </a>
    <p style="margin-top:32px;font-size:12px;color:#B4B4AA;">
      Qualquer dúvida, responda este e-mail — teremos prazer em ajudar.
    </p>
  </div>
</body>
</html>`,
  };
}

function emailD3Engage(name: string): { subject: string; html: string } {
  const first = name || 'por aqui';
  return {
    subject: `Como estão seus primeiros dias, ${first}?`,
    html: `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#F7F7F5;font-family:Nunito,Arial,sans-serif;color:#1A1A1A;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px;">
    <h1 style="font-size:22px;font-weight:800;color:#5B5BD6;margin:0 0 16px;">Ei${name ? `, ${name}` : ''}!</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
      Já fazem <strong>3 dias</strong> desde que você se juntou ao TôOrganizado.
    </p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 20px;">
      Lançou seus primeiros gastos? O app já começa a traçar seu perfil de gastos —
      quanto você gasta por categoria, onde estão as maiores saídas e como evoluir mês a mês.
    </p>
    <div style="background:#F7F7F5;border-radius:12px;padding:16px 20px;margin:0 0 28px;">
      <p style="font-size:14px;font-weight:800;color:#5B5BD6;margin:0 0 6px;">💜 Missão de Poupança</p>
      <p style="font-size:14px;line-height:1.5;margin:0;color:#1A1A1A;">
        Defina uma meta (ex: Reserva de emergência) e o app te lembra todo mês de guardar.
      </p>
    </div>
    <a href="https://toorganizado.com.br/app"
       style="display:inline-block;background:#5B5BD6;color:#ffffff;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">
      Ver meu painel →
    </a>
    <p style="margin-top:24px;font-size:12px;color:#B4B4AA;">
      Quer recursos avançados? O plano Pro custa menos de R$0,67/dia.
    </p>
  </div>
</body>
</html>`,
  };
}

function emailD14Value(name: string): { subject: string; html: string } {
  const greeting = name ? `Olá, ${name}!` : 'Olá!';
  return {
    subject: 'Você já viu o quanto gastou este mês? 📊',
    html: `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#F7F7F5;font-family:Nunito,Arial,sans-serif;color:#1A1A1A;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px;">
    <h1 style="font-size:22px;font-weight:800;color:#5B5BD6;margin:0 0 16px;">${greeting}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
      Já são <strong>2 semanas</strong> organizando suas finanças. Parabéns pela constância!
    </p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 28px;">
      Usuários que acompanham os gastos economizam em média <strong>20% mais</strong> por mês.
    </p>
    <p style="font-size:13px;font-weight:800;color:#1A1A1A;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.08em;">
      Desbloqueie o TôOrganizado completo
    </p>
    <ul style="list-style:none;padding:0;margin:0 0 28px;">
      <li style="font-size:14px;line-height:1.7;padding:10px 0;border-bottom:1px solid #F0F0EE;">
        <span style="color:#5B5BD6;font-weight:800;">✦</span>
        <strong>GastôBot ilimitado</strong> — pergunte qualquer coisa sobre seus gastos
      </li>
      <li style="font-size:14px;line-height:1.7;padding:10px 0;border-bottom:1px solid #F0F0EE;">
        <span style="color:#5B5BD6;font-weight:800;">✦</span>
        <strong>Relatório semanal por e-mail</strong> — resumo toda segunda-feira
      </li>
      <li style="font-size:14px;line-height:1.7;padding:10px 0;">
        <span style="color:#5B5BD6;font-weight:800;">✦</span>
        <strong>Lançamentos ilimitados</strong> — sem o limite de 20/mês
      </li>
    </ul>
    <a href="https://toorganizado.com.br/"
       style="display:inline-block;background:#5B5BD6;color:#ffffff;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;margin-bottom:14px;">
      Baixe o app e assine o Pro →
    </a>
    <br>
    <span style="font-size:13px;color:#B4B4AA;">
      A assinatura Pro é feita dentro do app.
    </span>
    <p style="margin-top:32px;font-size:12px;color:#B4B4AA;">Qualquer dúvida, responda este e-mail.</p>
  </div>
</body>
</html>`,
  };
}

function emailD21Convert(name: string): { subject: string; html: string } {
  const greeting = name ? `Olá, ${name}!` : 'Olá!';
  return {
    subject: 'Último lembrete: organize suas finanças de verdade 💜',
    html: `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#F7F7F5;font-family:Nunito,Arial,sans-serif;color:#1A1A1A;">
  <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px 28px;">
    <h1 style="font-size:22px;font-weight:800;color:#5B5BD6;margin:0 0 16px;">${greeting}</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
      Você usa o TôOrganizado há <strong>3 semanas</strong>. Que tal levar a sério?
    </p>

    <!-- CTA card -->
    <div style="background:#5B5BD6;border-radius:14px;padding:24px;margin:0 0 28px;text-align:center;">
      <p style="font-size:13px;font-weight:800;color:rgba(255,255,255,0.75);margin:0 0 4px;letter-spacing:0.1em;text-transform:uppercase;">
        TôOrganizado Pro
      </p>
      <p style="font-size:20px;font-weight:900;color:#ffffff;margin:0 0 20px;">
        Tudo liberado · cancele quando quiser
      </p>
      <a href="https://toorganizado.com.br/"
         style="display:inline-block;background:#ffffff;color:#5B5BD6;font-weight:900;text-decoration:none;padding:14px 28px;border-radius:12px;font-size:15px;">
        Baixe o app →
      </a>
    </div>

    <!-- Free vs Pro table -->
    <table style="width:100%;border-collapse:collapse;margin:0 0 28px;font-size:14px;">
      <thead>
        <tr style="background:#F7F7F5;">
          <th style="text-align:left;padding:8px 12px;font-weight:800;border-radius:6px 0 0 6px;">Plano</th>
          <th style="text-align:left;padding:8px 12px;font-weight:800;">Lançamentos</th>
          <th style="text-align:left;padding:8px 12px;font-weight:800;border-radius:0 6px 6px 0;">GastôBot</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-top:1px solid #F0F0EE;color:#6B6B6B;">
          <td style="padding:10px 12px;">Free</td>
          <td style="padding:10px 12px;">20/mês</td>
          <td style="padding:10px 12px;">1/mês</td>
        </tr>
        <tr style="border-top:1px solid #F0F0EE;color:#5B5BD6;font-weight:800;">
          <td style="padding:10px 12px;">Pro ✓</td>
          <td style="padding:10px 12px;">Ilimitado</td>
          <td style="padding:10px 12px;">Ilimitado + relatórios + análise avançada + suporte prioritário</td>
        </tr>
      </tbody>
    </table>

    <p style="font-size:14px;line-height:1.7;margin:0 0 8px;color:#1A1A1A;">
      Se tiver qualquer dúvida, responda este e-mail. Estou aqui para ajudar.
    </p>
    <p style="font-size:14px;font-weight:700;margin:0 0 32px;color:#1A1A1A;">
      Anderson · Fundador do TôOrganizado
    </p>

    <a href="https://toorganizado.com.br/app"
       style="font-size:12px;color:#B4B4AA;text-decoration:none;">
      Continuar no plano gratuito
    </a>
  </div>
</body>
</html>`,
  };
}

// ── Step definitions ────────────────────────────────────────────────────────────

type FunnelStep = {
  type: string;
  daysAgo: number;
  skipPro: boolean;
  countKey: string;
  emailFn: (name: string) => { subject: string; html: string };
};

const STEPS: FunnelStep[] = [
  { type: 'd0_welcome',  daysAgo: 0,  skipPro: false, countKey: 'd0',  emailFn: emailD0Welcome  },
  { type: 'd3_engage',   daysAgo: 3,  skipPro: true,  countKey: 'd3',  emailFn: emailD3Engage   },
  { type: 'd14_value',   daysAgo: 14, skipPro: true,  countKey: 'd14', emailFn: emailD14Value   },
  { type: 'd21_convert', daysAgo: 21, skipPro: true,  countKey: 'd21', emailFn: emailD21Convert },
];

// ── Handler ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'RESEND_API_KEY ausente.' }, { status: 500 });

  const admin = createAdminClient();

  // 1. Carrega todos os usuários (paginado) — mesmo padrão de reports/weekly.
  const allUsers: { id: string; email: string; createdAt: string; firstName: string }[] = [];
  {
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data) break;
      for (const u of data.users) {
        if (!u.email) continue;
        const meta = (u.user_metadata ?? {}) as Record<string, string>;
        const firstName =
          meta.display_name ||
          meta.full_name?.split(' ')[0] ||
          meta.name?.split(' ')[0] ||
          u.email.split('@')[0];
        allUsers.push({ id: u.id, email: u.email, createdAt: u.created_at, firstName });
      }
      if (data.users.length < 1000) break;
      page += 1;
      if (page > 50) break;
    }
  }

  // 2. IDs de usuários Pro ativos — excluídos de D+3/D+14/D+21.
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('plan', 'pro')
    .eq('status', 'active');
  const proIds = new Set<string>(
    (subs ?? []).map((s: { user_id: string }) => s.user_id),
  );

  // 3. Log de e-mails já enviados — evita reenvio mesmo em execuções manuais.
  const { data: funnelLog } = await admin
    .from('email_funnel_log')
    .select('user_id, email_type');
  const sentSet = new Set<string>(
    (funnelLog ?? []).map((l: { user_id: string; email_type: string }) => `${l.user_id}:${l.email_type}`),
  );

  const resend = new Resend(apiKey);
  const counts: Record<string, number> = { d0: 0, d3: 0, d14: 0, d21: 0 };
  const errors: string[] = [];

  for (const step of STEPS) {
    const window = dayWindow(step.daysAgo);

    const eligible = allUsers.filter((u) => {
      const brDate = toBRDate(u.createdAt);
      if (brDate < window.gte || brDate >= window.lt) return false;
      if (sentSet.has(`${u.id}:${step.type}`)) return false;
      if (step.skipPro && proIds.has(u.id)) return false;
      return true;
    });

    for (const user of eligible) {
      const { subject, html } = step.emailFn(user.firstName);
      try {
        const { error: sendErr } = await resend.emails.send({
          from: 'TôOrganizado <noreply@toorganizado.com.br>',
          replyTo: 'contato@toorganizado.com.br',
          to: user.email,
          subject,
          html,
        });
        if (sendErr) {
          errors.push(`[${step.type}] ${user.id}: ${sendErr.message}`);
          console.error(`[email-funnel] resend error ${step.type}`, user.id, sendErr);
          continue;
        }
        // Registra envio — unique constraint evita duplicatas em retries concorrentes.
        const { error: logErr } = await admin.from('email_funnel_log').insert({
          user_id: user.id,
          email_type: step.type,
        });
        if (logErr && logErr.code !== '23505') {
          console.error(`[email-funnel] log error ${step.type}`, user.id, logErr);
        }
        counts[step.countKey] = (counts[step.countKey] ?? 0) + 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${step.type}] ${user.id}: ${msg}`);
        console.error(`[email-funnel] erro ${step.type}`, user.id, err);
      }
    }
  }

  return NextResponse.json({ ...counts, errors });
}
