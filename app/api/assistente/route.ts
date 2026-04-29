import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { calculateStreak } from '@/lib/streak';

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

    // Last 3 months (oldest first)
    const [cy, cm] = currentMonth.split('-').map(Number);
    const last3Months: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(cy, cm - 1 - i, 1);
      last3Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const threeMonthsAgoStart = `${last3Months[0]}-01`;

    const [
      { data: expenses },
      { data: budgets },
      { data: plan },
      { data: goals },
      { data: assets },
      { data: liabilities },
      { data: recurring },
    ] = await Promise.all([
      supabase.from('expenses').select('*').gte('date', threeMonthsAgoStart).order('date', { ascending: false }),
      supabase.from('budgets').select('*'),
      supabase.from('monthly_plans').select('*').eq('month', currentMonth).maybeSingle(),
      supabase.from('goals').select('*').eq('status', 'active').order('created_at', { ascending: true }),
      supabase.from('assets').select('*').order('created_at', { ascending: true }),
      supabase.from('liabilities').select('*').order('created_at', { ascending: true }),
      supabase.from('recurring_expenses').select('*').eq('active', true).order('day_of_month', { ascending: true }),
    ]);

    const allExpenses = expenses ?? [];
    const monthExpenses = allExpenses.filter((e) => e.date.startsWith(currentMonth));
    const totalSpent = monthExpenses
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + Number(e.amount), 0);
    const totalIncome = monthExpenses
      .filter((e) => e.type === 'income')
      .reduce((s, e) => s + Number(e.amount), 0);
    const balance = totalIncome - totalSpent;

    const fmt = (n: number) =>
      n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Streak
    const streak = calculateStreak(allExpenses);

    // Monthly summaries (last 3 months)
    const monthlySummarySection = last3Months
      .map((month) => {
        const mExp = allExpenses.filter((e) => e.date.startsWith(month));
        const income = mExp.filter((e) => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
        const spent = mExp.filter((e) => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);
        return `• ${month}: receita ${fmt(income)}, gasto ${fmt(spent)}, saldo ${fmt(income - spent)}`;
      })
      .join('\n');

    // Budget usage (current month)
    const budgetSection =
      (budgets ?? []).length > 0
        ? (budgets ?? [])
            .map((b) => {
              const spent = monthExpenses
                .filter((e) => e.type === 'expense' && e.category === b.category)
                .reduce((s, e) => s + Number(e.amount), 0);
              const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
              const alert = pct > 100 ? ' ⚠️ ESTOURADO' : pct > 80 ? ' ⚠️ próximo do limite' : '';
              return `• ${b.category}: gastou ${fmt(spent)} de ${fmt(b.amount)} (${pct}%)${alert}`;
            })
            .join('\n')
        : 'Nenhum orçamento definido';

    // Goals with progress
    const goalsSection =
      (goals ?? []).length > 0
        ? (goals ?? [])
            .map((g) => {
              const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
              const remaining = g.target_amount - g.current_amount;
              const deadline = g.deadline ? ` — prazo: ${g.deadline}` : '';
              return `• ${g.name}: ${fmt(g.current_amount)} / ${fmt(g.target_amount)} (${pct}%)${deadline} — faltam ${fmt(remaining)}`;
            })
            .join('\n')
        : 'Nenhuma meta ativa';

    // Patrimônio
    const totalAssets = (assets ?? []).reduce((s, a) => s + Number(a.value), 0);
    const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + Number(l.value), 0);
    const netWorth = totalAssets - totalLiabilities;

    const assetsSection =
      (assets ?? []).length > 0
        ? (assets ?? []).map((a) => `• ${a.name} (${a.type}): ${fmt(Number(a.value))}`).join('\n')
        : 'Nenhum ativo cadastrado';

    const liabilitiesSection =
      (liabilities ?? []).length > 0
        ? (liabilities ?? []).map((l) => `• ${l.name} (${l.type}): ${fmt(Number(l.value))}`).join('\n')
        : 'Nenhuma dívida cadastrada';

    // Recurring
    const recurringSection =
      (recurring ?? []).length > 0
        ? (recurring ?? [])
            .map((r) => `• ${r.description}: ${fmt(Number(r.amount))} todo dia ${r.day_of_month}`)
            .join('\n')
        : 'Nenhum recorrente ativo';

    const planInfo = plan
      ? `Renda esperada: ${fmt(plan.expected_income)}, Meta de economia: ${fmt(plan.savings_goal)}`
      : 'Sem planejamento definido';

    const transactionsList = allExpenses
      .slice(0, 100)
      .map((e) => {
        const sign = e.type === 'income' ? '+' : '-';
        return `${e.date} | ${sign} R$ ${Number(e.amount).toFixed(2)} | ${e.category} | ${e.description}`;
      })
      .join('\n');

    const systemPrompt = `Você é o GastôBot, assistente financeiro do app GastôMetro. Responda SEMPRE em JSON válido, sem markdown.

DATA DE HOJE: ${todayStr}
MÊS ATUAL: ${currentMonth}
STREAK ATUAL: ${streak} dia${streak !== 1 ? 's' : ''} consecutivos registrando

RESUMO DO MÊS ATUAL:
- Total gasto: ${fmt(totalSpent)}
- Total recebido: ${fmt(totalIncome)}
- Saldo: ${fmt(balance)}

PLANEJAMENTO: ${planInfo}

ÚLTIMOS 3 MESES:
${monthlySummarySection}

ORÇAMENTOS POR CATEGORIA (mês atual):
${budgetSection}

METAS ATIVAS:
${goalsSection}

PATRIMÔNIO:
Ativos — total: ${fmt(totalAssets)}
${assetsSection}

Dívidas — total: ${fmt(totalLiabilities)}
${liabilitiesSection}

Patrimônio líquido: ${fmt(netWorth)}

RECORRENTES ATIVOS:
${recurringSection}

CATEGORIAS DISPONÍVEIS:
- Gastos: ${EXPENSE_CATEGORIES.join(', ')}
- Receitas: ${INCOME_CATEGORIES.join(', ')}

ÚLTIMAS TRANSAÇÕES (máx 100):
${transactionsList || 'Nenhuma transação registrada'}

REGRAS:
1. Responda no mesmo idioma do usuário (português ou inglês).
2. Se o usuário descrever uma transação financeira, extraia: valor, descrição, categoria e data.
3. Quando não informar data, use hoje (${todayStr}).
4. SEMPRE retorne JSON puro, sem blocos de código, sem prefixos.
5. Para análises, use todos os dados: orçamentos, metas, patrimônio, recorrentes e histórico dos 3 meses.
6. Ao identificar gastos excessivos, compare com orçamentos e média histórica dos 3 meses.
7. Para projetar saldo futuro, considere recorrentes pendentes, padrão histórico e meta de economia.
8. Para calcular ritmo de meta, use: quanto falta ÷ meses restantes até o prazo.

REGRAS DE FORMATAÇÃO DAS RESPOSTAS:
• Use emojis relevantes para separar seções visualmente
• Organize em seções curtas com títulos usando **negrito** (ex: **Situação atual**)
• Use listas com • para itens, nunca parágrafos longos
• Números financeiros sempre formatados: R$ 1.000,00
• Máximo 3-4 itens por seção; separe seções com linha em branco
• Termine sempre com uma pergunta ou sugestão de próximo passo
• Tom: direto e amigável, como um consultor financeiro de confiança
• Nunca use ### ou --- ; use apenas **negrito** e emojis para estrutura
• Máximo 200 palavras por resposta, priorizando clareza sobre completude

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
