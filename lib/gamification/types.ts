// Tipos da fundação de gamificação (Fase 1 · Item 1). Espelham as 4 tabelas
// criadas em migrations/add_gamification_foundation.sql. Sem lógica — só tipos.
// Convenção do projeto: camelCase no app, snake_case no banco (mapeado nos
// helpers de leitura em coins.ts).

// Valores possíveis de coin_transactions.type (livro-razão de moedas).
// Mantém paridade 1:1 com o comentário da coluna `type` na migration.
export type CoinTransactionType =
  | 'expense_logged'
  | 'recurring_paid'
  | 'app_open'
  | 'mission_contribution'
  | 'ai_challenge'
  | 'month_positive'
  | 'weekly_streak'
  | 'milestone_reward'
  | 'challenge_reward'
  | 'shop_purchase'
  | 'freeze_purchase'
  | 'goal_milestone_reward';

// Valores possíveis de weekly_challenges.challenge_type.
export type WeeklyChallengeType =
  | 'log_5_days'
  | 'no_category_overflow'
  | 'mission_contribution'
  | 'categorize_card'
  | 'positive_week'
  | 'open_app_7_days';

// user_coins: saldo atual (1 linha por usuário, escrito só pelo trigger).
export interface UserCoins {
  id: string;
  userId: string;
  balance: number;
  totalEarned: number;
  updatedAt: string;
}

// coin_transactions: livro-razão append-only.
// amount > 0 = ganho, amount < 0 = gasto.
export interface CoinTransaction {
  id: string;
  userId: string;
  amount: number;
  type: CoinTransactionType;
  description: string | null;
  createdAt: string;
}

// streak_milestones: marcos de streak atingidos + controle de recompensa.
export interface StreakMilestone {
  id: string;
  userId: string;
  milestoneDays: number;
  unlockedAt: string;
  rewardClaimed: boolean;
}

// mission_goal_milestones: marcos de % da meta de poupança reivindicados (M2).
export interface GoalMilestone {
  id: string;
  missionId: string;
  userId: string;
  percent: number; // 25, 50, 75, 100
  unlockedAt: string;
  rewardCoins: number;
}

// weekly_challenges: desafios da semana por usuário.
export interface WeeklyChallenge {
  id: string;
  userId: string;
  week: string; // ISO 'YYYY-Www'
  challengeType: WeeklyChallengeType;
  target: number;
  progress: number;
  completed: boolean;
  rewardCoins: number;
  acceptedAt: string | null; // null = oferecido mas não aceito
  completedAt: string | null;
}
