import { MetricCard, ProgressBar, SectionTitle } from './shared';
import { DAYS, fmt, fmtBRL, pct } from './utils';
import type { EmailSegment, Stats, StatusMessage } from './types';

interface Props {
  stats: Stats | null;
  loadingStats: boolean;
  neverExpanded: boolean;
  setNeverExpanded: (fn: (v: boolean) => boolean) => void;
  riskExpanded: boolean;
  setRiskExpanded: (fn: (v: boolean) => boolean) => void;
  emailSegment: EmailSegment;
  setEmailSegment: (v: EmailSegment) => void;
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  emailMessage: string;
  setEmailMessage: (v: string) => void;
  emailSending: boolean;
  emailResult: StatusMessage | null;
  onSendBulkEmail: () => void;
}

export function AdminOverview({
  stats, loadingStats,
  neverExpanded, setNeverExpanded,
  riskExpanded, setRiskExpanded,
  emailSegment, setEmailSegment,
  emailSubject, setEmailSubject,
  emailMessage, setEmailMessage,
  emailSending, emailResult,
  onSendBulkEmail,
}: Props) {
  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 24px' }}>Visão Geral</h1>

      {loadingStats ? (
        <p style={{ color: 'var(--text-3)' }}>Carregando métricas…</p>
      ) : stats ? (
        <>
          {/* Row 1 — Usuários */}
          <SectionTitle>Usuários</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <MetricCard label="Total de usuários" value={stats.users.total} />
            <MetricCard label="Hoje" value={stats.users.today} color="var(--accent)" />
            <MetricCard label="Esta semana" value={stats.users.thisWeek} color="var(--accent)" />
            <MetricCard label="Este mês" value={stats.users.thisMonth} color="var(--accent)" />
          </div>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r)', padding: '20px',
            border: '1px solid var(--border)', marginTop: 12,
          }}>
            <ProgressBar label="Confirmados" value={stats.users.confirmed} total={stats.users.total} color="var(--green)" />
            <ProgressBar label="Não confirmados" value={stats.users.unconfirmed} total={stats.users.total} color="var(--yellow)" />
          </div>

          {/* Row 2 — Engajamento */}
          <SectionTitle>Engajamento</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <MetricCard label="Onboarding completo" value={stats.users.completedOnboarding}
              sub={`${pct(stats.users.completedOnboarding, stats.users.total)}% do total`} />
            <MetricCard label="Pularam onboarding" value={stats.users.skippedOnboarding}
              sub={`${pct(stats.users.skippedOnboarding, stats.users.total)}% do total`} />
            <MetricCard label="Com recorrente" value={stats.users.withRecurring}
              sub={`${pct(stats.users.withRecurring, stats.users.total)}%`} color="var(--green)" />
            <MetricCard label="Com cartão" value={stats.users.withCreditCard}
              sub={`${pct(stats.users.withCreditCard, stats.users.total)}%`} />
            <MetricCard label="Com importação CSV" value={stats.users.withCSVImport}
              sub={`${pct(stats.users.withCSVImport, stats.users.total)}%`} />
          </div>

          {/* Row 3 — Lançamentos */}
          <SectionTitle>Lançamentos</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <MetricCard label="Total de lançamentos" value={stats.launches.total.toLocaleString('pt-BR')} />
            <MetricCard label="Média por usuário" value={stats.launches.avgPerUser} />
            <MetricCard
              label="Crescimento semanal"
              value={`${stats.launches.weekGrowth > 0 ? '↑' : stats.launches.weekGrowth < 0 ? '↓' : '—'} ${Math.abs(stats.launches.weekGrowth)}%`}
              color={stats.launches.weekGrowth >= 0 ? 'var(--green)' : 'var(--red)'}
            />
            <MetricCard
              label="Dia mais ativo"
              value={DAYS[stats.launches.byDayOfWeek.indexOf(Math.max(...stats.launches.byDayOfWeek))]}
            />
          </div>

          {/* Row 4 — Saúde / Churn */}
          <SectionTitle>Saúde</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Nunca lançaram */}
            <div style={{
              background: stats.users.neverLaunched > 5 ? 'var(--red-bg)' : 'var(--surface)',
              borderRadius: 'var(--r)', padding: 20, border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Nunca lançaram</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: stats.users.neverLaunched > 5 ? 'var(--red)' : 'var(--text)' }}>
                {stats.users.neverLaunched}
              </div>
              {stats.churn.neverLaunched.length > 0 && (
                <button onClick={() => setNeverExpanded(v => !v)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                  color: 'var(--accent)', padding: 0, marginTop: 8,
                }}>
                  {neverExpanded ? 'Ocultar lista ▲' : 'Ver lista ▼'}
                </button>
              )}
              {neverExpanded && (
                <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {stats.churn.neverLaunched.map(u => (
                    <div key={u.user_id} style={{ fontSize: 12, color: 'var(--text-2)', padding: '2px 0', borderBottom: '1px solid var(--border-2)' }}>
                      {u.email} <span style={{ color: 'var(--text-3)' }}>({fmt(u.created_at)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Risco de churn */}
            <div style={{
              background: stats.users.inactiveRisk > 3 ? '#FFF8E6' : 'var(--surface)',
              borderRadius: 'var(--r)', padding: 20, border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Risco de churn (7+ dias sem lançar)</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: stats.users.inactiveRisk > 3 ? 'var(--yellow)' : 'var(--text)' }}>
                {stats.users.inactiveRisk}
              </div>
              {stats.churn.inactiveRisk.length > 0 && (
                <button onClick={() => setRiskExpanded(v => !v)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                  color: 'var(--accent)', padding: 0, marginTop: 8,
                }}>
                  {riskExpanded ? 'Ocultar lista ▲' : 'Ver lista ▼'}
                </button>
              )}
              {riskExpanded && (
                <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
                  {stats.churn.inactiveRisk.map(u => (
                    <div key={u.user_id} style={{ fontSize: 12, color: 'var(--text-2)', padding: '2px 0', borderBottom: '1px solid var(--border-2)' }}>
                      {u.email}
                      <span style={{ color: 'var(--text-3)' }}> — último: {fmt(u.lastLaunch)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 5 — Receita */}
          <SectionTitle>Receita</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            <MetricCard
              label="MRR (mensal recorrente)"
              value={fmtBRL(stats.revenue.mrr)}
              sub={`Mensais ${fmtBRL(stats.revenue.mrrMonthly)} + Anuais ${fmtBRL(stats.revenue.mrrAnnual)}`}
              color="var(--green)"
            />
            <MetricCard
              label="Pro ativos"
              value={stats.revenue.totalProActive}
              sub={`${stats.revenue.conversionRate}% de conversão`}
            />
            <MetricCard label="Mensais" value={stats.revenue.breakdown.monthly} sub="Kiwify mês" />
            <MetricCard label="Anuais" value={stats.revenue.breakdown.annual} sub="Kiwify ano" />
            <MetricCard label="Manual" value={stats.revenue.breakdown.manual} sub="concedido pelo admin" />
            <MetricCard label="Beta" value={stats.revenue.breakdown.beta} sub="?ref=beta" />
            <MetricCard label="Cupom" value={stats.revenue.breakdown.coupon} sub="trial via código" />
            <MetricCard
              label="Churn do mês"
              value={stats.revenue.churnedThisMonth}
              sub="cancelamentos"
              color={stats.revenue.churnedThisMonth > 0 ? 'var(--red)' : 'var(--text)'}
            />
          </div>

          {/* Row 6 — Comunicação */}
          <SectionTitle>Comunicação</SectionTitle>
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r)', padding: 20,
            border: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: '0 0 12px' }}>
              Envie um e-mail em massa via Resend para um segmento de usuários. Limite de {50} destinatários por envio.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Destinatário
                <select
                  value={emailSegment}
                  onChange={e => setEmailSegment(e.target.value as EmailSegment)}
                  style={{
                    display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                    borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                    background: 'var(--surface)', fontFamily: 'inherit', fontSize: 14,
                  }}
                >
                  <option value="all">Todos os usuários</option>
                  <option value="free">Apenas Free</option>
                  <option value="pro">Apenas Pro</option>
                  <option value="inactive">Usuários inativos (7+ dias)</option>
                </select>
              </label>
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Assunto *
                <input
                  type="text" value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Assunto do e-mail"
                  style={{
                    display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                    borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                    fontFamily: 'inherit', fontSize: 14,
                  }}
                />
              </label>
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Mensagem *
                <textarea
                  value={emailMessage}
                  onChange={e => setEmailMessage(e.target.value)}
                  placeholder="Texto simples (sem HTML)…"
                  rows={6}
                  style={{
                    display: 'block', marginTop: 4, width: '100%', padding: '10px 12px',
                    borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
                    fontFamily: 'inherit', fontSize: 14, resize: 'vertical',
                  }}
                />
              </label>
              {emailResult && (
                <p style={{
                  margin: 0, fontSize: 13,
                  color: emailResult.kind === 'success' ? 'var(--green)' : 'var(--red)',
                }}>{emailResult.text}</p>
              )}
              <div>
                <button
                  onClick={onSendBulkEmail}
                  disabled={emailSending || !emailSubject.trim() || !emailMessage.trim()}
                  style={{
                    padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
                    borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit',
                    fontWeight: 700, fontSize: 14,
                    opacity: emailSending || !emailSubject.trim() || !emailMessage.trim() ? 0.6 : 1,
                  }}
                >
                  {emailSending ? 'Enviando…' : 'Enviar e-mail'}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--red)' }}>Erro ao carregar métricas.</p>
      )}
    </>
  );
}
