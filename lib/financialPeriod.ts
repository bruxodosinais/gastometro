import { getMonthKey } from './calculations';

// Dado o dia de início do mês financeiro, retorna qual YYYY-MM key
// representa o período financeiro atual.
// Exemplo: startDay=5, hoje=3 mai → retorna "2026-04" (ainda no período de abril)
// Exemplo: startDay=5, hoje=7 mai → retorna "2026-05" (já no período de maio)
export function getFinancialCurrentPeriod(startDay: number | null | undefined): string {
  if (!startDay || startDay <= 1) return getMonthKey(new Date());
  const now = new Date();
  const today = now.getDate();
  if (today >= startDay) {
    return getMonthKey(now);
  } else {
    return getMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  }
}

// Retorna o label do período financeiro para exibição no seletor de mês.
// Exemplo: monthKey="2026-05", startDay=5 → "5 mai → 4 jun 2026"
// Exemplo: startDay=null → null (usa o label padrão do mês)
export function getFinancialPeriodLabel(
  monthKey: string,
  startDay: number | null | undefined
): string | null {
  if (!startDay || startDay <= 1) return null;
  const [y, m] = monthKey.split('-').map(Number);
  const startDate = new Date(y, m - 1, startDay);
  const endDate = new Date(y, m, startDay - 1); // startDay-1 do mês seguinte

  const fmt = (d: Date) =>
    d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
      .replace('.', '');

  const endYear = endDate.getFullYear();
  return `${fmt(startDate)} → ${fmt(endDate)} ${endYear}`;
}
