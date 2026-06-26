// Utils puros do "reframe de hora" do onboarding nativo (Fatia 2). Base de
// 220h/mês (jornada cheia média no BR) p/ converter salário → valor/hora e
// gastos → minutos de trabalho. Sem efeitos colaterais nem dependências —
// reutilizável fora do onboarding (ex.: insights, coach).
//
// Critérios de aceite (validados manualmente, projeto não tem test runner):
//   hourlyRate(3000)                 = 13.6363…  → "R$ 13,64/h"
//   minutesOfWork(8, 13.6363…)       ≈ 35 min
//   projectAccumulated(250, 1/5/10)  = 3000 / 15000 / 30000
//   monthsToTarget(5000, 250)        = 20 → formatMonths(20) = "1 ano e 8 meses"

export const DEFAULT_HOURS_PER_MONTH = 220;

/** Valor por hora a partir da renda mensal. 0 se entradas inválidas. */
export function hourlyRate(monthlyIncome: number, hoursPerMonth = DEFAULT_HOURS_PER_MONTH): number {
  if (!(monthlyIncome > 0) || !(hoursPerMonth > 0)) return 0;
  return monthlyIncome / hoursPerMonth;
}

/** Minutos de trabalho que um gasto representa, dado o valor/hora. */
export function minutesOfWork(amount: number, hourly: number): number {
  if (!(amount > 0) || !(hourly > 0)) return 0;
  return Math.round((amount / hourly) * 60);
}

/** Total acumulado guardando `monthly` por `years` anos (sem juros). */
export function projectAccumulated(monthly: number, years: number): number {
  if (!(monthly > 0) || !(years > 0)) return 0;
  return monthly * 12 * years;
}

/** Meses pra atingir `target` guardando `monthly` por mês. 0 se inválido. */
export function monthsToTarget(target: number, monthly: number): number {
  if (!(target > 0) || !(monthly > 0)) return 0;
  return Math.round(target / monthly);
}

/** Formata um total de meses como "X anos e Y meses" (pt-BR, pluralizado). */
export function formatMonths(totalMonths: number): string {
  const m = Math.max(0, Math.round(totalMonths));
  if (m === 0) return '0 meses';
  const years = Math.floor(m / 12);
  const months = m % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
  return parts.join(' e ');
}
