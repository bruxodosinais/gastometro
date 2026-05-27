import { createClient } from '../supabase/client';
import { cachedFetch, getCachedUser, TTL, withCacheInvalidation } from '../dataCache';
import { EntryType, RecurringExpense } from '../types';

function toRecurring(row: Record<string, unknown>): RecurringExpense {
  // day_of_month e due_day podem ser NULL no banco (itens antigos criados antes
  // dessas colunas existirem). Manter como undefined — NUNCA aplicar fallback
  // para 1 ou qualquer valor padrão aqui.
  const rawDay = row.day_of_month;
  const dayOfMonth =
    typeof rawDay === 'number' && rawDay >= 1 && rawDay <= 31 ? rawDay : undefined;
  const rawDue = row.due_day;
  const dueDay =
    typeof rawDue === 'number' && rawDue >= 1 && rawDue <= 31 ? rawDue : undefined;
  const rawTotal = row.total_installments;
  const totalInstallments =
    typeof rawTotal === 'number' && rawTotal >= 1 ? rawTotal : undefined;
  return {
    id: row.id as string,
    description: row.description as string,
    amount: row.amount as number,
    category: row.category as string,
    type: (row.type as string) as EntryType,
    dayOfMonth,
    dueDay,
    active: row.active as boolean,
    isVariable: (row.is_variable as boolean | null) ?? false,
    isCredit: (row.is_credit as boolean | null) ?? undefined,
    creditCardId: (row.credit_card_id as string | null) ?? undefined,
    totalInstallments,
    createdAt: row.created_at as string,
  };
}

export { toRecurring };

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  return cachedFetch('recurring', TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []).map(toRecurring);
  });
}

export async function addRecurringExpense(
  data: Omit<RecurringExpense, 'id' | 'createdAt'>
): Promise<RecurringExpense> {
  return withCacheInvalidation('recurring_expenses', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: row, error } = await supabase
      .from('recurring_expenses')
      .insert({
        user_id: user.id,
        description: data.description,
        amount: data.amount,
        category: data.category,
        type: data.type,
        // day_of_month e due_day são salvos de forma independente. due_day NUNCA
        // herda de day_of_month — campos com semânticas distintas (lançamento vs
        // vencimento).
        day_of_month: data.dayOfMonth ?? null,
        due_day: data.dueDay ?? null,
        active: data.active,
        is_variable: data.isVariable ?? false,
        is_credit: data.isCredit ?? false,
        credit_card_id: data.creditCardId ?? null,
        total_installments: data.totalInstallments ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return toRecurring(row);
  });
}

export async function toggleRecurringExpense(id: string, active: boolean): Promise<void> {
  return withCacheInvalidation('recurring_expenses', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('recurring_expenses')
      .update({ active })
      .eq('id', id)
      .eq('user_id', user.id);
  });
}

export async function deleteRecurringExpense(id: string): Promise<void> {
  return withCacheInvalidation('recurring_expenses', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('recurring_expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
  });
}

export type UpdateRecurringPayload = {
  description?: string;
  amount?: number;
  category?: string;
  type?: EntryType;
  // null limpa o campo no banco; undefined deixa intocado.
  dayOfMonth?: number | null;
  dueDay?: number | null;
  isVariable?: boolean;
  active?: boolean;
  isCredit?: boolean;
  creditCardId?: string | null;
  totalInstallments?: number | null;
};

export async function updateRecurringExpense(
  id: string,
  data: UpdateRecurringPayload
): Promise<RecurringExpense> {
  return withCacheInvalidation('recurring_expenses', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const patch: Record<string, unknown> = {};
    if (data.description !== undefined) patch.description = data.description;
    if (data.amount !== undefined) patch.amount = data.amount;
    if (data.category !== undefined) patch.category = data.category;
    if (data.type !== undefined) patch.type = data.type;
    if (data.dayOfMonth !== undefined) patch.day_of_month = data.dayOfMonth;
    if (data.dueDay !== undefined) patch.due_day = data.dueDay;
    if (data.isVariable !== undefined) patch.is_variable = data.isVariable;
    if (data.active !== undefined) patch.active = data.active;
    if (data.totalInstallments !== undefined) patch.total_installments = data.totalInstallments;

    const { data: row, error } = await supabase
      .from('recurring_expenses')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return toRecurring(row);
  });
}

