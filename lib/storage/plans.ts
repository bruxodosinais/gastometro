import { createClient } from '../supabase/client';
import { cachedFetch, getCachedUser, TTL, withCacheInvalidation } from '../dataCache';
import { Category, Expense, MonthlyObligation, MonthlyPlan, RecurringExpense } from '../types';
import { toExpense } from './expenses';
import { getRecurringExpenses } from './recurring';

export async function getMonthlyPlan(month: string): Promise<MonthlyPlan | null> {
  return cachedFetch(`monthlyPlan:${month}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('monthly_plans')
      .select('*')
      .eq('month', month)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      month: data.month,
      expectedIncome: data.expected_income,
      savingsGoal: data.savings_goal,
    };
  });
}

export async function upsertMonthlyPlan(
  month: string,
  expectedIncome: number,
  savingsGoal: number
): Promise<MonthlyPlan> {
  return withCacheInvalidation('monthly_plans', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('monthly_plans')
      .upsert(
        { user_id: user.id, month, expected_income: expectedIncome, savings_goal: savingsGoal },
        { onConflict: 'user_id,month' }
      )
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      month: data.month,
      expectedIncome: data.expected_income,
      savingsGoal: data.savings_goal,
    };
  });
}

function toMonthlyObligation(row: Record<string, unknown>): MonthlyObligation {
  const rawDue = row.due_day;
  return {
    id: row.id as string,
    recurringExpenseId: row.recurring_expense_id as string,
    month: row.month as string,
    amount: row.amount as number,
    description: row.description as string,
    category: row.category as Category,
    dueDay:
      typeof rawDue === 'number' && rawDue >= 1 && rawDue <= 31 ? rawDue : undefined,
    status: row.status as 'pending' | 'paid',
    paidAt: (row.paid_at as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export { toMonthlyObligation };

export async function getMonthlyObligations(month: string): Promise<MonthlyObligation[]> {
  return cachedFetch(`obligations:${month}`, TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('monthly_obligations')
      .select('*')
      .eq('month', month)
      .order('due_day', { ascending: true });
    if (error) return [];
    return (data ?? []).map(toMonthlyObligation);
  });
}

// Gera as obrigações do mês caso ainda não existam. Protegido por sessionStorage
// para não re-executar desnecessariamente dentro da mesma sessão.
//
// Dedupe em voo: RecurringCheck, a Home, a Sidebar e a TopbarDesktop chamam
// isto quase ao mesmo tempo no primeiro load. O sessionStorage só é gravado
// DEPOIS da query, então sem este guard os 4 corriam concorrentes (race) e
// cada um disparava getUser + count + recurring. Agora compartilham 1 execução.
let obligationsInflight: Promise<void> | null = null;
export function checkAndGenerateObligations(): Promise<void> {
  if (obligationsInflight) return obligationsInflight;
  obligationsInflight = runCheckAndGenerateObligations().finally(() => {
    obligationsInflight = null;
  });
  return obligationsInflight;
}

async function runCheckAndGenerateObligations(): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const sessionKey = `obligations_generated_${currentMonth}`;

  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) return;

  const supabase = createClient();
  const user = await getCachedUser();
  if (!user) return;

  const { count, error: countError } = await supabase
    .from('monthly_obligations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('month', currentMonth);

  // Se a tabela não existir ou houver erro, não marcar sessionStorage
  if (countError) return;

  if ((count ?? 0) > 0) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  // Reusa o getRecurringExpenses cacheado — a Home, Sidebar e Topbar buscam
  // recorrentes no mesmo load; sem isto era +1 query idêntica aqui.
  const recurring = (await getRecurringExpenses()).filter(
    (r) => r.active && r.type === 'expense'
  );

  if (!recurring.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  // Parcelamentos esgotados: não gera obrigação e marca recorrente como inativo.
  const installmentCandidates = recurring.filter(
    (r) => typeof r.totalInstallments === 'number' && r.totalInstallments >= 1
  );
  const installmentCounts = new Map<string, number>();
  if (installmentCandidates.length > 0) {
    const { data: countRows } = await supabase
      .from('expenses')
      .select('recurring_expense_id')
      .eq('user_id', user.id)
      .in('recurring_expense_id', installmentCandidates.map((r) => r.id));
    for (const row of countRows ?? []) {
      const id = (row as { recurring_expense_id: string }).recurring_expense_id;
      installmentCounts.set(id, (installmentCounts.get(id) ?? 0) + 1);
    }
  }
  const exhaustedIds: string[] = [];
  const eligibleRecurring = recurring.filter((r) => {
    if (typeof r.totalInstallments !== 'number') return true;
    const count = installmentCounts.get(r.id) ?? 0;
    if (count >= r.totalInstallments) {
      exhaustedIds.push(r.id);
      return false;
    }
    return true;
  });
  if (exhaustedIds.length > 0) {
    await withCacheInvalidation('recurring_expenses', async () => {
      await supabase
        .from('recurring_expenses')
        .update({ active: false })
        .eq('user_id', user.id)
        .in('id', exhaustedIds);
    });
  }
  if (!eligibleRecurring.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  const obligations = eligibleRecurring.map((rec) => {
    // Obrigação herda APENAS due_day do recorrente. due_day e day_of_month têm
    // significados distintos — não fazer fallback cruzado. Quando ambos são
    // null, a obrigação fica sem prazo (due_day null) e nenhum badge de
    // atraso/vencimento é mostrado nas telas. toRecurring já valida o range
    // 1..31 (dueDay vira undefined fora dele).
    const due = typeof rec.dueDay === 'number' ? rec.dueDay : null;
    return {
      user_id: user.id,
      recurring_expense_id: rec.id,
      month: currentMonth,
      amount: rec.amount,
      description: rec.description,
      category: rec.category,
      due_day: due,
      status: 'pending',
    };
  });

  // try/catch silencia falha (comportamento histórico: tabela ausente etc. não
  // deve quebrar o load); withCacheInvalidation invalida 'obligations' (+ uma
  // chave derivada do mapa) só no caminho de sucesso.
  try {
    await withCacheInvalidation('monthly_obligations', async () => {
      const { error: insertError } = await supabase.from('monthly_obligations').insert(obligations);
      if (insertError) throw insertError;
    });
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
  } catch {
    // sem marcar sessionStorage — próximo load tenta de novo
  }
}

export async function markObligationAsPaid(
  obligationId: string,
  obligation: MonthlyObligation,
  actualAmount?: number
): Promise<{ obligation: MonthlyObligation; expense: Expense }> {
  // Toca DUAS tabelas: monthly_obligations (status=paid) + expenses (cria/reusa).
  // Passar ambas como array garante que 'obligations' E 'expenses' (e as demais
  // chaves derivadas) sejam invalidadas no fim — única vez, sem duplicidade.
  return withCacheInvalidation(['monthly_obligations', 'expenses'], async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const today = new Date().toISOString().slice(0, 10);
    const currentMonth = today.slice(0, 7);

    const { data: obligationRow, error: obErr } = await supabase
      .from('monthly_obligations')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', obligationId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (obErr) throw obErr;

    const expenseAmount = actualAmount ?? obligation.amount;

    // Dedup: se já existe expense com o mesmo recurring_expense_id neste mês, reutiliza
    if (obligation.recurringExpenseId) {
      const { data: existing } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('recurring_expense_id', obligation.recurringExpenseId)
        .gte('date', `${currentMonth}-01`)
        .lte('date', `${currentMonth}-31`)
        .maybeSingle();

      if (existing) {
        // Para despesas variáveis, atualiza o valor real se diferente do estimado
        if (actualAmount !== undefined && actualAmount !== (existing.amount as number)) {
          const { data: updated } = await supabase
            .from('expenses')
            .update({ amount: actualAmount })
            .eq('id', existing.id)
            .eq('user_id', user.id)
            .select()
            .single();
          return {
            obligation: toMonthlyObligation(obligationRow),
            expense: toExpense(updated ?? existing),
          };
        }
        return {
          obligation: toMonthlyObligation(obligationRow),
          expense: toExpense(existing),
        };
      }
    }

    const { data: expenseRow, error: expErr } = await supabase
      .from('expenses')
      .insert({
        user_id: user.id,
        type: 'expense',
        amount: expenseAmount,
        description: obligation.description,
        category: obligation.category,
        date: today,
        recurring_expense_id: obligation.recurringExpenseId,
      })
      .select()
      .single();

    if (expErr) throw expErr;

    return {
      obligation: toMonthlyObligation(obligationRow),
      expense: toExpense(expenseRow),
    };
  });
}

export async function unmarkObligationAsPaid(
  obligationId: string,
  expenseId: string
): Promise<void> {
  return withCacheInvalidation(['monthly_obligations', 'expenses'], async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    await Promise.all([
      supabase
        .from('monthly_obligations')
        .update({ status: 'pending', paid_at: null })
        .eq('id', obligationId)
        .eq('user_id', user.id),
      supabase
        .from('expenses')
        .delete()
        .eq('id', expenseId)
        .eq('user_id', user.id),
    ]);
  });
}

// Cria obrigação imediata para um recorrente recém-cadastrado no mês atual.
// Usado após addRecurringExpense para evitar depender do checkAndGenerateObligations.
export async function addObligationForNewRecurring(
  rec: RecurringExpense
): Promise<MonthlyObligation | null> {
  if (rec.type !== 'expense' || !rec.active) return null;

  // Caminho que retorna null cedo (auth ausente, error) não invalida — só o
  // sucesso. Encapsular o body inteiro mantém esse contrato.
  return withCacheInvalidation('monthly_obligations', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const currentMonth = new Date().toISOString().slice(0, 7);
    // Obrigação herda apenas due_day. Sem due_day válido, fica null (sem prazo).
    const due =
      typeof rec.dueDay === 'number' && rec.dueDay >= 1 && rec.dueDay <= 31
        ? rec.dueDay
        : null;
    const { data, error } = await supabase
      .from('monthly_obligations')
      .insert({
        user_id: user.id,
        recurring_expense_id: rec.id,
        month: currentMonth,
        amount: rec.amount,
        description: rec.description,
        category: rec.category,
        due_day: due,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return null;
    return toMonthlyObligation(data);
  });
}

// Remove as obrigações do mês atual de um conjunto de recorrentes. Usado pelo
// onboarding para tornar o passo "contas fixas" idempotente: ao voltar e
// avançar de novo, as obrigações criadas antes são apagadas e recriadas a
// partir dos valores atuais, sem duplicar (deleteRecurringExpense não cascateia
// para monthly_obligations de forma garantida neste schema).
export async function deleteObligationsByRecurringIds(
  recurringIds: string[]
): Promise<void> {
  if (recurringIds.length === 0) return;
  return withCacheInvalidation('monthly_obligations', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    await supabase
      .from('monthly_obligations')
      .delete()
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .in('recurring_expense_id', recurringIds);
  });
}
