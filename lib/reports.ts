import type { SupabaseClient } from '@supabase/supabase-js';
import { CATEGORY_CONFIG } from './categoryConfig';
import type { Category } from './types';

export type CategoryBreakdown = {
  category: string;
  amount: number;
  percentage: number;
  emoji: string;
};

export type PendingBill = {
  description: string;
  amount: number;
  dueDay: number;
};

export type WeeklyReport = {
  weekStart: string;
  weekEnd: string;
  totalSpent: number;
  previousSpent: number;
  variationPercent: number | null;
  topCategories: CategoryBreakdown[];
  pendingBills: PendingBill[];
  availableBalance: number;
  expectedIncome: number;
  monthSpent: number;
};

export type MonthlyReport = {
  monthLabel: string;
  monthKey: string;
  totalSpent: number;
  previousSpent: number;
  variationPercent: number | null;
  topCategories: CategoryBreakdown[];
  expectedIncome: number;
  savingsGoal: number;
  realizedSavings: number;
  fastestGrowingCategory: { category: string; growthPercent: number; emoji: string } | null;
};

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCategoryEmoji(cat: string): string {
  return CATEGORY_CONFIG[cat as Category]?.icon ?? '📦';
}

// Bounds da semana ISO (segunda → domingo) que CONTÉM `ref`.
export function getWeekBounds(ref: Date): { start: Date; end: Date } {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = d.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const start = new Date(d);
  start.setDate(d.getDate() - daysFromMon);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

// Semana ANTERIOR completa (segunda passada → domingo passado), relativa a `ref`.
export function getPreviousWeekBounds(ref: Date): { start: Date; end: Date } {
  const current = getWeekBounds(ref);
  const start = new Date(current.start);
  start.setDate(current.start.getDate() - 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function computeBreakdown(
  expenses: Array<{ category: string; amount: number; type: string }>,
): { total: number; top: CategoryBreakdown[] } {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    if (e.type !== 'expense') continue;
    totals.set(e.category, (totals.get(e.category) ?? 0) + Number(e.amount));
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  const top: CategoryBreakdown[] = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      emoji: getCategoryEmoji(category),
    }));
  return { total, top };
}

export async function computeWeeklyReport(
  supabase: SupabaseClient,
  userId: string,
  refDate: Date = new Date(),
): Promise<WeeklyReport> {
  const prev = getPreviousWeekBounds(refDate);
  const beforePrev = getPreviousWeekBounds(prev.start);
  const startStr = fmtDate(prev.start);
  const endStr = fmtDate(prev.end);
  const monthKey = startStr.slice(0, 7);
  const monthStart = `${monthKey}-01`;
  const today = fmtDate(refDate);

  const [{ data: prevExp }, { data: olderExp }, { data: monthExp }, { data: plan }, { data: pending }] =
    await Promise.all([
      supabase
        .from('expenses')
        .select('amount, category, type')
        .eq('user_id', userId)
        .gte('date', startStr)
        .lte('date', endStr),
      supabase
        .from('expenses')
        .select('amount, type')
        .eq('user_id', userId)
        .gte('date', fmtDate(beforePrev.start))
        .lte('date', fmtDate(beforePrev.end)),
      supabase
        .from('expenses')
        .select('amount, type')
        .eq('user_id', userId)
        .gte('date', monthStart)
        .lte('date', today),
      supabase
        .from('monthly_plans')
        .select('expected_income')
        .eq('user_id', userId)
        .eq('month', monthKey)
        .maybeSingle(),
      supabase
        .from('monthly_obligations')
        .select('description, amount, due_day, status')
        .eq('user_id', userId)
        .eq('month', monthKey)
        .eq('status', 'pending'),
    ]);

  const { total: totalSpent, top: topCategories } = computeBreakdown(
    (prevExp ?? []) as Array<{ category: string; amount: number; type: string }>,
  );
  const previousSpent = (olderExp ?? [])
    .filter((e) => e.type === 'expense')
    .reduce((s, e) => s + Number(e.amount), 0);
  const monthSpent = (monthExp ?? [])
    .filter((e) => e.type === 'expense')
    .reduce((s, e) => s + Number(e.amount), 0);

  const variationPercent =
    previousSpent > 0 ? ((totalSpent - previousSpent) / previousSpent) * 100 : null;

  const refDay = refDate.getDate();
  const pendingBills: PendingBill[] = (pending ?? [])
    .filter((p) => typeof p.due_day === 'number' && p.due_day < refDay)
    .map((p) => ({
      description: p.description as string,
      amount: Number(p.amount),
      dueDay: p.due_day as number,
    }));

  const expectedIncome = plan?.expected_income ? Number(plan.expected_income) : 0;
  const availableBalance = expectedIncome - monthSpent;

  return {
    weekStart: startStr,
    weekEnd: endStr,
    totalSpent,
    previousSpent,
    variationPercent,
    topCategories,
    pendingBills,
    availableBalance,
    expectedIncome,
    monthSpent,
  };
}

