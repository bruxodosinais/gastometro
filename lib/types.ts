export type EntryType = 'expense' | 'income';

export type ExpenseCategory =
  | 'Alimentação'
  | 'Assinaturas'
  | 'Beleza'
  | 'Cartão de Crédito'
  | 'Combustível'
  | 'Delivery'
  | 'Educação'
  | 'Farmácia'
  | 'Internet'
  | 'Investimentos'
  | 'Lazer'
  | 'Moradia'
  | 'Outros'
  | 'Pet'
  | 'Presente'
  | 'Saúde'
  | 'Telefone'
  | 'Transporte'
  | 'Vestuário'
  | 'Viagem';

export type IncomeCategory =
  | 'Salário'
  | 'Freela'
  | 'Renda passiva'
  | 'Outros'
  | 'Saldo inicial';

export type Category = ExpenseCategory | IncomeCategory;

// Nota: 'Cartão de Crédito' existe em ExpenseCategory mas é uma categoria de
// sistema (usada só no pagamento de fatura). Fica fora desta lista de propósito,
// para não aparecer nos seletores de categoria nem no detalhamento por categoria.
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Alimentação',
  'Assinaturas',
  'Beleza',
  'Combustível',
  'Delivery',
  'Educação',
  'Farmácia',
  'Internet',
  'Investimentos',
  'Lazer',
  'Moradia',
  'Outros',
  'Pet',
  'Presente',
  'Saúde',
  'Telefone',
  'Transporte',
  'Vestuário',
  'Viagem',
];

// Nota: 'Saldo inicial' existe em IncomeCategory mas é uma categoria de
// sistema (gerada só pelo onboarding como ponto de partida do saldo). Fica
// fora desta lista de propósito — mesmo padrão de 'Cartão de Crédito' acima —
// para não aparecer nos seletores de receita nem nos detalhamentos por fonte.
export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Salário',
  'Freela',
  'Renda passiva',
  'Outros',
];

export interface CreditCard {
  id: string;
  userId: string;
  nome: string;
  limite: number;
  diaFechamento: number | null;
  diaVencimento: number | null;
  ativo: boolean;
  createdAt: string;
}

export interface Expense {
  id: string;
  type: EntryType;
  amount: number;
  description: string;
  category: Category;
  date: string; // YYYY-MM-DD
  createdAt: string;
  recurringExpenseId?: string;
  creditCardId?: string;
  isCredit?: boolean;
  billingMonth?: string | null; // YYYY-MM-DD, always 1st of month; only for is_credit expenses
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
  dayOfMonth?: number;
  dueDay?: number;
  active: boolean;
  isVariable: boolean;
  isCredit?: boolean;
  creditCardId?: string;
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

export type GoalType =
  | 'reserva'
  | 'viagem'
  | 'carro'
  | 'imovel'
  | 'reforma'
  | 'negocio'
  | 'investimentos'
  | 'personalizada';

export type GoalTerm = 'curto' | 'medio' | 'longo';

export interface Goal {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;
  deadline?: string; // YYYY-MM-DD
  color: string;
  status: 'active' | 'completed';
  term?: GoalTerm;
  emoji?: string;
  createdAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  note?: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export type AssetType = 'caixa' | 'investimentos' | 'imoveis' | 'negocios';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  value: number;
  createdAt: string;
  updatedAt: string;
}

export interface Liability {
  id: string;
  name: string;
  type: string;
  value: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyObligation {
  id: string;
  recurringExpenseId: string;
  month: string; // YYYY-MM
  amount: number;
  description: string;
  category: Category;
  // dueDay pode ser undefined: recorrentes antigos ou cadastrados sem
  // due_day E sem day_of_month geram obrigação sem prazo definido.
  dueDay?: number;
  status: 'pending' | 'paid';
  paidAt?: string;
  createdAt: string;
}
