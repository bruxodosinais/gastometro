import Anthropic from '@anthropic-ai/sdk';
import { getRequestUser } from '@/lib/supabase/getRequestUser';
import { rateLimit, getClientIp } from '@/lib/rateLimit';

export const maxDuration = 30;

const MAX_RECENT_EXPENSES = 50;

type Body = {
  missionId: string;
  month: string; // YYYY-MM
  targetAmount?: number;
  totalSaved?: number;
  monthlyTarget?: number;
  recentExpenses?: { category: string; amount: number }[];
};

function jsonFenced(s: string): string {
  return s.replace(/```(?:json)?\n?|\n?```/g, '').trim();
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!rateLimit(ip, 'gerar-desafio', 20, 60 * 1000)) {
      return Response.json({ error: 'Limite de requisições atingido.' }, { status: 429 });
    }

    const { user, supabase } = await getRequestUser(request);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Pro-gate: free não recebe desafio. 402 deixa o cliente diferenciar de 401.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle();
    const isPro = sub?.plan === 'pro' && sub?.status === 'active';
    if (!isPro) return Response.json({ error: 'pro_required' }, { status: 402 });

    const body = (await request.json()) as Body;
    if (!body?.missionId || !body?.month) {
      return Response.json({ error: 'missing_fields' }, { status: 400 });
    }

    // Já existe desafio ativo no mês? Retorna sem chamar IA.
    const { data: existing } = await supabase
      .from('mission_challenges')
      .select('*')
      .eq('mission_id', body.missionId)
      .eq('month', body.month)
      .eq('dismissed', false)
      .maybeSingle();
    if (existing) {
      return Response.json({ challenge: existing, reused: true });
    }

    // RLS garante que o missionId pertence ao user — qualquer outro retorna null.
    const { data: mission } = await supabase
      .from('savings_missions')
      .select('id, target_amount, monthly_target')
      .eq('id', body.missionId)
      .maybeSingle();
    if (!mission) return Response.json({ error: 'mission_not_found' }, { status: 404 });

    const targetAmount = body.targetAmount ?? Number(mission.target_amount);
    const monthlyTarget = body.monthlyTarget ?? Number(mission.monthly_target);

    let totalSaved = body.totalSaved;
    if (totalSaved == null) {
      const { data: contribs } = await supabase
        .from('mission_contributions')
        .select('amount')
        .eq('mission_id', body.missionId);
      totalSaved = (contribs ?? []).reduce((s, c) => s + Number((c as { amount: number }).amount), 0);
    }

    // Sanitiza recentExpenses (input do cliente): limita a quantidade e aceita
    // somente { category: string, amount: number } — evita inflar o prompt.
    const recentExpenses = (Array.isArray(body.recentExpenses) ? body.recentExpenses : [])
      .slice(0, MAX_RECENT_EXPENSES)
      .filter(
        (e): e is { category: string; amount: number } =>
          !!e &&
          typeof e === 'object' &&
          typeof (e as { category?: unknown }).category === 'string' &&
          typeof (e as { amount?: unknown }).amount === 'number',
      )
      .map((e) => ({ category: e.category.slice(0, 60), amount: e.amount }));

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'anthropic_not_configured' }, { status: 500 });
    }
    const anthropic = new Anthropic({ apiKey });

    const prompt = `Você é um coach financeiro brasileiro direto e motivador.

O usuário tem uma meta de R$ ${targetAmount} e já guardou R$ ${totalSaved}. Meta mensal: R$ ${monthlyTarget}.

Gastos do mês por categoria: ${JSON.stringify(recentExpenses)}

Gere UM desafio simples e específico baseado na maior categoria de gasto. Máximo 2 frases. Seja direto.

Exemplo de formato: 'Você gastou R$ 380 em delivery. Reduzir para R$ 180 libera R$ 200 extras pra sua meta.'

Responda APENAS JSON sem markdown:
{"challenge_text": "string de no máximo 2 frases", "potential_savings": number}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw =
      response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    let parsed: { challenge_text?: string; potential_savings?: number } = {};
    try {
      parsed = JSON.parse(jsonFenced(raw));
    } catch {
      // IA respondeu mal-formatado: aborta sem persistir para não poluir a UI.
      console.error('[gerar-desafio] resposta sem JSON válido:', raw.slice(0, 200));
      return Response.json({ error: 'ai_invalid_response' }, { status: 502 });
    }

    const challengeText = (parsed.challenge_text ?? '').trim();
    const potentialSavings =
      typeof parsed.potential_savings === 'number' && parsed.potential_savings >= 0
        ? parsed.potential_savings
        : null;

    if (!challengeText) {
      return Response.json({ error: 'ai_empty_text' }, { status: 502 });
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('mission_challenges')
      .insert({
        mission_id: body.missionId,
        user_id: user.id,
        month: body.month,
        challenge_text: challengeText,
        potential_savings: potentialSavings,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[gerar-desafio] insert error:', insertErr);
      return Response.json({ error: insertErr.message }, { status: 500 });
    }

    return Response.json({ challenge: inserted, reused: false });
  } catch (err) {
    console.error('[gerar-desafio] uncaught:', err);
    return Response.json({ error: 'internal' }, { status: 500 });
  }
}
