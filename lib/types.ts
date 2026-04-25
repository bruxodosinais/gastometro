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
  value: number;
  description: string;
  category: Category;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface CategorySummary {
  category: Category;
  total: number;
  average: number;
  percentChange: number;
  isAlert: boolean;
}
