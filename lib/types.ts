export type EntryType = 'expense' | 'income';

export type ExpenseCategory =
  | 'Delivery'
  | 'Alimentação'
  | 'Transporte'
  | 'Assinaturas'
  | 'Saúde'
  | 'Lazer'
  | 'Outros';

export type IncomeCategory = 'Salário' | 'Freela' | 'Renda passiva' | 'Outros';

export type Category = ExpenseCategory | IncomeCategory;

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Delivery',
  'Alimentação',
  'Transporte',
  'Assinaturas',
  'Saúde',
  'Lazer',
  'Outros',
];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Salário',
  'Freela',
  'Renda passiva',
  'Outros',
];

export interface Expense {
  id: string;
  type: EntryType;
  amount: number;
  description: string;
  category: Category;
  date: string; // YYYY-MM-DD
  createdAt: string;
  recurringExpenseId?: string;
}

export interface MonthlyPlan {
  id: string;
  month: string; // YYYY-MM
  expectedIncome: number;
  savingsGoal: number;
}

export interface RecurringExpense {
  id: string;
  description: string;
  amount: number;
  category: Category;
  type: EntryType;
  dayOfMonth: number;
  active: boolean;
  createdAt: string;
}

export interface CategorySummary {
  category: ExpenseCategory;
  total: number;
  average: number;
  percentChange: number;
  isAlert: boolean;
}

export interface Budget {
  id: string;
  category: ExpenseCategory;
  amount: number;
}
