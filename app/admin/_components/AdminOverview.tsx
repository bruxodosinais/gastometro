'use client';

import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Chip } from './shared';
import { DAYS, fmt, fmtBRL, pct } from './utils';
import type { Stats } from './types';

// ───── Design tokens (alinhados com o brief) ─────
const C = {
  bg: '#F7F7F5',
  card: '#FFFFFF',
  primary: '#5B5BD6',
  success: '#00C37A',
  danger: '#FF4757',
  warning: '#FFB800',
  text: '#1A1A1A',
  text2: '#6B6B6B',
  text3: '#9CA3AF',
  border: '#E5E5E0',
  borderLight: '#F0F0EC',
};

type SubTab = 'overview' | 'aquisicao' | 'retencao' | 'receita' | 'engajamento';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'aquisicao', label: 'Aquisição' },
  { key: 'retencao', label: 'Retenção' },
  { key: 'receita', label: 'Receita' },
  { key: 'engajamento', label: 'Engajamento' },
];

interface Props {
  stats: Stats | null;
  loadingStats: boolean;
  neverExpanded: boolean;
  setNeverExpanded: (fn: (v: boolean) => boolean) => void;
  riskExpanded: boolean;
  setRiskExpanded: (fn: (v: boolean) => boolean) => void;
}

