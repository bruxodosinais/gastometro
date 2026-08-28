// COORTE DE USUÁRIOS REAIS.
//
// O banco tem duas populações misturadas: as contas de antes do lançamento
// (testes do Anderson, beta testers, Pro cortesia/cupom, e as compras sandbox
// da revisão da Apple) e as contas que chegaram pelo tráfego pago. Somar as
// duas envenena toda métrica de produto — conversão, retenção, funil.
//
// A separação é por DATA DE CADASTRO, e nada é apagado: o legado continua no
// banco e visível com `?cohort=all`. Apagar mudaria o histórico e levaria junto
// beta testers que ainda usam o app.
//
// 2026-08-17 = início da campanha de tráfego pago.
// Trocar sem mexer em código: env REAL_USER_COHORT_START (AAAA-MM-DD) na Vercel.

export const COHORT_START_DAY = process.env.REAL_USER_COHORT_START ?? '2026-08-17';

// Meia-noite de Brasília. Sem o offset explícito o Node interpretaria a data
// como UTC e o corte cairia 21h do dia anterior no horário local.
export function cohortStart(): Date {
  return new Date(`${COHORT_START_DAY}T00:00:00-03:00`);
}

export function isRealUser(createdAt: string | null | undefined): boolean {
  if (!createdAt) return false;
  return new Date(createdAt) >= cohortStart();
}

export type CohortMode = 'real' | 'all';

export function parseCohort(value: string | null): CohortMode {
  return value === 'all' ? 'all' : 'real';
}
