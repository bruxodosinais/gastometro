'use client';

import { BUDGET_DANGER, BUDGET_OVER, BUDGET_WARN } from '@/lib/budgetAlerts';

export type BudgetStatusRow = { pct: number; spent: number; limit: number };

// Pills de saúde dos LIMITES POR CATEGORIA. Vive fora da página porque a Home
// (resumo no card de orçamento) e a tela /orcamentos mostram a mesma contagem
// com as mesmas cores — os degraus vêm de lib/budgetAlerts.
export default function BudgetStatusPills({
  rows,
  hideWhenAllGreen = false,
}: {
  rows: BudgetStatusRow[];
  /** true = não renderiza nada quando está tudo no verde (uso na /orcamentos). */
  hideWhenAllGreen?: boolean;
}) {
  if (rows.length === 0) return null;

  const green = rows.filter((r) => r.pct < BUDGET_WARN).length;
  const yellow = rows.filter((r) => r.pct >= BUDGET_WARN && r.pct < BUDGET_DANGER).length;
  const orange = rows.filter((r) => r.pct >= BUDGET_DANGER && r.pct < BUDGET_OVER).length;
  const redRows = rows.filter((r) => r.pct >= BUDGET_OVER);
  const red = redRows.length;

  if (hideWhenAllGreen && yellow === 0 && orange === 0 && red === 0) return null;

  // Quem empatou com o limite não "estourou" — não chamar de estourado.
  const redLabel = redRows.every((r) => r.spent <= r.limit)
    ? `${red} no limite`
    : `${red} estourado${red > 1 ? 's' : ''}`;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {green > 0 && <Pill bg="var(--green-bg)" color="var(--green-text)">{green} no controle</Pill>}
      {yellow > 0 && <Pill bg="var(--yellow-bg)" color="var(--yellow-text)">{yellow} em atenção</Pill>}
      {orange > 0 && <Pill bg="var(--orange-bg)" color="var(--orange-text)">{orange} quase no limite</Pill>}
      {red > 0 && <Pill bg="var(--red-bg)" color="var(--red)">{redLabel}</Pill>}
    </div>
  );
}

function Pill({
  bg,
  color,
  children,
}: {
  bg: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