export function AdminOverview({
  stats, loadingStats,
  neverExpanded, setNeverExpanded,
  riskExpanded, setRiskExpanded,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>('overview');

  return (
    <>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 16px', color: C.text }}>
        Dashboard
      </h1>

      <SubTabsNav subTab={subTab} setSubTab={setSubTab} />

      {loadingStats ? (
        <p style={{ color: C.text2 }}>Carregando métricas…</p>
      ) : !stats ? (
        <p style={{ color: C.danger }}>Erro ao carregar métricas.</p>
      ) : subTab === 'overview' ? (
        <OverviewPanel
          stats={stats}
          neverExpanded={neverExpanded}
          setNeverExpanded={setNeverExpanded}
          riskExpanded={riskExpanded}
          setRiskExpanded={setRiskExpanded}
        />
      ) : subTab === 'aquisicao' ? (
        <AquisicaoPanel stats={stats} />
      ) : subTab === 'retencao' ? (
        <RetencaoPanel stats={stats} neverExpanded={neverExpanded} setNeverExpanded={setNeverExpanded} />
      ) : subTab === 'receita' ? (
        <ReceitaPanel stats={stats} />
      ) : (
        <EngajamentoPanel stats={stats} />
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Sub-tabs nav (scroll horizontal no mobile)
// ──────────────────────────────────────────────────────────────
function SubTabsNav({
  subTab, setSubTab,
}: { subTab: SubTab; setSubTab: (s: SubTab) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto',
      paddingBottom: 4,
    }}>
      {SUB_TABS.map(t => {
        const active = t.key === subTab;
        return (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap',
              background: active ? C.primary : C.card,
              color: active ? '#fff' : C.text2,
              boxShadow: active ? 'none' : `inset 0 0 0 1px ${C.border}`,
              transition: 'all 0.15s',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Cards reutilizáveis
// ──────────────────────────────────────────────────────────────
function FeaturedKpiCard({
  label, value, variationPct, sub, accentColor, children,
}: {
  label: string;
  value: string;
  variationPct?: number | null;
  sub?: string;
  accentColor: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: 20,
      borderLeft: `4px solid ${accentColor}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1 }}>{value}</div>
        {variationPct != null && (
          <VariationBadge pct={variationPct} />
        )}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: C.text3, marginTop: 6 }}>{sub}</div>
      )}
      {children}
    </div>
  );
}

function VariationBadge({ pct }: { pct: number }) {
  const positive = pct >= 0;
  return (
    <span style={{
      background: positive ? 'rgba(0,195,122,0.12)' : 'rgba(255,71,87,0.12)',
      color: positive ? C.success : C.danger,
      fontSize: 12, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
    }}>
      {positive ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function MiniKpi({
  label, value, sub, color,
}: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: '16px 18px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4, color: color ?? C.text, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ABA: OVERVIEW
// ──────────────────────────────────────────────────────────────
function OverviewPanel({
  stats, neverExpanded, setNeverExpanded, riskExpanded, setRiskExpanded,
}: {
  stats: Stats;
  neverExpanded: boolean;
  setNeverExpanded: (fn: (v: boolean) => boolean) => void;
  riskExpanded: boolean;
  setRiskExpanded: (fn: (v: boolean) => boolean) => void;
}) {
  const mrr = stats.revenue.mrr;
  const mrrPrev = stats.revenue.mrrPrevMonth;
  const mrrVariation = mrrPrev > 0
    ? ((mrr - mrrPrev) / mrrPrev) * 100
    : (mrr > 0 ? 100 : null);

  // Projeção fim do mês: MRR * dias_no_mes / dia_atual
  const now = new Date();
  const dia = now.getDate();
  const diasNoMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projecao = dia > 0 ? mrr * (diasNoMes / dia) : mrr;

  const ativos = stats.users.active7d;
  const inativos = stats.users.total - ativos;
  const ativosPct = stats.users.total > 0 ? Math.round((ativos / stats.users.total) * 100) : 0;

  return (
    <>
      {/* Cards principais — 2 colunas desktop, 1 mobile */}
      <div className="admin-kpi-hero" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16,
      }}>
        <FeaturedKpiCard
          label="Receita do mês"
          value={fmtBRL(mrr)}
          variationPct={mrrVariation ?? undefined}
          sub={`Projeção fim do mês: ${fmtBRL(projecao)}`}
          accentColor={C.success}
        />
        <FeaturedKpiCard
          label="Usuários total"
          value={String(stats.users.confirmed)}
          sub={`${stats.users.thisMonth} novos este mês`}
          accentColor={C.primary}
        >
          <div style={{ marginTop: 12 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 12, color: C.text2, marginBottom: 4,
            }}>
              <span>Ativos (7d)</span>
              <span style={{ fontWeight: 700, color: C.text }}>
                {ativos} <span style={{ color: C.text3, fontWeight: 400 }}>({ativosPct}%)</span>
              </span>
            </div>
            <div style={{ background: C.border, borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{
                width: `${ativosPct}%`, background: C.primary, height: 8,
                transition: 'width 0.5s',
              }} />
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
              Inativos: {inativos}
            </div>
          </div>
        </FeaturedKpiCard>
      </div>

      {/* Cards secundários — 4 cols desktop, 2 mobile */}
      <div className="admin-kpi-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16,
      }}>
        <MiniKpi label="MRR" value={fmtBRL(stats.revenue.mrr)} color={C.success} />
        <MiniKpi label="Pro ativos" value={stats.revenue.totalProActive} sub={`${stats.revenue.conversionRate}% conversão`} />
        <MiniKpi
          label="Churn do mês"
          value={stats.revenue.churnedThisMonth}
          sub="cancelamentos"
          color={stats.revenue.churnedThisMonth > 0 ? C.danger : C.text}
        />
        <MiniKpi label="DAU (24h)" value={stats.users.dau24h} sub="usuários ativos hoje" color={C.primary} />
        <MiniKpi
          label="Nunca lançaram"
          value={stats.users.neverLaunched}
          color={stats.users.neverLaunched > 5 ? C.danger : C.text}
        />
        <MiniKpi
          label="Risco de churn"
          value={stats.users.inactiveRisk}
          sub="7+ dias sem lançar"
          color={stats.users.inactiveRisk > 3 ? C.warning : C.text}
        />
        <MiniKpi label="Total lançamentos" value={stats.launches.total.toLocaleString('pt-BR')} />
        <MiniKpi label="Média / usuário" value={stats.launches.avgPerUser} sub="lançamentos" />
      </div>

      {/* Churn detalhado: nunca lançaram + risco */}
      <div className="admin-metric-grid" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      }}>
        <ChurnListCard
          title="Nunca lançaram"
          count={stats.users.neverLaunched}
          color={stats.users.neverLaunched > 5 ? C.danger : C.text}
          accentBg={stats.users.neverLaunched > 5 ? 'rgba(255,71,87,0.06)' : C.card}
          expanded={neverExpanded}
          setExpanded={setNeverExpanded}
          list={stats.churn.neverLaunched.map(u => ({
            email: u.email,
            sub: `cadastrou ${fmt(u.created_at)}`,
          }))}
        />
        <ChurnListCard
          title="Risco de churn (7+ dias)"
          count={stats.users.inactiveRisk}
          color={stats.users.inactiveRisk > 3 ? C.warning : C.text}
          accentBg={stats.users.inactiveRisk > 3 ? 'rgba(255,184,0,0.06)' : C.card}
          expanded={riskExpanded}
          setExpanded={setRiskExpanded}
          list={stats.churn.inactiveRisk.map(u => ({
            email: u.email,
            sub: u.lastLaunch ? `último: ${fmt(u.lastLaunch)}` : 'nunca lançou',
          }))}
        />
      </div>
    </>
  );
}

function ChurnListCard({
  title, count, color, accentBg, expanded, setExpanded, list,
}: {
  title: string; count: number; color: string; accentBg: string;
  expanded: boolean; setExpanded: (fn: (v: boolean) => boolean) => void;
  list: { email: string; sub: string }[];
}) {
  return (
    <div style={{
      background: accentBg, borderRadius: 12, padding: 18,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 12, color: C.text2, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{count}</div>
      {list.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
            color: C.primary, padding: 0, marginTop: 8,
          }}
        >
          {expanded ? 'Ocultar lista ▲' : 'Ver lista ▼'}
        </button>
      )}
      {expanded && (
        <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
          {list.map((it, i) => (
            <div key={i} style={{
              fontSize: 12, color: C.text2, padding: '4px 0',
              borderBottom: `1px solid ${C.borderLight}`,
            }}>
              {it.email} <span style={{ color: C.text3 }}>({it.sub})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ABA: AQUISIÇÃO
// ──────────────────────────────────────────────────────────────
function AquisicaoPanel({ stats }: { stats: Stats }) {
  const chartData = stats.signupsByWeek.map(s => ({
    name: s.weekStart.slice(5), // MM-DD
    novos: s.count,
  }));

  const confirmRate = pct(stats.users.confirmed, stats.users.total);
  const onboardRate = pct(stats.users.completedOnboarding, stats.users.total);

  return (
    <>
      <div className="admin-metric-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16,
      }}>
        <MiniKpi label="Confirmaram e-mail" value={`${confirmRate}%`} sub={`${stats.users.confirmed} de ${stats.users.total}`} color={C.success} />
        <MiniKpi label="Onboarding completo" value={`${onboardRate}%`} sub={`${stats.users.completedOnboarding} de ${stats.users.total}`} color={C.primary} />
        <MiniKpi label="Novos este mês" value={stats.users.thisMonth} sub={`${stats.users.today} hoje`} />
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          Novos usuários — últimas 8 semanas
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.text2 }} />
            <YAxis tick={{ fontSize: 12, fill: C.text2 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
            <Line type="monotone" dataKey="novos" stroke={C.primary} strokeWidth={2.5} dot={{ fill: C.primary, r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          Funil de conversão
        </div>
        <Funnel funnel={stats.funnel} />
      </div>
    </>
  );
}

function Funnel({ funnel }: { funnel: Stats['funnel'] }) {
  const stages = [
    { label: 'Cadastrou', value: funnel.signup, color: C.primary },
    { label: 'Confirmou e-mail', value: funnel.confirmed, color: C.primary },
    { label: 'Lançou despesa', value: funnel.launched, color: C.success },
    { label: 'Criou missão', value: funnel.mission, color: C.success },
    { label: 'Pro', value: funnel.pro, color: C.warning },
  ];
  const max = stages[0].value || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stages.map((s, i) => {
        const widthPct = max > 0 ? Math.max(2, (s.value / max) * 100) : 0;
        const prev = i === 0 ? null : stages[i - 1].value;
        const stagePct = prev && prev > 0 ? Math.round((s.value / prev) * 100) : (i === 0 ? 100 : null);
        return (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: C.text2, fontWeight: 600 }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: C.text }}>
                {s.value}
                {stagePct != null && (
                  <span style={{ color: C.text3, fontWeight: 500, marginLeft: 6 }}>
                    ({stagePct}%{i > 0 ? ' do anterior' : ''})
                  </span>
                )}
              </span>
            </div>
            <div style={{ background: C.borderLight, borderRadius: 4, height: 10, overflow: 'hidden' }}>
              <div style={{
                width: `${widthPct}%`, height: 10, background: s.color,
                transition: 'width 0.5s',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ABA: RETENÇÃO
// ──────────────────────────────────────────────────────────────
function RetencaoPanel({
  stats, neverExpanded, setNeverExpanded,
}: {
  stats: Stats;
  neverExpanded: boolean;
  setNeverExpanded: (fn: (v: boolean) => boolean) => void;
}) {
  const total = stats.users.total || 1;
  const ativosPct = Math.round((stats.users.active7d / total) * 100);
  const riskPct = Math.round((stats.users.risk7to14 / total) * 100);
  const lostPct = Math.round((stats.users.lost14plus / total) * 100);

  return (
    <>
      <div className="admin-metric-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16,
      }}>
        <RetencaoCard
          label="Ativos (últimos 7 dias)"
          count={stats.users.active7d}
          percent={ativosPct}
          color={C.success}
        />
        <RetencaoCard
          label="Em risco (7–14 dias)"
          count={stats.users.risk7to14}
          percent={riskPct}
          color={C.warning}
        />
        <RetencaoCard
          label="Perdidos (14+ dias)"
          count={stats.users.lost14plus}
          percent={lostPct}
          color={C.danger}
        />
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          Top 10 — maiores streaks de dias consecutivos
        </div>
        {stats.topStreaks.length === 0 ? (
          <p style={{ color: C.text3, fontSize: 13, margin: 0 }}>Nenhum streak ativo.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>E-mail</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>Streak</th>
                </tr>
              </thead>
              <tbody>
                {stats.topStreaks.map((s, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: '8px 10px', color: C.text3 }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.email}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: C.success }}>
                      🔥 {s.streak} {s.streak === 1 ? 'dia' : 'dias'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ChurnListCard
        title="Nunca lançaram"
        count={stats.users.neverLaunched}
        color={stats.users.neverLaunched > 5 ? C.danger : C.text}
        accentBg={stats.users.neverLaunched > 5 ? 'rgba(255,71,87,0.06)' : C.card}
        expanded={neverExpanded}
        setExpanded={setNeverExpanded}
        list={stats.churn.neverLaunched.map(u => ({
          email: u.email,
          sub: `cadastrou ${fmt(u.created_at)}`,
        }))}
      />
    </>
  );
}

function RetencaoCard({
  label, count, percent, color,
}: { label: string; count: number; percent: number; color: string }) {
  return (
    <div style={{
      background: C.card, borderRadius: 12, padding: 18,
      borderLeft: `4px solid ${color}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{count}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{percent}%</span>
      </div>
      <div style={{ background: C.border, borderRadius: 4, height: 6, marginTop: 8, overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, background: color, height: 6, transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ABA: RECEITA
// ──────────────────────────────────────────────────────────────
function ReceitaPanel({ stats }: { stats: Stats }) {
  const mrr = stats.revenue.mrr;
  // LTV = MRR / churn_rate (mensal). Churn rate aproximado: churnedThisMonth / proAtivos
  const proAtivos = stats.revenue.totalProActive;
  const churnRate = proAtivos > 0 ? stats.revenue.churnedThisMonth / proAtivos : 0;
  const ltv = churnRate > 0 ? mrr / churnRate : null;

  const paidPro = stats.revenue.proList.filter(p => p.monthlyValue > 0);
  const manualPro = stats.revenue.proList.filter(p => p.monthlyValue === 0);

  return (
    <>
      <div className="admin-metric-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16,
      }}>
        <MiniKpi
          label="MRR atual"
          value={fmtBRL(mrr)}
          sub={`Mensal ${fmtBRL(stats.revenue.mrrMonthly)} + Anual ${fmtBRL(stats.revenue.mrrAnnual)}`}
          color={C.success}
        />
        <MiniKpi
          label="MRR mês anterior"
          value={fmtBRL(stats.revenue.mrrPrevMonth)}
        />
        <MiniKpi
          label="LTV estimado"
          value={ltv != null ? fmtBRL(ltv) : '—'}
          sub={churnRate > 0 ? `Churn ${(churnRate * 100).toFixed(1)}% / mês` : 'Sem churn no mês'}
          color={C.primary}
        />
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          Pro pagantes ({paidPro.length})
        </div>
        <ProTable list={paidPro} showMonthly />
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          Pro manuais / beta / cupom ({manualPro.length})
        </div>
        <ProTable list={manualPro} showMonthly={false} />
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
          Cancelamentos este mês ({stats.revenue.churnList.length})
        </div>
        {stats.revenue.churnList.length === 0 ? (
          <p style={{ color: C.text3, fontSize: 13, margin: 0 }}>Sem cancelamentos no período.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>E-mail</th>
                  <th style={{ textAlign: 'left', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>Plano</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>Cancelado em</th>
                </tr>
              </thead>
              <tbody>
                {stats.revenue.churnList.map((c, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: '8px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.email}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <Chip label={c.billing_cycle ?? '—'} color="#4b5563" bg="#E5E7EB" />
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: C.text2 }}>
                      {c.cancelledAt ? fmt(c.cancelledAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function ProTable({
  list, showMonthly,
}: {
  list: Stats['revenue']['proList'];
  showMonthly: boolean;
}) {
  if (list.length === 0) {
    return <p style={{ color: C.text3, fontSize: 13, margin: 0 }}>Nenhum registro.</p>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.border}` }}>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>E-mail</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>Plano</th>
            <th style={{ textAlign: 'left', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>Desde</th>
            {showMonthly && (
              <th style={{ textAlign: 'right', padding: '8px 10px', color: C.text2, fontWeight: 700 }}>R$ / mês</th>
            )}
          </tr>
        </thead>
        <tbody>
          {list.map((p, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
              <td style={{ padding: '8px 10px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.email}
              </td>
              <td style={{ padding: '8px 10px' }}>
                <Chip label={p.billing_cycle ?? '—'} color="#3730a3" bg="#E0E7FF" />
              </td>
              <td style={{ padding: '8px 10px', color: C.text2 }}>
                {p.since ? fmt(p.since) : '—'}
              </td>
              {showMonthly && (
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: C.success }}>
                  {fmtBRL(p.monthlyValue)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// ABA: ENGAJAMENTO
// ──────────────────────────────────────────────────────────────
function EngajamentoPanel({ stats }: { stats: Stats }) {
  const dayData = DAYS.map((d, i) => ({
    name: d,
    lançamentos: stats.launches.byDayOfWeek[i] ?? 0,
  }));
  const missionPct = stats.users.total > 0
    ? Math.round((stats.users.withMission / stats.users.total) * 100)
    : 0;

  return (
    <>
      <div className="admin-metric-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16,
      }}>
        <MiniKpi
          label="Com missão ativa"
          value={stats.users.withMission}
          sub={`${missionPct}% dos usuários`}
          color={C.primary}
        />
        <MiniKpi
          label="Progresso médio das missões"
          value={`${stats.missions.avgProgressPercent}%`}
          sub={`${stats.missions.activeCount} missões ativas`}
          color={C.success}
        />
        <MiniKpi
          label="Total lançamentos"
          value={stats.launches.total.toLocaleString('pt-BR')}
          sub={`Média ${stats.launches.avgPerUser} / usuário`}
        />
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Lançamentos por dia da semana
        </div>
        <p style={{ fontSize: 12, color: C.text2, margin: '0 0 12px' }}>
          Distribuição histórica de todos os lançamentos
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dayData}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: C.text2 }} />
            <YAxis tick={{ fontSize: 12, fill: C.text2 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13 }} />
            <Bar dataKey="lançamentos" fill={C.primary} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="admin-metric-grid" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
      }}>
        <div style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
            Top 5 categorias mais usadas
          </div>
          {stats.launches.topCategories.length === 0 ? (
            <p style={{ color: C.text3, fontSize: 13, margin: 0 }}>Sem dados.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.launches.topCategories.map((c, i) => {
                const max = stats.launches.topCategories[0]?.count ?? 1;
                const widthPct = max > 0 ? (c.count / max) * 100 : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{c.emoji} {c.category}</span>
                      <span style={{ fontWeight: 700, color: C.text }}>{c.count}</span>
                    </div>
                    <div style={{ background: C.borderLight, borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: `${widthPct}%`, background: C.primary, height: 6,
                        transition: 'width 0.5s',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: C.card, borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>
            Top 5 badges desbloqueados
          </div>
          {stats.missions.topBadges.length === 0 ? (
            <p style={{ color: C.text3, fontSize: 13, margin: 0 }}>Nenhum badge ainda.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stats.missions.topBadges.map((b, i) => {
                const max = stats.missions.topBadges[0]?.count ?? 1;
                const widthPct = max > 0 ? (b.count / max) * 100 : 0;
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{b.emoji} {b.name}</span>
                      <span style={{ fontWeight: 700, color: C.text }}>{b.count}</span>
                    </div>
                    <div style={{ background: C.borderLight, borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: `${widthPct}%`, background: C.success, height: 6,
                        transition: 'width 0.5s',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
