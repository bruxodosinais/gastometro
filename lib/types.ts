export type Category =
  | 'Delivery'
  | 'Alimentação'
  | 'Transporte'
  | 'Assinaturas'
  | 'Saúde'
  | 'Lazer'
  | 'Outros';

export const CATEGORIES: Category[] = [
  'Delivery',
  'Alimentação',
  'Transporte',
  'Assinaturas',
  'Saúde',
  'Lazer',
  'Outros',
];

export interface Expense {
  id: string;
  amount: number;
  description: string;
  category: Category;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp do Supabase
}

export interface CategorySummary {
  category: Category;
  total: number;
  average: number;
  percentChange: number;
  isAlert: boolean;
}
