'use client';

import { useState } from 'react';
import { MetricCard, SectionTitle } from './shared';
import type { OnboardingStats, OnboardingFunnelStep } from './types';

interface Props {
  data: OnboardingStats | null;
  loading: boolean;
  cohort: 'real' | 'all';
  setCohort: (c: 'real' | 'all') => void;
  onRefresh: () => void;
}

const GOOD = '#10B981';
const WARN = '#F59E0B';
const BAD = '#EF4444';
const INK = '#6366F1';

/** Cor da queda: até 10% é normal, acima de 30% é vazamento. */
function dropColor(pct: number): string {
  if (pct >= 30) return BAD;
  if (pct >= 10) return WARN;
  return GOOD;
}

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r)', padding: 20, boxShadow: 'var(--card-shadow)',
    }}>
      {children}
    </div>
  );
}

/** Uma linha do funil: barra proporcional ao topo + quanto vazou no passo. */
function FunnelRow({
  label, count, top, dropped, dropPct, note, muted,
}: {
  label: string; count: number; top: number;
  dropped?: number; dropPct?: number; note?: string; muted?: boolean;
}) {
  const width = top > 0 ? Math.max(1.5, (count / top) * 100) : 0;
  const share = top > 0 ? Math.round((count / top) * 1000) / 10 : 0;
  return (
    <div style={{ marginBottom: 12, opacity: muted ? 0.45 : 1 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', gap: 8,
        fontSize: 13, marginBottom: 4, alignItems: 'baseline', flexWrap: 'wrap',
      }}>
        <span style={{ color: '#374151' }}>
          {label}
          {note && <span style={{ color: '#9ca3af', fontSize: 11, marginLeft: 6 }}>{note}</span>}
        </span>
        <span style={{ fontWeight: 700, color: '#111827', whiteSpace: 'nowrap' }}>
          {count}
          <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 4 }}>({share}%)</span>
          {dropped !== undefined && dropped > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 800,
              color: dropColor(dropPct ?? 0),
            }}>
              −{dropped} ({dropPct}%)
            </span>
          )}
        </span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 4, height: 10 }}>
        <div style={{
          width: `${width}%`, height: 10, borderRadius: 4,
          background: INK, transition: 'width 0.4s',
        }} />
      </div>
    </div>
  );
}

