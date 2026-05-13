'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Budget, Expense, MonthlyObligation, MonthlyPlan, RecurringExpense } from './types';
import { formatCurrency } from './calculations';

export type NotificationType =
  | 'recurring_overdue'
  | 'recurring_today'
  | 'recurring_tomorrow'
  | 'recurring_3days'
  | 'budget_exceeded'
  | 'savings_at_risk';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  subtitle: string;
  iconEmoji: string;
  href: string;
  priority: number;
}

const LS_KEY = 'gastometro_notif_read';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function persistReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

export function useNotifications({
  expenses,
  budgets,
  recurringExpenses,
  obligations,
  monthlyPlan,
  period,
}: {
  expenses: Expense[];
  budgets: Budget[];
  recurringExpenses: RecurringExpense[];
  obligations: MonthlyObligation[];
  monthlyPlan: MonthlyPlan | null;
  period: string;
}) {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  const notifications = useMemo<AppNotification[]>(() => {
    const now = new Date();
    const today = now.getDate();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const list: AppNotification[] = [];

    // 1 — Vencimento de recorrentes (despesas ativas não pagas)
    for (const rec of recurringExpenses) {
      if (!rec.active || rec.type !== 'expense') continue;

      const paid = obligations.some(
        (o) => o.recurringExpenseId === rec.id && o.status === 'paid'
      );
      if (paid) continue;

      // Notificações de atraso/vencimento usam EXCLUSIVAMENTE rec.dueDay.
      // Sem due_day cadastrado, não há prazo de pagamento — então não gera
      // alerta de atraso/vencimento (apesar de poder existir day_of_month).
      if (typeof rec.dueDay !== 'number' || rec.dueDay < 1 || rec.dueDay > 31) continue;
      const dueDay = rec.dueDay;
      const diff = dueDay - today;

      if (diff < 0) {
        list.push({
          id: `recorrente_${rec.id}_${currentMonth}_overdue`,
          type: 'recurring_overdue',
          title: `${rec.description} está em atraso`,
          subtitle: `${formatCurrency(rec.amount)} · Vencia dia ${dueDay}`,
          iconEmoji: '🔴',
          href: '/recorrentes',
          priority: 110,
        });
      } else if (diff === 0) {
        list.push({
          id: `recorrente_${rec.id}_${currentMonth}_0`,
          type: 'recurring_today',
          title: `${rec.description} vence hoje`,
          subtitle: `${formatCurrency(rec.amount)} · Não perca o prazo`,
          iconEmoji: '🔴',
          href: '/recorrentes',
          priority: 100,
        });
      } else if (diff === 1) {
        list.push({
          id: `recorrente_${rec.id}_${currentMonth}_1`,
          type: 'recurring_tomorrow',
          title: `${rec.description} vence amanhã`,
          subtitle: `${formatCurrency(rec.amount)} · Vencimento dia ${dueDay}`,
          iconEmoji: '🟠',
          href: '/recorrentes',
          priority: 90,
        });
      } else if (diff === 3) {
        list.push({
          id: `recorrente_${rec.id}_${currentMonth}_3`,
          type: 'recurring_3days',
          title: `${rec.description} vence em 3 dias`,
          subtitle: `${formatCurrency(rec.amount)} · Vencimento dia ${dueDay}`,
          iconEmoji: '🟡',
          href: '/recorrentes',
          priority: 80,
        });
      }
    }

    // 2 — Orçamento estourado (1 notificação por categoria por mês)
    const currentMonthExpenses = expenses.filter(
      (e) => e.date.slice(0, 7) === currentMonth && e.type === 'expense'
    );
    for (const budget of budgets) {
      const total = currentMonthExpenses
        .filter((e) => e.category === budget.category)
        .reduce((s, e) => s + e.amount, 0);
      if (total > budget.amount) {
        const pct = Math.round((total / budget.amount) * 100);
        list.push({
          id: `budget_${budget.category}_${currentMonth}`,
          type: 'budget_exceeded',
          title: `${budget.category} estourou o orçamento`,
          subtitle: `Gasto ${formatCurrency(total)} de ${formatCurrency(budget.amount)} planejado (${pct}% do limite)`,
          iconEmoji: '📊',
          href: '/historico',
          priority: 70,
        });
      }
    }

    // 3 — Meta de poupança em risco (só mês atual, após dia 15)
    if (period === currentMonth && today > 15 && monthlyPlan && monthlyPlan.savingsGoal > 0) {
      const currentIncome = expenses
        .filter((e) => e.date.slice(0, 7) === currentMonth && e.type === 'income')
        .reduce((s, e) => s + e.amount, 0);
      const currentSpent = currentMonthExpenses.reduce((s, e) => s + e.amount, 0);
      const balance = currentIncome - currentSpent;
      if (balance < monthlyPlan.savingsGoal * 0.5) {
        list.push({
          id: `savings_${currentMonth}`,
          type: 'savings_at_risk',
          title: 'Meta de poupança em risco',
          subtitle: `Você guardou ${formatCurrency(Math.max(balance, 0))} de ${formatCurrency(monthlyPlan.savingsGoal)} este mês. Ainda dá tempo.`,
          iconEmoji: '🎯',
          href: '/metas',
          priority: 60,
        });
      }
    }

    return list.sort((a, b) => b.priority - a.priority);
  }, [expenses, budgets, recurringExpenses, obligations, monthlyPlan, period]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds]
  );

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set([...prev, ...notifications.map((n) => n.id)]);
      persistReadIds(next);
      return next;
    });
  }, [notifications]);

  return { notifications, unreadCount, readIds, markAsRead, markAllAsRead };
}
