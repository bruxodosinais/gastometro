import { createClient } from '../supabase/client';
import { withCacheInvalidation } from '../dataCache';
import { Asset, AssetType, Liability } from '../types';

function toAsset(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as AssetType,
    value: row.value as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export { toAsset };

export async function getAssets(): Promise<Asset[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map(toAsset);
}

export async function createAsset(data: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset> {
  return withCacheInvalidation('assets', async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { data: row, error } = await supabase
      .from('assets')
      .insert({ user_id: user.id, name: data.name, type: data.type, value: data.value })
      .select()
      .single();
    if (error) throw error;
    return toAsset(row);
  });
}

export async function updateAsset(id: string, data: Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Asset> {
  return withCacheInvalidation('assets', async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { data: row, error } = await supabase
      .from('assets')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return toAsset(row);
  });
}

export async function deleteAsset(id: string): Promise<void> {
  return withCacheInvalidation('assets', async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('assets').delete().eq('id', id).eq('user_id', user.id);
  });
}

function toLiability(row: Record<string, unknown>): Liability {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    value: row.value as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export { toLiability };

export async function getLiabilities(): Promise<Liability[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('liabilities')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []).map(toLiability);
}

export async function createLiability(data: Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>): Promise<Liability> {
  return withCacheInvalidation('liabilities', async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { data: row, error } = await supabase
      .from('liabilities')
      .insert({ user_id: user.id, name: data.name, type: data.type, value: data.value })
      .select()
      .single();
    if (error) throw error;
    return toLiability(row);
  });
}

export async function updateLiability(id: string, data: Partial<Omit<Liability, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Liability> {
  return withCacheInvalidation('liabilities', async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    const { data: row, error } = await supabase
      .from('liabilities')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return toLiability(row);
  });
}

export async function deleteLiability(id: string): Promise<void> {
  return withCacheInvalidation('liabilities', async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('liabilities').delete().eq('id', id).eq('user_id', user.id);
  });
}