export async function computeMonthlyReport(
  supabase: SupabaseClient,
  userId: string,
  refDate: Date = new Date(),
): Promise<MonthlyReport> {
  // Mês anterior completo
  const ref = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const prevMonthDate = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const prevMonthEnd = new Date(ref.getFullYear(), ref.getMonth(), 0); // último dia do mês anterior
  const beforePrevMonthDate = new Date(ref.getFullYear(), ref.getMonth() - 2, 1);
  const beforePrevMonthEnd = new Date(ref.getFullYear(), ref.getMonth() - 1, 0);

  const monthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const monthLabel = prevMonthDate
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase());

  const [{ data: monthExp }, { data: prevMonthExp }, { data: plan }] = await Promise.all([
    supabase
      .from('expenses')
      .select('amount, category, type')
      .eq('user_id', userId)
      .gte('date', fmtDate(prevMonthDate))
      .lte('date', fmtDate(prevMonthEnd)),
    supabase
      .from('expenses')
      .select('amount, category, type')
      .eq('user_id', userId)
      .gte('date', fmtDate(beforePrevMonthDate))
      .lte('date', fmtDate(beforePrevMonthEnd)),
    supabase
      .from('monthly_plans')
      .select('expected_income, savings_goal')
      .eq('user_id', userId)
      .eq('month', monthKey)
      .maybeSingle(),
  ]);

  const { total: totalSpent, top: topCategories } = computeBreakdown(
    (monthExp ?? []) as Array<{ category: string; amount: number; type: string }>,
  );
  const monthIncome = (monthExp ?? [])
    .filter((e) => e.type === 'income')
    .reduce((s, e) => s + Number(e.amount), 0);
  const previousSpent = (prevMonthExp ?? [])
    .filter((e) => e.type === 'expense')
    .reduce((s, e) => s + Number(e.amount), 0);
  const variationPercent =
    previousSpent > 0 ? ((totalSpent - previousSpent) / previousSpent) * 100 : null;

  // Categoria que mais cresceu vs mês anterior
  const curByCat = new Map<string, number>();
  for (const e of monthExp ?? []) {
    if (e.type === 'expense') curByCat.set(e.category, (curByCat.get(e.category) ?? 0) + Number(e.amount));
  }
  const prevByCat = new Map<string, number>();
  for (const e of prevMonthExp ?? []) {
    if (e.type === 'expense') prevByCat.set(e.category, (prevByCat.get(e.category) ?? 0) + Number(e.amount));
  }
  let fastestGrowingCategory: MonthlyReport['fastestGrowingCategory'] = null;
  let bestGrowth = 0;
  for (const [cat, cur] of curByCat) {
    const prev = prevByCat.get(cat) ?? 0;
    if (prev <= 0 || cur <= prev) continue;
    const growth = ((cur - prev) / prev) * 100;
    if (growth > bestGrowth) {
      bestGrowth = growth;
      fastestGrowingCategory = { category: cat, growthPercent: growth, emoji: getCategoryEmoji(cat) };
    }
  }

  const expectedIncome = plan?.expected_income ? Number(plan.expected_income) : 0;
  const savingsGoal = plan?.savings_goal ? Number(plan.savings_goal) : 0;
  // Realizado: receita - gasto. Se não houver renda registrada, usa expected_income do plano.
  const realizedSavings = (monthIncome > 0 ? monthIncome : expectedIncome) - totalSpent;

  return {
    monthLabel,
    monthKey,
    totalSpent,
    previousSpent,
    variationPercent,
    topCategories,
    expectedIncome,
    savingsGoal,
    realizedSavings,
    fastestGrowingCategory,
  };
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDateBR = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

