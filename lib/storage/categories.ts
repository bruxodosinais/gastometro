import { createClient } from '../supabase/client';
import { cachedFetch, invalidate, TTL } from '../dataCache';
import { CustomCategory, EntryType } from '../types';

const MAX_CUSTOM_CATEGORIES = 30;

function toCustomCategory(row: Record<string, unknown>): CustomCategory {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: row.icon as string,
    color: row.color as string,
    type: row.type as EntryType,
    createdAt: row.created_at as string,
  };
}

export async function getCustomCategories(
  type?: EntryType,
): Promise<CustomCategory[]> {
  // Uma cache key só: filtramos por type em memória. Isso evita ter caches
  // separados para 'expense' e 'income' que ficariam desincronizados após
  // create/update/delete.
  const all = await cachedFetch('customCategories', TTL.LIST, async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('custom_categories')
      .select('*')
      .order('name', { ascending: true });
    if (error) return [];
    return (data ?? []).map(toCustomCategory);
  });
  return type ? all.filter((c) => c.type === type) : all;
}

export async function createCustomCategory(data: {
  name: string;
  icon: string;
  color: string;
  type: EntryType;
}): Promise<CustomCategory> {
  const name = data.name.trim();
  if (!name) throw new Error('Nome é obrigatório');
  if (name.length > 30) throw new Error('Nome pode ter no máximo 30 caracteres');

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Limite total (não por tipo): 30 categorias custom no total por usuário.
  const existing = await getCustomCategories();
  if (existing.length >= MAX_CUSTOM_CATEGORIES) {
    throw new Error(`Limite de ${MAX_CUSTOM_CATEGORIES} categorias atingido`);
  }

  // Unicidade: nome (case-insensitive) único dentro do mesmo type do usuário.
  // Categorias fixas estão fora desta verificação porque o name vive em outro
  // namespace tipado (Category) — porém duplicar 'Alimentação' como custom
  // confunde a UI: o seletor mostraria duas entradas idênticas. Bloqueamos.
  const lower = name.toLowerCase();
  const dupCustom = existing.some(
    (c) => c.type === data.type && c.name.toLowerCase() === lower,
  );
  if (dupCustom) throw new Error('Já existe uma categoria com esse nome');

  const { data: row, error } = await supabase
    .from('custom_categories')
    .insert({
      user_id: user.id,
      name,
      icon: data.icon,
      color: data.color,
      type: data.type,
    })
    .select()
    .single();

  if (error) {
    console.error('createCustomCategory:', error);
    throw new Error(error.message || 'Erro ao criar categoria');
  }

  invalidate('customCategories');
  return toCustomCategory(row);
}

export async function updateCustomCategory(
  id: string,
  data: { name?: string; icon?: string; color?: string },
): Promise<CustomCategory> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const payload: Record<string, string> = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error('Nome é obrigatório');
    if (name.length > 30) throw new Error('Nome pode ter no máximo 30 caracteres');

    const existing = await getCustomCategories();
    const current = existing.find((c) => c.id === id);
    const lower = name.toLowerCase();
    const dup = existing.some(
      (c) => c.id !== id && c.type === current?.type && c.name.toLowerCase() === lower,
    );
    if (dup) throw new Error('Já existe uma categoria com esse nome');
    payload.name = name;

    // Se o nome mudou, atualizamos os lançamentos e recorrentes existentes
    // para o novo nome — assim mantemos referência por string consistente
    // sem precisar de FK.
    if (current && current.name !== name) {
      const { error: updExp } = await supabase
        .from('expenses')
        .update({ category: name })
        .eq('user_id', user.id)
        .eq('category', current.name);
      if (updExp) {
        console.error('updateCustomCategory (rename expenses):', updExp);
        throw new Error('Erro ao renomear lançamentos da categoria');
      }
      const { error: updRec } = await supabase
        .from('recurring_expenses')
        .update({ category: name })
        .eq('user_id', user.id)
        .eq('category', current.name);
      if (updRec) {
        console.error('updateCustomCategory (rename recurring):', updRec);
        throw new Error('Erro ao renomear recorrentes da categoria');
      }
    }
  }
  if (data.icon !== undefined) payload.icon = data.icon;
  if (data.color !== undefined) payload.color = data.color;

  const { error: updateError } = await supabase
    .from('custom_categories')
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('updateCustomCategory (update):', updateError);
    throw new Error(updateError.message || 'Erro ao atualizar categoria');
  }

  const { data: row, error: fetchError } = await supabase
    .from('custom_categories')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !row) {
    throw new Error(fetchError?.message || 'Categoria não encontrada');
  }

  // Invalida custom_categories E listas dependentes (expenses/recurring podem
  // ter tido category renomeada).
  invalidate('customCategories');
  invalidate('expenses');
  invalidate('recurring');
  return toCustomCategory(row);
}

// Conta lançamentos e recorrentes vinculados a um nome de categoria do usuário
// autenticado. Usado pela UI ANTES de abrir o modal de exclusão (para decidir
// entre confirmação vs bloqueio) E por deleteCustomCategory como segunda
// camada — a UI pode mentir/ficar desatualizada, mas o storage não.
//
// head:true + count:'exact' retorna só a contagem (sem rows), barato.
export async function countCategoryReferences(name: string): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const [{ count: expCount }, { count: recCount }] = await Promise.all([
    supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('category', name),
    supabase
      .from('recurring_expenses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('category', name),
  ]);

  return (expCount ?? 0) + (recCount ?? 0);
}

export async function deleteCustomCategory(id: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Busca o nome da categoria antes de deletar, para checar referências.
  const { data: cat, error: getError } = await supabase
    .from('custom_categories')
    .select('name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (getError || !cat) throw new Error('Categoria não encontrada');

  // Bloqueia exclusão se houver lançamentos vinculados. A UI já checa antes
  // de abrir o modal de confirmação, mas mantemos aqui como segunda camada:
  // proteção contra race conditions (lançamento criado entre o pré-check e o
  // clique no Excluir) e contra chamadas diretas que pulem a UI.
  const total = await countCategoryReferences(cat.name);
  if (total > 0) {
    throw new Error(
      `Existem ${total} lançamentos com essa categoria. Reatribua-os antes de excluir.`,
    );
  }

  const { error: delError } = await supabase
    .from('custom_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (delError) {
    console.error('deleteCustomCategory:', delError);
    throw new Error(delError.message || 'Erro ao excluir categoria');
  }

  invalidate('customCategories');
}

// Helpers para callers que precisam saber o estado do limite (ex.: UI desabilita
// botão "Nova categoria" quando atinge o teto).
export function getCustomCategoryLimit(): number {
  return MAX_CUSTOM_CATEGORIES;
}
