import type { SubscriptionPlan } from '@/hooks/useSubscription';

export type LimitFeature =
  | 'expensesPerMonth'
  | 'recurringExpenses'
  | 'gastoBotRequests'
  | 'hasGoals'
  | 'hasPatrimony'
  | 'hasCreditCards';

export interface PlanLimits {
  expensesPerMonth: number;
  recurringExpenses: number;
  gastoBotRequests: number;
  hasGoals: boolean;
  hasPatrimony: boolean;
  hasCreditCards: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    expensesPerMonth: 20,
    recurringExpenses: 5,
    gastoBotRequests: 1,
    hasGoals: false,
    hasPatrimony: false,
    hasCreditCards: false,
  },
  pro: {
    expensesPerMonth: Infinity,
    recurringExpenses: Infinity,
    gastoBotRequests: Infinity,
    hasGoals: true,
    hasPatrimony: true,
    hasCreditCards: true,
  },
};

export interface LimitCheck {
  allowed: boolean;
  current: number;
  limit: number;
  feature: LimitFeature;
}

export function checkLimit(
  plan: SubscriptionPlan,
  feature: LimitFeature,
  currentCount = 0,
): LimitCheck {
  const limits = PLAN_LIMITS[plan];
  const raw = limits[feature];

  if (typeof raw === 'boolean') {
    return {
      allowed: raw,
      current: currentCount,
      limit: raw ? Infinity : 0,
      feature,
    };
  }

  return {
    allowed: currentCount < raw,
    current: currentCount,
    limit: raw,
    feature,
  };
}