function variationBadge(pct: number | null): string {
  if (pct === null) return '';
  const arrow = pct >= 0 ? '↑' : '↓';
  const color = pct >= 0 ? '#dc2626' : '#16a34a';
  return `<span style="color:${color}; font-weight:700; font-size:13px;">${arrow} ${Math.abs(pct).toFixed(0)}% vs período anterior</span>`;
}

function categoryBlock(top: CategoryBreakdown[]): string {
  if (top.length === 0) {
    return `<p style="color:#6B6B6B; font-size:13px; margin:8px 0 0;">Nenhum gasto registrado neste período.</p>`;
  }
  return top
    .map(
      (c) => `
      <div style="margin:10px 0;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; color:#1A1A1A;">
          <span style="font-weight:600;">${c.emoji} ${c.category}</span>
          <span style="font-weight:700; white-space:nowrap;">${fmtBRL(c.amount)}</span>
        </div>
        <div style="background:#E5E5E0; height:6px; border-radius:3px; margin-top:4px; overflow:hidden;">
          <div style="background:#5B5BD6; width:${Math.min(100, c.percentage).toFixed(0)}%; height:100%;"></div>
        </div>
        <div style="font-size:11px; color:#6B6B6B; margin-top:2px;">${c.percentage.toFixed(0)}% do total</div>
      </div>`,
    )
    .join('');
}

function pendingBlock(bills: PendingBill[]): string {
  if (bills.length === 0) return '';
  const items = bills
    .slice(0, 5)
    .map(
      (b) => `<li style="font-size:13px; color:#1A1A1A; margin:4px 0;">
        <strong>${escapeHtml(b.description)}</strong> — ${fmtBRL(b.amount)} <span style="color:#92400e;">(venceu dia ${b.dueDay})</span>
      </li>`,
    )
    .join('');
  return `
    <div style="background:#fef3c7; border:1px solid #fde68a; border-radius:12px; padding:14px 16px; margin:18px 0;">
      <p style="margin:0 0 6px; font-size:13px; font-weight:800; color:#92400e;">⚠️ Contas pendentes</p>
      <ul style="margin:0; padding-left:18px;">${items}</ul>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const FOOTER = `
  <p style="margin-top:28px; font-size:12px; color:#94A3B8; text-align:center;">
    <a href="https://www.toorganizado.com.br/perfil" style="color:#5B5BD6; text-decoration:none;">Gerenciar preferências de e-mail</a>
  </p>`;

const HEADER = `
  <div style="text-align:center; margin-bottom:18px;">
    <p style="margin:0; font-size:13px; color:#94A3B8; letter-spacing:0.08em; text-transform:uppercase; font-weight:800;">TôOrganizado</p>
  </div>`;

export function renderWeeklyEmailHtml(report: WeeklyReport): string {
  const variation = variationBadge(report.variationPercent);
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width:560px; margin:0 auto; padding:32px 20px; background:#F7F7F5;">
    ${HEADER}
    <h1 style="font-size:22px; color:#1A1A1A; margin:0 0 4px; text-align:center;">Seu resumo da semana</h1>
    <p style="font-size:13px; color:#6B6B6B; text-align:center; margin:0 0 22px;">
      ${fmtDateBR(report.weekStart)} a ${fmtDateBR(report.weekEnd)}
    </p>

    <div style="background:#FFFFFF; border-radius:16px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <p style="font-size:12px; color:#6B6B6B; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">Total gasto na semana</p>
      <p style="font-size:30px; font-weight:800; color:#1A1A1A; margin:0;">${fmtBRL(report.totalSpent)}</p>
      ${variation ? `<p style="margin:6px 0 0;">${variation}</p>` : ''}

      <div style="height:1px; background:#E5E5E0; margin:18px 0;"></div>

      <p style="font-size:12px; color:#6B6B6B; margin:0 0 6px; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">Top categorias</p>
      ${categoryBlock(report.topCategories)}

      <div style="height:1px; background:#E5E5E0; margin:18px 0;"></div>

      <p style="font-size:12px; color:#6B6B6B; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">Saldo disponível no mês</p>
      <p style="font-size:18px; font-weight:800; color:${report.availableBalance >= 0 ? '#16a34a' : '#dc2626'}; margin:0;">
        ${fmtBRL(report.availableBalance)}
      </p>
      ${report.expectedIncome > 0 ? `<p style="font-size:11px; color:#6B6B6B; margin:2px 0 0;">Renda esperada ${fmtBRL(report.expectedIncome)} − gastos do mês ${fmtBRL(report.monthSpent)}</p>` : ''}
    </div>

    ${pendingBlock(report.pendingBills)}

    <div style="text-align:center; margin-top:20px;">
      <a href="https://www.toorganizado.com.br" style="display:inline-block; padding:12px 24px; background:#5B5BD6; color:#fff; text-decoration:none; border-radius:10px; font-weight:700; font-size:14px;">Abrir o app</a>
    </div>

    ${FOOTER}
  </div>`;
}

