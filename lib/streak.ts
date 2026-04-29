function formatDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function calculateStreak(expenses: { date: string }[]): number {
  if (expenses.length === 0) return 0;

  const datesWithEntries = new Set(expenses.map((e) => e.date));

  const cursor = new Date();
  let streak = 0;

  while (datesWithEntries.has(formatDateStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
