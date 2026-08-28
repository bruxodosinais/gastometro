// Vocabulário do funil de onboarding. Fonte única para: o tracker do cliente,
// a allowlist do /api/onboarding/track e os rótulos do painel admin.
//
// A ORDEM do array É o funil. Quem for instrumentar um passo novo insere na
// posição certa aqui — a queda entre passos é calculada por posição, não por
// nome, então passo fora de ordem vira "queda negativa" no painel.

export type OnboardingAction = 'view' | 'complete' | 'skip' | 'back' | 'deny';

export const ONBOARDING_ACTIONS: readonly OnboardingAction[] = [
  'view', 'complete', 'skip', 'back', 'deny',
];

export interface OnboardingStepDef {
  /** slug gravado no banco */
  key: string;
  /** rótulo no painel */
  label: string;
  /** 'pre' = antes da conta existir (nativo) · 'post' = dentro do /onboarding */
  phase: 'pre' | 'post';
  /** passo que o usuário pode pular explicitamente */
  skippable?: boolean;
}

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  // ── Pré-cadastro (app nativo, rota /inicio) ──────────────────────────────
  { key: 'intro_view',       label: 'Abriu o app (carrossel)',   phase: 'pre' },
  { key: 'intro_start',      label: 'Tocou em "Começar"',        phase: 'pre' },
  { key: 'quiz_1',           label: 'Quiz 1 · objetivo',         phase: 'pre' },
  { key: 'quiz_2',           label: 'Quiz 2 · quanto',           phase: 'pre' },
  { key: 'quiz_3',           label: 'Quiz 3 · aporte',           phase: 'pre' },
  { key: 'quiz_4',           label: 'Quiz 4 · compromisso',      phase: 'pre' },
  { key: 'quiz_5',           label: 'Quiz 5 · prazo',            phase: 'pre' },
  { key: 'quiz_6',           label: 'Quiz 6 · renda',            phase: 'pre', skippable: true },
  { key: 'quiz_7',           label: 'Quiz 7 · perfil',           phase: 'pre', skippable: true },
  { key: 'plan_ready',       label: 'Viu o plano pronto',        phase: 'pre' },
  { key: 'plan_cta',         label: 'Tocou "Criar conta"',       phase: 'pre' },
  { key: 'paywall_view',     label: 'Viu o paywall',             phase: 'pre', skippable: true },
  { key: 'paywall_subscribe', label: 'Assinou no paywall',       phase: 'pre' },
  { key: 'signup_view',      label: 'Abriu o cadastro',          phase: 'pre' },
  { key: 'signup_submit',    label: 'Enviou o cadastro',         phase: 'pre' },
  { key: 'confirm_view',     label: 'Tela do código',            phase: 'pre' },
  { key: 'confirm_ok',       label: 'Confirmou o e-mail',        phase: 'pre' },

  // ── Pós-cadastro (rota /onboarding) ──────────────────────────────────────
  { key: 'onb_welcome',      label: 'Boas-vindas',               phase: 'post', skippable: true },
  { key: 'onb_income',       label: '1 · Renda',                 phase: 'post' },
  { key: 'onb_recurring',    label: '2 · Contas fixas',          phase: 'post', skippable: true },
  { key: 'onb_cards',        label: '3 · Cartões',               phase: 'post', skippable: true },
  { key: 'onb_goal',         label: '4 · Meta de poupança',      phase: 'post', skippable: true },
  { key: 'onb_finance_a',    label: '5a · Saldo em conta',       phase: 'post', skippable: true },
  { key: 'onb_finance_b',    label: '5b · Contas já pagas',      phase: 'post', skippable: true },
  { key: 'onb_finance_c',    label: '5c · Resumo',               phase: 'post' },
  { key: 'onb_push',         label: 'Convite de notificações',   phase: 'post', skippable: true },
  { key: 'onb_done',         label: 'Entrou no app',             phase: 'post' },
];

export const ONBOARDING_STEP_KEYS: ReadonlySet<string> = new Set(
  ONBOARDING_STEPS.map(s => s.key),
);

export function stepLabel(key: string): string {
  return ONBOARDING_STEPS.find(s => s.key === key)?.label ?? key;
}