export function renderMonthlyEmailHtml(report: MonthlyReport): string {
  const variation = variationBadge(report.variationPercent);
  const savingsPct =
    report.savingsGoal > 0
      ? Math.max(0, Math.min(100, (report.realizedSavings / report.savingsGoal) * 100))
      : 0;

  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width:560px; margin:0 auto; padding:32px 20px; background:#F7F7F5;">
    ${HEADER}
    <h1 style="font-size:22px; color:#1A1A1A; margin:0 0 4px; text-align:center;">Seu mês em números</h1>
    <p style="font-size:13px; color:#6B6B6B; text-align:center; margin:0 0 22px;">${report.monthLabel}</p>

    <div style="background:#FFFFFF; border-radius:16px; padding:24px; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <p style="font-size:12px; color:#6B6B6B; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">Total gasto no mês</p>
      <p style="font-size:30px; font-weight:800; color:#1A1A1A; margin:0;">${fmtBRL(report.totalSpent)}</p>
      ${variation ? `<p style="margin:6px 0 0;">${variation}</p>` : ''}

      <div style="height:1px; background:#E5E5E0; margin:18px 0;"></div>

      <p style="font-size:12px; color:#6B6B6B; margin:0 0 6px; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">Top categorias</p>
      ${categoryBlock(report.topCategories)}

      ${
        report.savingsGoal > 0
          ? `
        <div style="height:1px; background:#E5E5E0; margin:18px 0;"></div>
        <p style="font-size:12px; color:#6B6B6B; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">Meta de poupança</p>
        <p style="font-size:14px; color:#1A1A1A; margin:0; font-weight:600;">
          Meta: ${fmtBRL(report.savingsGoal)} • Realizado: <strong>${fmtBRL(report.realizedSavings)}</strong>
        </p>
        <div style="background:#E5E5E0; height:8px; border-radius:4px; margin-top:8px; overflow:hidden;">
          <div style="background:${report.realizedSavings >= report.savingsGoal ? '#16a34a' : '#5B5BD6'}; width:${savingsPct.toFixed(0)}%; height:100%;"></div>
        </div>
        <p style="font-size:11px; color:#6B6B6B; margin:6px 0 0;">${savingsPct.toFixed(0)}% da meta</p>`
          : ''
      }

      ${
        report.fastestGrowingCategory
          ? `
        <div style="height:1px; background:#E5E5E0; margin:18px 0;"></div>
        <p style="font-size:12px; color:#6B6B6B; margin:0 0 4px; text-transform:uppercase; letter-spacing:0.06em; font-weight:700;">Categoria que mais cresceu</p>
        <p style="font-size:14px; color:#1A1A1A; margin:0;">
          ${report.fastestGrowingCategory.emoji} <strong>${report.fastestGrowingCategory.category}</strong>
          <span style="color:#dc2626; font-weight:700;"> ↑ ${report.fastestGrowingCategory.growthPercent.toFixed(0)}%</span>
        </p>`
          : ''
      }
    </div>

    <div style="text-align:center; margin-top:20px;">
      <a href="https://www.toorganizado.com.br" style="display:inline-block; padding:12px 24px; background:#5B5BD6; color:#fff; text-decoration:none; border-radius:10px; font-weight:700; font-size:14px;">Ver meu histórico</a>
    </div>

    ${FOOTER}
  </div>`;
}
