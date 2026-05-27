'use client';

import { useEffect, useState, useCallback } from 'react';
import { getCustomCategories } from '@/lib/storage';
import { CustomCategory, EntryType } from '@/lib/types';

// Fonte canônica de categorias custom para hooks de display.
// O cache em lib/dataCache deduplica a query entre múltiplos consumidores
// concorrentes — N componentes montando juntos = 1 round-trip.
//
// Os componentes recebem `reload` para forçar refetch após escrita (ex.: a
// tela de gerenciamento chama reload() depois de criar/editar/excluir). Para
// telas que só leem (donut, histórico), reload é opcional — a invalidação
// automática do dataCache cobre o caso normal.
export function useCustomCategories(type?: EntryType) {
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomCategories(type);
      setCategories(data);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { categories, loading, reload };
}
