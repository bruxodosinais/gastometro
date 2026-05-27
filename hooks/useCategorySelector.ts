'use client';

import { useMemo } from 'react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, EntryType } from '@/lib/types';
import { CATEGORY_CONFIG } from '@/lib/categoryConfig';
import { useCustomCategories } from './useCustomCategories';

export interface CategoryOption {
  value: string;
  label: string;
  icon: string;
  color: string;
  isCustom: boolean;
}

// Retorna lista unificada para seletores: fixas primeiro (na ordem alfabética
// de EXPENSE_/INCOME_CATEGORIES), custom depois. O caller decide se renderiza
// um separador visual entre os dois blocos — basta encontrar o índice do
// primeiro `isCustom: true`.
export function useCategorySelector(type: EntryType) {
  const { categories: customs, loading, reload } = useCustomCategories(type);

  const categories = useMemo<CategoryOption[]>(() => {
    const fixedSource = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

    const fixed: CategoryOption[] = fixedSource.map((name) => {
      const cfg = CATEGORY_CONFIG[name];
      return {
        value: name,
        label: name,
        icon: cfg.icon,
        color: cfg.color,
        isCustom: false,
      };
    });

    const custom: CategoryOption[] = customs.map((c) => ({
      value: c.name,
      label: c.name,
      icon: c.icon,
      color: c.color,
      isCustom: true,
    }));

    return [...fixed, ...custom];
  }, [type, customs]);

  return { categories, loading, reload };
}
