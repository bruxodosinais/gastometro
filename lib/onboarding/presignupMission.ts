// Missão capturada no pré-cadastro (/comecar), ANTES de existir conta/sessão.
// Durabilidade: gravada no user_metadata no signUp (PRINCIPAL, cross-device) e
// no localStorage (ponte /comecar → /auth/cadastro, mesmo browser). Aplicada na
// 1ª sessão autenticada (efeito no /onboarding), lendo metadata primeiro e
// localStorage como fallback.

export interface PresignupMission {
  templateId: string;
  name: string;
  targetAmount: number;
  monthlyTarget: number;
  months: number;
  committedAt: string;
  // ── Campos opcionais do quiz nativo (Fatia 2) ──────────────────────────────
  // Ausentes no fluxo web (/comecar), que segue gravando só o shape acima. São
  // anexados pelo coerce SÓ quando presentes/válidos → web continua válida.
  // Persistidos pra reuso futuro (reframe, coach, saudação) mesmo sem consumo.
  monthlyIncome?: number;   // salário informado no Q2 (renda mensal)
  savingsPercent?: number;  // % do salário escolhido no slider (Q4)
  painPoint?: string;       // dor selecionada no Q5 (coach futuro)
  userFirstName?: string;   // nome do Q8 (prefill do cadastro + saudação)
  incomeSkipped?: boolean;  // true se o usuário pulou o salário (Q2)
}

const KEY = 'presignup_mission';

// Valida/normaliza um objeto vindo de QUALQUER fonte (user_metadata ou
// localStorage). Retorna null se incompleto (não cria missão sem name + alvo).
export function coercePresignupMission(raw: unknown): PresignupMission | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  const targetAmount = Number(o.targetAmount);
  const monthlyTarget = Number(o.monthlyTarget);
  const monthsRaw = Number(o.months);
  if (!name || !(targetAmount > 0) || !(monthlyTarget > 0) || !Number.isFinite(monthsRaw)) {
    return null;
  }
  const out: PresignupMission = {
    templateId: typeof o.templateId === 'string' ? o.templateId : 'outra',
    name: name.slice(0, 80),
    targetAmount,
    monthlyTarget,
    months: Math.max(1, Math.min(60, Math.round(monthsRaw))),
    committedAt: typeof o.committedAt === 'string' ? o.committedAt : new Date().toISOString(),
  };

  // Opcionais do quiz nativo — anexados só quando válidos (web não os envia).
  const monthlyIncome = Number(o.monthlyIncome);
  if (monthlyIncome > 0) out.monthlyIncome = monthlyIncome;
  const savingsPercent = Number(o.savingsPercent);
  if (savingsPercent > 0) out.savingsPercent = Math.round(savingsPercent);
  if (typeof o.painPoint === 'string' && o.painPoint.trim()) {
    out.painPoint = o.painPoint.trim().slice(0, 120);
  }
  if (typeof o.userFirstName === 'string' && o.userFirstName.trim()) {
    out.userFirstName = o.userFirstName.trim().slice(0, 40);
  }
  if (o.incomeSkipped === true) out.incomeSkipped = true;

  return out;
}

export function readLocalPresignup(): PresignupMission | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? coercePresignupMission(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocalPresignup(m: PresignupMission): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // localStorage indisponível (modo privado etc.) — segue só com user_metadata.
  }
}

export function clearLocalPresignup(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
