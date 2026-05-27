export type EntryType = 'expense' | 'income';

export type ExpenseCategory =
  | 'Academia'
  | 'Água'
  | 'Alimentação'
  | 'Assinaturas'
  | 'Beleza'
  | 'Cartão de Crédito'
  | 'Combustível'
  | 'Compras online'
  | 'Condomínio'
  | 'Crianças'
  | 'Cuidados pessoais'
  | 'Delivery'
  | 'Dentista'
  | 'Doação'
  | 'Educação'
  | 'Farmácia'
  | 'Games'
  | 'Gás'
  | 'Imposto'
  | 'Internet'
  | 'Investimentos'
  | 'Lazer'
  | 'Luz'
  | 'Manutenção'
  | 'Médico'
  | 'Moradia'
  | 'Outros'
  | 'Pet'
  | 'Presente'
  | 'Psicólogo'
  | 'Saúde'
  | 'Seguro'
  | 'Streaming'
  | 'Telefone'
  | 'Trabalho'
  | 'Transporte'
  | 'Vestuário'
  | 'Viagem';

export type IncomeCategory =
  | '13º salário'
  | 'Aluguel recebido'
  | 'Bônus'
  | 'Dividendos'
  | 'Freela'
  | 'Outros'
  | 'Renda passiva'
  | 'Saldo inicial'
  | 'Salário'
  | 'Venda';

export type Category = ExpenseCategory | IncomeCategory;

// Nota: 'Cartão de Crédito' existe em ExpenseCategory mas é uma categoria de
// sistema (usada só no pagamento de fatura). Fica fora desta lista de propósito,
// para não aparecer nos seletores de categoria nem no detalhamento por categoria.
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Academia',
  'Água',
  'Alimentação',
  'Assinaturas',
  'Beleza',
  'Combustível',
  'Compras online',
  'Condomínio',
  'Crianças',
  'Cuidados pessoais',
  'Delivery',
  'Dentista',
  'Doação',
  'Educação',
  'Farmácia',
  'Games',
  'Gás',
  'Imposto',
  'Internet',
  'Investimentos',
  'Lazer',
  'Luz',
  'Manutenção',
  'Médico',
  'Moradia',
  'Outros',
  'Pet',
  'Presente',
  'Psicólogo',
  'Saúde',
  'Seguro',
  'Streaming',
  'Telefone',
  'Trabalho',
  'Transporte',
  'Vestuário',
  'Viagem',
];

// Nota: 'Saldo inicial' existe em IncomeCategory mas é uma categoria de
// sistema (gerada só pelo onboarding como ponto de partida do saldo). Fica
// fora desta lista de propósito — mesmo padrão de 'Cartão de Crédito' acima —
// para não aparecer nos seletores de receita nem nos detalhamentos por fonte.
export const INCOME_CATEGORIES: IncomeCategory[] = [
  '13º salário',
  'Aluguel recebido',
  'Bônus',
  'Dividendos',
  'Freela',
  'Outros',
  'Renda passiva',
  'Salário',
  'Venda',
];

// Categoria criada pelo usuário. Armazenada na tabela custom_categories.
// O nome convive no mesmo namespace de string das categorias fixas
// (EXPENSE_CATEGORIES / INCOME_CATEGORIES) — a unicidade é por usuário+tipo.
export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  color: string; // hex; uma das 12 cores da CUSTOM_COLOR_PALETTE
  type: EntryType;
  createdAt: string;
}

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
  // string livre: pode ser uma categoria fixa (Category) ou o nome de uma
  // CustomCategory do usuário. Validação do conjunto válido vive no frontend.
  category: string;
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
  category: string;
  type: EntryType;
  dayOfMonth?: number;
  dueDay?: number;
  active: boolean;
  isVariable: boolean;
  isCredit?: boolean;
  creditCardId?: string;
  // Quando definido, é uma recorrente de prazo finito (parcelamento/financiamento).
  // null/undefined = sem prazo (infinita).
  totalInstallments?: number;
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
  category: string;
  // dueDay pode ser undefined: recorrentes antigos ou cadastrados sem
  // due_day E sem day_of_month geram obrigação sem prazo definido.
  dueDay?: number;
  status: 'pending' | 'paid';
  paidAt?: string;
  createdAt: string;
}
