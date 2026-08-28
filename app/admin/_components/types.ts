export interface Stats {
  users: {
    total: number; confirmed: number; unconfirmed: number;
    today: number; thisWeek: number; thisMonth: number;
    completedOnboarding: number; skippedOnboarding: number;
    withRecurring: number; withCreditCard: number; withCSVImport: number;
    neverLaunched: number; inactiveRisk: number;
    dau24h: number;
    active7d: number;
    risk7to14: number;
    lost14plus: number;
    withMission: number;
  };
  launches: {
    total: number; avgPerUser: number; byDayOfWeek: number[]; weekGrowth: number;
    topCategories: { category: string; emoji: string; count: number }[];
  };
  cards: { total: number };
  revenue: {
    mrr: number;
    mrrPrevMonth: number;
    mrrMonthly: number;
    mrrAnnual: number;
    totalProActive: number;
    breakdown: { monthly: number; annual: number; manual: number; beta: number; coupon: number };
    conversionRate: number;
    churnedThisMonth: number;
    proList: ProListItem[];
    churnList: ChurnListItem[];
  };
  churn: {
    neverLaunched: { user_id: string; email: string; created_at: string }[];
    inactiveRisk: { user_id: string; email: string; created_at: string; lastLaunch: string | null }[];
  };
  funnel: {
    signup: number;
    confirmed: number;
    launched: number;
    mission: number;
    pro: number;
  };
  signupsByWeek: { weekStart: string; count: number }[];
  topStreaks: { email: string; streak: number }[];
  missions: {
    activeCount: number;
    avgProgressPercent: number;
    topBadges: { key: string; emoji: string; name: string; count: number }[];
  };
}

export interface ProListItem {
  user_id: string;
  email: string;
  billing_cycle: string | null;
  since: string | null;
  monthlyValue: number;
}

export interface ChurnListItem {
  user_id: string;
  email: string;
  cancelledAt: string | null;
  billing_cycle: string | null;
}

/** Contagens de UM dia do calendário brasileiro (rota /api/admin/day). */
export interface DayTotals {
  /** Contas criadas no dia. */
  signups: number;
  /** E-mails confirmados no dia (pode incluir quem se cadastrou antes). */
  confirmed: number;
  /** Pessoas que abriram o app no dia (base do streak). */
  activeUsers: number;
  /** Lançamentos registrados no dia. */
  launches: number;
  /** Quantas pessoas distintas fizeram esses lançamentos. */
  launchUsers: number;
  upgrades: number;
  cancels: number;
  pushIos: number;
  pushAndroid: number;
  feedbacks: number;
}

export interface DaySummary {
  date: string;
  window: { startUtc: string; endUtc: string };
  totals: DayTotals;
  events: ActivityItem[];
}

export type ActivityType = 'signup' | 'upgrade' | 'cancel' | 'feedback';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  email: string | null;
  description: string;
  meta?: string | null;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  days: number;
  max_uses: number;
  uses: number;
  active: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface PushHistoryItem {
  id: string;
  title: string;
  message: string;
  target: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

export interface UserRow {
  id: string; email: string; created_at: string;
  last_sign_in_at: string | null; email_confirmed_at: string | null;
  launches_count: number; has_recurring: boolean; has_credit_card: boolean;
  is_blocked: boolean;
  plan: string;
  billing_cycle: string | null;
  /** Loja de origem do Pro, gravada pelo webhook do RevenueCat. */
  store: 'app_store' | 'play_store' | string | null;
  /** Push nativo (FCM) ativo em algum aparelho iOS. */
  push_ios: boolean;
  /** Push nativo (FCM) ativo em algum aparelho Android. */
  push_android: boolean;
  /** Push web (VAPID) ativo em algum navegador. */
  push_web: boolean;
}

export type UserDetail = UserRow;

export interface Subscription {
  plan: string;
  status: string;
  billing_cycle: string | null;
  current_period_end: string | null;
  /** Loja de origem ('app_store' | 'play_store'). Null em manual/beta/cupom. */
  store: string | null;
  /** App User ID do RevenueCat (= user.id do Supabase). */
  revenuecat_app_user_id: string | null;
  /** Legado do checkout web da Kiwify, que não é mais usado. Mantidos só para
   *  não quebrar assinaturas antigas gravadas antes da virada app-first. */
  kiwify_order_id: string | null;
  kiwify_subscription_id: string | null;
  updated_at: string | null;
}

export type FeedbackCategory = 'bug' | 'sugestao' | 'elogio' | 'outro';

export interface FeedbackItem {
  id: string;
  user_id: string | null;
  email: string | null;
  category: FeedbackCategory;
  message: string;
  page: string | null;
  created_at: string;
}

// ── Funil de onboarding (/api/admin/onboarding) ────────────────────────────
export interface OnboardingFunnelStep {
  key: string;
  label: string;
  phase: 'pre' | 'post';
  skippable: boolean;
  reached: number;
  skipped: number;
  identified: number;
  droppedFromPrev: number;
  dropPct: number;
}

export interface OnboardingStats {
  cohort: {
    mode: 'real' | 'all';
    startDay: string;
    users: number;
    legacyExcluded: number;
    totalInDatabase: number;
  };
  events: {
    available: boolean;
    since: string | null;
    total: number;
    medianMinutesToFinish: number | null;
    steps: OnboardingFunnelStep[];
  };
  derived: {
    steps: { key: string; label: string; count: number }[];
  };
  conversion: {
    signups: number;
    payers: number;
    rate: number;
    courtesy: number;
    churned: number;
    payerList: {
      user_id: string;
      email: string;
      billing_cycle: string | null;
      store: string | null;
      since: string | null;
      daysToPay: number | null;
    }[];
  };
  retention: {
    returned: number;
    returnedRate: number;
    activeLast7: number;
    activeLast7Rate: number;
    d1: { hit: number; eligible: number; rate: number };
    d7: { hit: number; eligible: number; rate: number };
    d30: { hit: number; eligible: number; rate: number };
  };
  daily: { day: string; signups: number; confirmed: number; finished: number; payers: number }[];
  stuck: {
    user_id: string;
    email: string;
    created_at: string;
    daysSince: number;
    confirmed: boolean;
    reachedStep: string;
  }[];
}

export type TabKey =
  | 'overview' | 'onboarding' | 'users' | 'activity' | 'feedback'
  | 'coupons' | 'notifications' | 'communication';

export type EmailSegment = 'all' | 'free' | 'pro' | 'inactive' | 'never_launched';

export type PushTarget = 'all' | 'pro' | 'free';

export type StatusMessage = { kind: 'success' | 'error'; text: string };

export interface NavTab {
  key: TabKey;
  label: string;
  icon?: string;
}

export const NAV_TABS: readonly NavTab[] = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'onboarding', label: 'Onboarding', icon: '🚪' },
  { key: 'users', label: 'Usuários' },
  { key: 'activity', label: 'Atividade' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'coupons', label: 'Cupons' },
  { key: 'notifications', label: 'Notificações' },
  { key: 'communication', label: 'Comunicação', icon: '📣' },
] as const;
