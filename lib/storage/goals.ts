import { createClient } from '../supabase/client';
import { cachedFetch, TTL, withCacheInvalidation } from '../dataCache';
import { Goal, GoalContribution, GoalTerm, GoalType } from '../types';

function toGoal(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as GoalType,
    targetAmount: row.target_amount as number,
    currentAmount: row.current_amount as number,
    deadline: (row.deadline as string | null) ?? undefined,
    color: (row.color as string) ?? 'violet',
    status: row.status as 'active' | 'completed',
    term: (row.term as GoalTerm | null) ?? undefined,
    emoji: (row.emoji as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export { toGoal };

export async function getGoals(): Promise<Goal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map(toGoal);
}

export async function createGoal(data: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal> {
  return withCacheInvalidation('goals', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: row, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        name: data.name,
        type: data.type,
        target_amount: data.targetAmount,
        current_amount: data.currentAmount,
        deadline: data.deadline ?? null,
        color: data.color,
        status: data.status,
        term: data.term ?? null,
        emoji: data.emoji ?? null,
      })
      .select()
      .single();
    if (error) {
      console.error('createGoal:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      throw new Error(error.message || 'Erro ao criar meta');
    }
    return toGoal(row);
  });
}

export async function updateGoal(id: string, data: Partial<Omit<Goal, 'id' | 'createdAt'>>): Promise<Goal> {
  return withCacheInvalidation('goals', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.type !== undefined) patch.type = data.type;
    if (data.targetAmount !== undefined) patch.target_amount = data.targetAmount;
    if (data.currentAmount !== undefined) patch.current_amount = data.currentAmount;
    if ('deadline' in data) patch.deadline = data.deadline ?? null;
    if (data.color !== undefined) patch.color = data.color;
    if (data.status !== undefined) patch.status = data.status;
    if ('term' in data) patch.term = data.term ?? null;
    if ('emoji' in data) patch.emoji = data.emoji ?? null;

    const { data: row, error } = await supabase
      .from('goals')
      .update(patch)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) {
      console.error('updateGoal:', { message: error.message, details: error.details, hint: error.hint, code: error.code });
      throw new Error(error.message || 'Erro ao atualizar meta');
    }
    return toGoal(row);
  });
}

export async function deleteGoal(id: string): Promise<void> {
  return withCacheInvalidation('goals', async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('goals').delete().eq('id', id).eq('user_id', user.id);
  });
}

function toContribution(row: Record<string, unknown>): GoalContribution {
  return {
    id: row.id as string,
    goalId: row.goal_id as string,
    amount: row.amount as number,
    note: (row.note as string | null) ?? undefined,
    date: row.date as string,
    createdAt: row.created_at as string,
  };
}

export { toContribution };

export async function getAllGoalContributions(): Promise<GoalContribution[]> {
  return cachedFetch('goalContributions', TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('goal_contributions')
      .select('*')
      .order('date', { ascending: false });
    if (error) return [];
    return (data ?? []).map(toContribution);
  });
}

export async function addGoalContribution(
  goalId: string,
  amount: number,
  note?: string,
  date?: string
): Promise<Goal> {
  // Insere em goal_contributions E atualiza goals (current_amount/status).
  // Array garante que ambas as chaves derivadas (goalContributions + goals)
  // sejam invalidadas no fim.
  return withCacheInvalidation(['goal_contributions', 'goals'], async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { error: insertError } = await supabase.from('goal_contributions').insert({
      user_id: user.id,
      goal_id: goalId,
      amount,
      note: note ?? null,
      date: date ?? new Date().toISOString().slice(0, 10),
    });
    if (insertError) {
      console.error('addGoalContribution (insert):', { message: insertError.message, details: insertError.details, hint: insertError.hint, code: insertError.code });
      throw new Error(insertError.message || 'Erro ao registrar aporte');
    }

    // Incremento atômico no banco (RPC) — evita lost update em aportes concorrentes.
    const { error: rpcError } = await supabase.rpc('increment_goal_amount', {
      p_goal_id: goalId,
      p_delta: amount,
    });
    if (rpcError) {
      console.error('addGoalContribution (rpc):', { message: rpcError.message, details: rpcError.details, hint: rpcError.hint, code: rpcError.code });
      throw new Error(rpcError.message || 'Erro ao atualizar meta');
    }

    // Recarrega a meta já com o novo current_amount e marca como concluída se
    // bateu o alvo. O status é derivado (monotônico active→completed), não está
    // sujeito ao lost update que o incremento atômico resolveu.
    const { data: row, error: fetchError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .eq('user_id', user.id)
      .single();
    if (fetchError || !row) {
      console.error('addGoalContribution (refetch):', fetchError
        ? { message: fetchError.message, details: fetchError.details, hint: fetchError.hint, code: fetchError.code }
        : 'meta não encontrada');
      throw new Error(fetchError?.message || 'Erro ao recarregar a meta');
    }

    if (row.status !== 'completed' && Number(row.current_amount) >= Number(row.target_amount)) {
      const { data: completed } = await supabase
        .from('goals')
        .update({ status: 'completed' })
        .eq('id', goalId)
        .eq('user_id', user.id)
        .select()
        .single();
      if (completed) return toGoal(completed);
    }
    return toGoal(row);
  });
}
