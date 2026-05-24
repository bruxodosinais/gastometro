import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeWeeklyReport, renderWeeklyEmailHtml } from '@/lib/reports';

// Endpoint TEMPORÁRIO de preview do e-mail semanal. Bloqueado em produção.
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json(
      { error: 'Informe ?user_id=<uuid>' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const report = await computeWeeklyReport(admin, userId, new Date());
  const html = renderWeeklyEmailHtml(report);

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
