import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const EXPENSE_CATEGORIES = ['Delivery', 'Alimentação', 'Transporte', 'Assinaturas', 'Saúde', 'Lazer', 'Outros'];
const INCOME_CATEGORIES = ['Salário', 'Freela', 'Renda passiva', 'Outros'];

export async function POST(request: Request) {
  try {
    const { message, history, todayStr: clientTodayStr } = await request.json();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use the date sent by the browser so it reflects the user's local timezone,
    // not the server's UTC clock which can be a day ahead after ~21h BRT.
    const todayStr: string =
      typeof clientTodayStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clientTodayStr)
        ? clientTodayStr
        : (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
    const currentMonth = todayStr.slice(0, 7);

    const [{ data: expenses }, { data: budgets }, { data: plan }] = await Promise.all([
      supabase.from('expenses').select('*').order('date', { ascending: false }).limit(100),
      supabase.from('budgets').select('*'),
      supabase.from('monthly_plans').select('*').eq('month', currentMonth).maybeSingle(),
    ]);

    const monthExpenses = (expenses ?? []).filter((e) => e.date.startsWith(currentMonth));
    const totalSpent = monthExpenses
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + (e.amount as number), 0);
    const totalIncome = monthExpenses
      .filter((e) => e.type === 'income')
      .reduce((s, e) => s + (e.amount as number), 0);
    const balance = totalIncome - totalSpent;

    const fmt = (n: number) =>
      n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const transactionsList = (expenses ?? [])
      .map((e) => {
        const sign = e.type === 'income' ? '+' : '-';
        return `${e.date} | ${sign} R$ ${Number(e.amount).toFixed(2)} | ${e.category} | ${e.description}`;
      })
      .join('\n');

    const budgetInfo =
      (budgets ?? []).map((b) => `${b.category}: limite ${fmt(b.amount)}`).join(', ') ||
      'Nenhum orçamento definido';

    const planInfo = plan
      ? `Renda esperada: ${fmt(plan.expected_income)}, Meta de economia: ${fmt(plan.savings_goal)}`
      : 'Sem planejamento definido';

    const systemPrompt = `Você é o GastôBot, assistente financeiro do app GastôMetro. Responda SEMPRE em JSON válido, sem markdown.

DATA DE HOJE: ${todayStr}
MÊS ATUAL: ${currentMonth}

RESUMO DO MÊS:
- Total gasto: ${fmt(totalSpent)}
- Total recebido: ${fmt(totalIncome)}
- Saldo: ${fmt(balance)}

PLANEJAMENTO: ${planInfo}
ORÇAMENTOS: ${budgetInfo}

CATEGORIAS DISPONÍVEIS:
- Gastos: ${EXPENSE_CATEGORIES.join(', ')}
- Receitas: ${INCOME_CATEGORIES.join(', ')}

ÚLTIMAS TRANSAÇÕES (máx 100):
${transactionsList || 'Nenhuma transação registrada'}

REGRAS:
1. Responda no mesmo idioma do usuário (português ou inglês).
2. Seja conciso e amigável. Use emojis com moderação.
3. Se o usuário descrever uma transação financeira, extraia: valor, descrição, categoria e data.
4. Quando não informar data, use hoje (${todayStr}).
5. SEMPRE retorne JSON puro, sem blocos de código, sem prefixos.

FORMATO para respostas normais:
{"type":"query","message":"sua resposta aqui"}

FORMATO para transação detectada:
{"type":"expense_detected","message":"mensagem confirmando o que vai registrar","expense":{"description":"nome","amount":0.00,"category":"Categoria","type":"expense","date":"YYYY-MM-DD"}}

Use "expense" para gastos e "income" para receitas no campo type.
Nunca invente categorias — use apenas as listadas acima.
O campo amount deve ser número puro (ex: 45.90).`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msgs = [
      ...(history ?? []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: msgs,
    });

    const raw =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    try {
      const clean = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(clean);
      return Response.json(parsed);
    } catch {
      return Response.json({ type: 'query', message: raw });
    }
  } catch (err) {
    console.error('[assistente]', err);
    return Response.json(
      { type: 'query', message: 'Desculpe, ocorreu um erro. Tente novamente.' },
      { status: 500 },
    );
  }
}
