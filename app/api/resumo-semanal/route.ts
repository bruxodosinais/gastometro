import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { calculateStreak } from '@/lib/streak';

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const todayStr = fmtDate(now);
    const currentMonth = todayStr.slice(0, 7);
    const [cy, cm] = currentMonth.split('-').map(Number);
    const totalDaysInMonth = new Date(cy, cm, 0).getDate();
    const daysElapsed = now.getDate();
    const daysRemaining = totalDaysInMonth - daysElapsed;

    // Current week bounds (Monday–Sunday)
    const dow = now.getDay();
    const daysFromMon = dow === 0 ? 6 : dow - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysFromMon);
    const weekStartStr = fmtDate(weekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekEndStr = fmtDate(weekEnd);

    const [
      { data: weekExp },
      { data: monthExp },
      { data: streakExp },
      { data: budgets },
      { data: goals },
      { data: plan },
    ] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .gte('date', weekStartStr)
        .lte('date', weekEndStr)
        .order('date', { ascending: false }),
      supabase
        .from('expenses')
        .select('*')
        .gte('date', `${currentMonth}-01`)
        .lte('date', todayStr),
      supabase
        .from('expenses')
        .select('date')
        .order('date', { ascending: false })
        .limit(90),
      supabase.from('budgets').select('*'),
      supabase.from('goals').select('*').eq('status', 'active'),
      supabase.from('monthly_plans').select('*').eq('month', currentMonth).maybeSingle(),
    ]);

    const fmt = (n: number) =>
      n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // Week totals
    const weekExpenses = weekExp ?? [];
    const weekSpent = weekExpenses
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + Number(e.amount), 0);
    const weekIncome = weekExpenses
      .filter((e) => e.type === 'income')
      .reduce((s, e) => s + Number(e.amount), 0);

    // Category ranking for the week
    const catTotals = new Map<string, number>();
    for (const e of weekExpenses.filter((e) => e.type === 'expense')) {
      catTotals.set(e.category, (catTotals.get(e.category) ?? 0) + Number(e.amount));
    }
    const topCat = [...catTotals.entries()].sort((a, b) => b[1] - a[1])[0];

    // Biggest single expense this week
    const biggestWeek = weekExpenses
      .filter((e) => e.type === 'expense')
      .sort((a, b) => Number(b.amount) - Number(a.amount))[0];

    // Month totals
    const mExp = monthExp ?? [];
    const monthSpent = mExp
      .filter((e) => e.type === 'expense')
      .reduce((s, e) => s + Number(e.amount), 0);
    const monthIncome = mExp
      .filter((e) => e.type === 'income')
      .reduce((s, e) => s + Number(e.amount), 0);
    const projectedMonthSpent =
      daysElapsed > 0 ? (monthSpent / daysElapsed) * totalDaysInMonth : 0;

    // Streak
    const streak = calculateStreak(streakExp ?? []);

    // Budget usage (month so far)
    const budgetLines =
      (budgets ?? [])
        .map((b) => {
          const spent = mExp
            .filter((e) => e.type === 'expense' && e.category === b.category)
            .reduce((s, e) => s + Number(e.amount), 0);
          const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
          const flag = pct > 100 ? ' ⚠️ESTOURADO' : pct > 80 ? ' ⚠️próximo' : '';
          return `${b.category}: ${fmt(spent)}/${fmt(b.amount)} (${pct}%)${flag}`;
        })
        .join('\n') || 'Nenhum orçamento definido';

    // Goals summary
    const goalsLines =
      (goals ?? [])
        .map((g) => {
          const pct = g.target_amount > 0
            ? Math.round((g.current_amount / g.target_amount) * 100)
            : 0;
          return `${g.name}: ${pct}% (faltam ${fmt(g.target_amount - g.current_amount)})`;
        })
        .join('\n') || 'Nenhuma meta ativa';

    const planLine = plan
      ? `Renda esperada: ${fmt(plan.expected_income)}, Meta de economia: ${fmt(plan.savings_goal)}`
      : 'Sem planejamento';

    const prompt = `Gere um resumo semanal financeiro para o usuário do app GastôMetro.

DADOS DA SEMANA (${weekStartStr} a ${weekEndStr}):
- Gasto: ${fmt(weekSpent)}
- Recebido: ${fmt(weekIncome)}
- Saldo da semana: ${fmt(weekIncome - weekSpent)}
${biggestWeek ? `- Maior gasto: ${biggestWeek.description} — ${fmt(Number(biggestWeek.amount))} (${biggestWeek.category})` : '- Nenhum gasto registrado'}
${topCat ? `- Categoria que mais pesou: ${topCat[0]} (${fmt(topCat[1])})` : ''}

DADOS DO MÊS (até hoje — dia ${daysElapsed}/${totalDaysInMonth}, faltam ${daysRemaining} dias):
- Gasto: ${fmt(monthSpent)}
- Receita: ${fmt(monthIncome)}
- Saldo: ${fmt(monthIncome - monthSpent)}
- Projeção de fechamento: ${fmt(projectedMonthSpent)}

STREAK: ${streak} dia${streak !== 1 ? 's' : ''} consecutivos registrando
PLANEJAMENTO: ${planLine}

ORÇAMENTOS:
${budgetLines}

METAS:
${goalsLines}

INSTRUÇÕES:
Escreva um resumo com exatamente 5 seções curtas em português. Cada seção começa com um emoji e título em **negrito**. Use listas com • quando listar itens. Seja direto e motivador, como um consultor financeiro de confiança.

Estrutura obrigatória:
**Performance da semana** — como foi a semana (1-2 frases)
**Destaque** — maior gasto ou categoria que mais pesou (1-2 frases)
**Mês em perspectiva** — como está o mês, projeção (1-2 frases)
**Dica da semana** — 1 dica personalizada e acionável baseada nos dados
**Próximo passo** — 1 ação concreta para a semana que vem

Máximo 180 palavras. Não use ### nem ---. Não use JSON. Retorne apenas o texto do resumo.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const resumo =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    return Response.json({ resumo, geradoEm: now.toISOString() });
  } catch (err) {
    console.error('[resumo-semanal]', err);
    return Response.json({ error: 'Erro ao gerar resumo' }, { status: 500 });
  }
}