// IDs de recorrentes já lançados no mês atual
export async function getLaunchedRecurringIds(): Promise<Set<string>> {
  const supabase = createClient();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { data } = await supabase
    .from('expenses')
    .select('recurring_expense_id')
    .not('recurring_expense_id', 'is', null)
    .gte('date', `${currentMonth}-01`)
    .lte('date', `${currentMonth}-31`);
  return new Set(
    (data ?? []).map((e) => e.recurring_expense_id as string).filter(Boolean)
  );
}

// Auto-lança recorrentes do mês atual que ainda não foram lançados
// Protegido por sessionStorage: roda no máximo uma vez por dia por sessão
export async function checkAndLaunchRecurring(): Promise<void> {
  const todayKey = `recurring_checked_${new Date().toISOString().slice(0, 10)}`;
  if (typeof sessionStorage !== 'undefined') {
    if (sessionStorage.getItem(todayKey)) return;
    sessionStorage.setItem(todayKey, '1');
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const now = new Date();
  const todayDay = now.getDate();
  const currentMonth = now.toISOString().slice(0, 7);

  const [{ data: recurring }, launchedIds] = await Promise.all([
    supabase
      .from('recurring_expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true),
    getLaunchedRecurringIds(),
  ]);

  if (!recurring?.length) return;

  // Recorrentes com prazo definido (parcelamentos): contar quantas vezes já
  // foram lançadas para saber se chegamos no limite. Uma query em lote evita
  // N+1 quando há vários parcelamentos ativos.
  const installmentCandidateIds = recurring
    .filter((r) => typeof r.total_installments === 'number' && r.total_installments >= 1)
    .map((r) => r.id);
  const installmentCounts = new Map<string, number>();
  if (installmentCandidateIds.length > 0) {
    const { data: countRows } = await supabase
      .from('expenses')
      .select('recurring_expense_id')
      .eq('user_id', user.id)
      .in('recurring_expense_id', installmentCandidateIds);
    for (const row of countRows ?? []) {
      const id = (row as { recurring_expense_id: string }).recurring_expense_id;
      installmentCounts.set(id, (installmentCounts.get(id) ?? 0) + 1);
    }
  }

  // Envelopa o loop inteiro: se UMA inserção ocorreu, o cache de expenses
  // precisa ser invalidado para refletir o lançamento no próximo getExpenses().
  // (Antes este auto-launch não invalidava nada — bug latente.)
  await withCacheInvalidation('expenses', async () => {
    for (const rec of recurring) {
      // Parcelamento esgotado: desativa o recorrente (não lança mais).
      if (typeof rec.total_installments === 'number' && rec.total_installments >= 1) {
        const count = installmentCounts.get(rec.id) ?? 0;
        if (count >= rec.total_installments) {
          await supabase
            .from('recurring_expenses')
            .update({ active: false })
            .eq('id', rec.id)
            .eq('user_id', user.id);
          continue;
        }
      }
      // Sem day_of_month, não há gatilho de lançamento automático — pula.
      if (
        typeof rec.day_of_month !== 'number' ||
        rec.day_of_month < 1 ||
        rec.day_of_month > 31
      ) continue;
      // Só lança se o dia já chegou e ainda não foi lançado este mês
      if (rec.day_of_month > todayDay) continue;
      if (launchedIds.has(rec.id)) continue;
      // Despesas variáveis exigem valor real informado pelo usuário no momento do pagamento
      if (rec.is_variable) continue;

      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const day = Math.min(rec.day_of_month, lastDay);
      const date = `${currentMonth}-${String(day).padStart(2, '0')}`;

      await supabase.from('expenses').insert({
        user_id: user.id,
        type: rec.type,
        amount: rec.amount,
        description: rec.description,
        category: rec.category,
        date,
        recurring_expense_id: rec.id,
        is_credit: rec.is_credit ?? false,
        credit_card_id: rec.credit_card_id ?? null,
      });
    }
  });
}

// Espelha checkAndGenerateObligations, mas para RECEITAS recorrentes (income).
// Quando o dayOfMonth de um recorrente income ativo já chegou e ainda não foi
// lançado no mês corrente, cria a entry automaticamente. Antes disso o salário
// só virava entry via "marcar como recebido" no card, e usuários que não
// achavam o botão viam o saldo zerar enquanto as despesas marcadas como pagas
// já tinham virado expense.
let incomeEntriesInflight: Promise<void> | null = null;
export function checkAndGenerateIncomeEntries(): Promise<void> {
  if (incomeEntriesInflight) return incomeEntriesInflight;
  incomeEntriesInflight = runCheckAndGenerateIncomeEntries().finally(() => {
    incomeEntriesInflight = null;
  });
  return incomeEntriesInflight;
}

async function runCheckAndGenerateIncomeEntries(): Promise<void> {
  const today = new Date();
  const currentMonth = today.toISOString().slice(0, 7);
  const todayDay = today.getDate();
  const sessionKey = `income_entries_generated_${currentMonth}`;

  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sessionKey)) return;

  const user = await getCachedUser();
  if (!user) return;

  const recurring = (await getRecurringExpenses()).filter(
    (r) => r.active && r.type === 'income'
  );

  if (!recurring.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  // Só gera para recorrentes cujo dayOfMonth já chegou. dayOfMonth ausente
  // (undefined) é tratado como "sem data definida" → não auto-lança para não
  // adivinhar uma data que o user não informou (consistente com Contas do mês,
  // que exibe esses itens como "Dia não definido" e não vence sozinho).
  const due = recurring.filter(
    (r) => typeof r.dayOfMonth === 'number' && (r.dayOfMonth as number) <= todayDay
  );

  if (!due.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  const supabase = createClient();

  // Parcelamentos esgotados: desativa o recorrente e remove da lista de lançamento.
  const installmentCandidates = due.filter(
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
  const remainingDue = due.filter((r) => {
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
  if (!remainingDue.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  // Lista entries já existentes neste mês para os recorrentes alvo, em UMA query.
  const dueIds = remainingDue.map((r) => r.id);
  const { data: existing, error: existingErr } = await supabase
    .from('expenses')
    .select('recurring_expense_id')
    .eq('user_id', user.id)
    .in('recurring_expense_id', dueIds)
    .gte('date', `${currentMonth}-01`)
    .lte('date', `${currentMonth}-31`);

  if (existingErr) return; // tabela ausente/erro: não marca sessionStorage, retenta

  const alreadyLogged = new Set(
    (existing ?? []).map((row) => (row as { recurring_expense_id: string }).recurring_expense_id)
  );
  const toCreate = remainingDue.filter((r) => !alreadyLogged.has(r.id));

  if (!toCreate.length) {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
    return;
  }

  // Data do lançamento = dia do mês corrente em que o recorrente vence (não
  // hoje), espelhando como o user lançaria manualmente. Se dayOfMonth > último
  // dia do mês (ex.: dia 31 em fev), usa o último dia.
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const rows = toCreate.map((rec) => {
    const dom = Math.min(rec.dayOfMonth as number, lastDay);
    const dd = String(dom).padStart(2, '0');
    return {
      user_id: user.id,
      type: 'income' as const,
      amount: rec.amount,
      description: rec.description,
      category: rec.category,
      date: `${currentMonth}-${dd}`,
      recurring_expense_id: rec.id,
      is_credit: false,
    };
  });

  try {
    await withCacheInvalidation('expenses', async () => {
      const { error } = await supabase.from('expenses').insert(rows);
      if (error) throw error;
    });
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(sessionKey, '1');
  } catch {
    // sem marcar sessionStorage — próximo load tenta de novo
  }
}
