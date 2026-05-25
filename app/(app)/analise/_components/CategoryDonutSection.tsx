'use client';

import SpendingDonut from '@/components/SpendingDonut';
import type { Expense } from '@/lib/types';

type Props = {
  entries: Expense[];
};

/**
 * Wrapper sobre o SpendingDonut existente. A própria legenda do donut já lista
 * categorias com ícone, valor e %, então mantemos uma única coluna em mobile
 * (donut com legenda abaixo, padrão do componente). No desktop o card pai
 * cuida do max-width — não duplicamos a lista ao lado.
 */
export default function CategoryDonutSection({ entries }: Props) {
  return <SpendingDonut entries={entries} />;
}