function Aviso({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  const bg = tone === 'warn' ? '#FEF3C7' : '#EEF2FF';
  const fg = tone === 'warn' ? '#92400E' : '#3730A3';
  return (
    <div style={{
      background: bg, color: fg, borderRadius: 'var(--r-sm)',
      padding: '12px 14px', fontSize: 13, lineHeight: 1.5, marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

export function AdminOnboarding({ data, loading, cohort, setCohort, onRefresh }: Props) {
  const [showStuck, setShowStuck] = useState(false);

  if (loading && !data) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Carregando funil…</div>;
  }
  if (!data) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Sem dados.</div>;
  }

  const { cohort: co, events, derived, conversion, retention, daily, stuck } = data;
  const topDerived = derived.steps[0]?.count ?? 0;

  // Só passos com evento entram no desenho do funil real — passo zerado é
  // "não instrumentado ou ninguém passou", não uma queda de 100%.
  const liveSteps = events.steps.filter(s => s.reached > 0);
  const topEvent = liveSteps[0]?.reached ?? 0;
  const worst = [...liveSteps].sort((a, b) => b.dropPct - a.dropPct)[0];

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? '#fff' : '#374151',
    fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
  });

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, flexWrap: 'wrap', gap: 12,
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#111827' }}>
          Funil de onboarding
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={tabBtn(cohort === 'real')} onClick={() => setCohort('real')}>
            Usuários reais
          </button>
          <button style={tabBtn(cohort === 'all')} onClick={() => setCohort('all')}>
            Tudo (com legado)
          </button>
          <button onClick={onRefresh} style={{
            padding: '7px 12px', background: 'var(--accent-bg)', color: 'var(--accent)',
            border: 'none', borderRadius: 'var(--r-sm)', cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
          }}>↻</button>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px' }}>
        {cohort === 'real' ? (
          <>Contas criadas a partir de <strong>{fmtDay(co.startDay)}</strong> (início do tráfego).
          {' '}{co.legacyExcluded} contas anteriores — testes, beta e Pro cortesia — ficam de fora,
          {' '}sem serem apagadas.</>
        ) : (
          <>Todas as {co.totalInDatabase} contas do banco, incluindo testes internos, beta testers
          {' '}e as compras sandbox da revisão da Apple. Serve para conferência, não para decidir.</>
        )}
      </p>

      {/* ── Números do topo ───────────────────────────────────── */}
      <div style={{
        display: 'grid', gap: 16, marginBottom: 8,
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
      }}>
        <MetricCard label="Cadastros" value={co.users} sub={`desde ${fmtDay(co.startDay)}`} />
        <MetricCard
          label="Conversão em Pro"
          value={`${conversion.rate}%`}
          sub={`${conversion.payers} pagante(s) de loja`}
          color={conversion.payers > 0 ? GOOD : '#111827'}
        />
        <MetricCard
          label="Voltaram depois do 1º dia"
          value={`${retention.returnedRate}%`}
          sub={`${retention.returned} de ${co.users}`}
          color={retention.returnedRate >= 40 ? GOOD : retention.returnedRate >= 20 ? WARN : BAD}
        />
        <MetricCard
          label="Ativos nos últimos 7 dias"
          value={`${retention.activeLast7Rate}%`}
          sub={`${retention.activeLast7} de ${co.users}`}
          color={retention.activeLast7Rate >= 30 ? GOOD : WARN}
        />
      </div>

      {/* ── Funil real, por evento ────────────────────────────── */}
      <SectionTitle>Onde o usuário desiste (rastreio ao vivo)</SectionTitle>
      {!events.available ? (
        <Aviso tone="warn">
          <strong>Ainda sem eventos.</strong> O rastreio passo a passo entrou agora — ele só mede
          quem passar pelo onboarding <em>a partir do deploy</em>. Enquanto isso, use o funil
          reconstruído abaixo, que é calculado a partir do que cada usuário deixou no banco.
          <br />
          <span style={{ fontSize: 12 }}>
            Se já passou um dia do deploy e isto continua vazio, confira se a migration
            <code style={{ margin: '0 4px' }}>add_onboarding_events.sql</code> foi aplicada no Supabase.
          </span>
        </Aviso>
      ) : (
        <Card>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16, fontSize: 12, color: '#6b7280' }}>
            <span>{events.total} eventos desde {events.since ? fmtDay(events.since.slice(0, 10)) : '—'}</span>
            {events.medianMinutesToFinish !== null && (
              <span>· mediana até entrar no app: <strong>{events.medianMinutesToFinish} min</strong></span>
            )}
          </div>

          {worst && worst.dropPct >= 10 && (
            <Aviso tone="warn">
              Maior vazamento: <strong>{worst.label}</strong> — perde {worst.droppedFromPrev} pessoa(s),
              {' '}{worst.dropPct}% de quem chegou no passo anterior.
            </Aviso>
          )}

          {(['pre', 'post'] as const).map(phase => {
            const rows = liveSteps.filter(s => s.phase === phase);
            if (rows.length === 0) return null;
            return (
              <div key={phase} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 12, fontWeight: 800, color: '#9ca3af',
                  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
                }}>
                  {phase === 'pre' ? 'Antes da conta existir' : 'Dentro do app, depois do cadastro'}
                </div>
                {rows.map((s: OnboardingFunnelStep) => (
                  <FunnelRow
                    key={s.key}
                    label={s.label}
                    count={s.reached}
                    top={topEvent}
                    dropped={s.droppedFromPrev}
                    dropPct={s.dropPct}
                    note={s.skipped > 0 ? `${s.skipped} pularam` : undefined}
                  />
                ))}
              </div>
            );
          })}
        </Card>
      )}

      {/* ── Funil reconstruído ────────────────────────────────── */}
      <SectionTitle>Funil reconstruído dos dados (vale para todo mundo)</SectionTitle>
      <Aviso>
        Calculado a partir do que cada conta tem no banco: quem tem salário passou pelo passo 1,
        quem tem cartão passou pelo 3, e assim por diante. Funciona para quem entrou antes do
        rastreio, mas é aproximação — quem cadastrou o cartão depois, já dentro do app, conta igual.
      </Aviso>
      <Card>
        {derived.steps.map((s, i) => {
          const prev = i > 0 ? derived.steps[i - 1].count : null;
          const dropped = prev !== null ? Math.max(0, prev - s.count) : undefined;
          const dropPct = prev && prev > 0 && dropped !== undefined
            ? Math.round((dropped / prev) * 1000) / 10 : undefined;
          return (
            <FunnelRow
              key={s.key}
              label={s.label}
              count={s.count}
              top={topDerived}
              dropped={dropped}
              dropPct={dropPct}
              note={s.key === 'finished' ? 'inclui quem apertou "pular tudo"' : undefined}
            />
          );
        })}
      </Card>

      {/* ── Conversão ─────────────────────────────────────────── */}
      <SectionTitle>Conversão em Pro</SectionTitle>
      <div style={{
        display: 'grid', gap: 16, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
      }}>
        <MetricCard
          label="Cadastro → Pro pagante"
          value={`${conversion.rate}%`}
          sub={`${conversion.payers} de ${conversion.signups}`}
          color={INK}
        />
        <MetricCard label="Pro cortesia" value={conversion.courtesy} sub="manual, beta ou cupom — fora da taxa" />
        <MetricCard label="Cancelaram" value={conversion.churned} sub="assinatura de loja cancelada" />
      </div>
      {conversion.payerList.length > 0 && (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                  <th style={{ padding: '6px 8px' }}>E-mail</th>
                  <th style={{ padding: '6px 8px' }}>Plano</th>
                  <th style={{ padding: '6px 8px' }}>Loja</th>
                  <th style={{ padding: '6px 8px' }}>Assinou</th>
                  <th style={{ padding: '6px 8px' }}>Dias até pagar</th>
                </tr>
              </thead>
              <tbody>
                {conversion.payerList.map(p => (
                  <tr key={p.user_id} style={{ borderTop: '1px solid var(--border-2)' }}>
                    <td style={{ padding: '8px' }}>{p.email}</td>
                    <td style={{ padding: '8px' }}>{p.billing_cycle === 'annual' ? 'Anual' : 'Mensal'}</td>
                    <td style={{ padding: '8px' }}>
                      {p.store === 'app_store' ? 'App Store' : p.store === 'play_store' ? 'Play Store' : '—'}
                    </td>
                    <td style={{ padding: '8px' }}>{p.since ? fmtDay(p.since.slice(0, 10)) : '—'}</td>
                    <td style={{ padding: '8px' }}>
                      {p.daysToPay === null ? '—' : p.daysToPay === 0 ? 'no mesmo dia' : `${p.daysToPay}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Retenção ──────────────────────────────────────────── */}
      <SectionTitle>Retenção</SectionTitle>
      <div style={{
        display: 'grid', gap: 16, marginBottom: 16,
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
      }}>
        <MetricCard label="D1" value={`${retention.d1.rate}%`} sub={`${retention.d1.hit} de ${retention.d1.eligible} que já tiveram a chance`} />
        <MetricCard label="D7" value={`${retention.d7.rate}%`} sub={`${retention.d7.hit} de ${retention.d7.eligible}`} />
        <MetricCard label="D30" value={`${retention.d30.rate}%`} sub={`${retention.d30.hit} de ${retention.d30.eligible}`} />
      </div>
      <Aviso>
        D1/D7/D30 contam quem abriu o app <em>exatamente</em> naquele dia depois do cadastro — é o
        padrão de mercado, e com base pequena ele oscila muito. Com poucos usuários, o número que
        importa mais é o &ldquo;voltaram depois do 1º dia&rdquo; lá em cima.
      </Aviso>

      {/* ── Dia a dia ─────────────────────────────────────────── */}
      {daily.length > 0 && (
        <>
          <SectionTitle>Dia a dia</SectionTitle>
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                    <th style={{ padding: '6px 8px' }}>Dia</th>
                    <th style={{ padding: '6px 8px' }}>Cadastros</th>
                    <th style={{ padding: '6px 8px' }}>Confirmaram</th>
                    <th style={{ padding: '6px 8px' }}>Saíram do onboarding</th>
                    <th style={{ padding: '6px 8px' }}>Pagantes</th>
                  </tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map(d => (
                    <tr key={d.day} style={{ borderTop: '1px solid var(--border-2)' }}>
                      <td style={{ padding: '8px' }}>{fmtDay(d.day)}</td>
                      <td style={{ padding: '8px', fontWeight: 700 }}>{d.signups}</td>
                      <td style={{ padding: '8px', color: d.confirmed < d.signups ? WARN : '#374151' }}>
                        {d.confirmed}
                      </td>
                      <td style={{ padding: '8px' }}>{d.finished}</td>
                      <td style={{ padding: '8px', color: d.payers > 0 ? GOOD : '#9ca3af', fontWeight: d.payers > 0 ? 700 : 400 }}>
                        {d.payers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── Quem travou ───────────────────────────────────────── */}
      <SectionTitle>Quem travou e onde ({stuck.length})</SectionTitle>
      <Card>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>
          Contas que nunca fizeram um lançamento por conta própria. O passo é deduzido do que
          ficou salvo no banco.
        </p>
        {stuck.length === 0 ? (
          <p style={{ fontSize: 14, color: GOOD, margin: 0 }}>Ninguém travado. 🎉</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                    <th style={{ padding: '6px 8px' }}>E-mail</th>
                    <th style={{ padding: '6px 8px' }}>Parou em</th>
                    <th style={{ padding: '6px 8px' }}>Há</th>
                  </tr>
                </thead>
                <tbody>
                  {(showStuck ? stuck : stuck.slice(0, 10)).map(u => (
                    <tr key={u.user_id} style={{ borderTop: '1px solid var(--border-2)' }}>
                      <td style={{ padding: '8px' }}>{u.email}</td>
                      <td style={{ padding: '8px', color: u.confirmed ? '#374151' : BAD }}>
                        {u.reachedStep}
                      </td>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>
                        {u.daysSince === 0 ? 'hoje' : `${u.daysSince}d`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stuck.length > 10 && (
              <button onClick={() => setShowStuck(v => !v)} style={{
                marginTop: 12, padding: '8px 14px', background: 'var(--accent-bg)',
                color: 'var(--accent)', border: 'none', borderRadius: 'var(--r-sm)',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
              }}>
                {showStuck ? 'Mostrar menos' : `Ver todos os ${stuck.length}`}
              </button>
            )}
          </>
        )}
      </Card>
    </>
  );
}
