import { NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/supabase/getRequestUser';
import { computeWeeklyReport } from '@/lib/reports';

export async function GET(req: Request) {
  const { user, supabase } = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const report = await computeWeeklyReport(supabase, user.id, new Date());
    return NextResponse.json(report);
  } catch (err) {
    console.error('[reports/weekly-summary]', err);
    return NextResponse.json({ error: 'Erro ao gerar resumo' }, { status: 500 });
  }
}
