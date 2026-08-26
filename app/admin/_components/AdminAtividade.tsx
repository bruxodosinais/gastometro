import { fmtRelative } from './utils';
import type { ActivityItem, DaySummary } from './types';

interface Props {
  activityItems: ActivityItem[];
  activityLoading: boolean;
  activityVisible: number;
  setActivityVisible: (fn: (v: number) => number) => void;
  onFetchActivity: () => void;
  // Modo "dia específico". dayDate vazio = feed dos últimos 30 dias.
  dayDate: string;
  setDayDate: (v: string) => void;
  daySummary: DaySummary | null;
  dayLoading: boolean;
}

const ICON: Record<string, string> = {
  signup: '👤', upgrade: '⭐', cancel: '❌', feedback: '💬',
};
const BORDER: Record<string, string> = {
  signup: '#6366F1', upgrade: '#10B981', cancel: '#EF4444', feedback: '#F59E0B',
};

/** AAAA-MM-DD no calendário local, que é o mesmo critério de dia da rota. */
function localDayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function hourOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function DayCard({ label, value, sub, accent }: {
  label: string; value: number; sub?: string; accent?: string;
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r)', padding: '14px 16px', minWidth: 0,
    }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? '#111827', lineHeight: 1.15 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const quickBtn: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', cursor: 'pointer', fontFamily: 'inherit',
  fontWeight: 700, fontSize: 13, color: 'var(--text)',
};

export function AdminAtividade({
  activityItems, activityLoading,
  activityVisible, setActivityVisible,
  onFetchActivity,
  dayDate, setDayDate, daySummary, dayLoading,
}: Props) {
  const t = daySummary?.totals;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#111827' }}>
          {dayDate ? 'Resumo do dia' : 'Atividade recente'}
        </h1>
        {!dayDate && (
          <button onClick={onFetchActivity} style={{
            padding: '8px 14px', background: 'var(--accent-bg)', color: 'var(--accent)', border: 'none',
            borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
          }}>↻ Atualizar</button>
        )}
      </div>

      {/* Seletor de dia */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)', padding: 12,
      }}>
        <label htmlFor="admin-day" style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>
          Ver um dia:
        </label>
        <input
          id="admin-day"
          type="date"
          value={dayDate}
          max={localDayStr()}
          onChange={e => setDayDate(e.target.value)}
          style={{
            padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)',
            background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
          }}
        />
        <button onClick={() => setDayDate(localDayStr())} style={quickBtn}>Hoje</button>
        <button onClick={() => setDayDate(localDayStr(-1))} style={quickBtn}>Ontem</button>
        {dayDate && (
          <>
            <button
              onClick={() => {
                const d = new Date(`${dayDate}T12:00:00`);
                d.setDate(d.getDate() - 1);
                setDayDate(d.toISOString().slice(0, 10));
              }}
              style={quickBtn}
              aria-label="Dia anterior"
            >←</button>
            <button
              onClick={() => {
                const d = new Date(`${dayDate}T12:00:00`);
                d.setDate(d.getDate() + 1);
                const next = d.toISOString().slice(0, 10);
                if (next <= localDayStr()) setDayDate(next);
              }}
              disabled={dayDate >= localDayStr()}
              style={{ ...quickBtn, opacity: dayDate >= localDayStr() ? 0.4 : 1 }}
              aria-label="Próximo dia"
            >→</button>
            <button
              onClick={() => setDayDate('')}
              style={{ ...quickBtn, color: 'var(--accent)', marginLeft: 'auto' }}
            >Limpar e ver os últimos 30 dias</button>
          </>
        )}
      </div>

      {/* ── Modo dia ── */}
      {dayDate ? (
        dayLoading ? (
          <p style={{ color: '#6b7280' }}>Carregando…</p>
        ) : !t ? (
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r)', padding: 32, textAlign: 'center',
            color: '#6b7280', border: '1px solid var(--border)',
          }}>Não foi possível carregar esse dia.</div>
        ) : (
          <>
            <div style={{
              display: 'grid', gap: 10, marginBottom: 20,
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            }}>
              <DayCard label="Contas criadas" value={t.signups} accent="#4F46E5" />
              <DayCard label="E-mails confirmados" value={t.confirmed} />
              <DayCard label="Usuários ativos" value={t.activeUsers} sub="abriram o app" accent="#0F766E" />
              <DayCard label="Lançamentos" value={t.launches} sub={`por ${t.launchUsers} pessoa${t.launchUsers === 1 ? '' : 's'}`} />
              <DayCard label="Viraram Pro" value={t.upgrades} accent={t.upgrades > 0 ? '#059669' : undefined} />
              <DayCard label="Saíram do Pro" value={t.cancels} accent={t.cancels > 0 ? '#DC2626' : undefined} />
              <DayCard label="Push ativado" value={t.pushIos + t.pushAndroid} sub={`${t.pushIos} iOS · ${t.pushAndroid} Android`} />
              <DayCard label="Feedbacks" value={t.feedbacks} />
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: '0 0 12px' }}>
              O que aconteceu nesse dia
            </h2>
            {daySummary.events.length === 0 ? (
              <div style={{
                background: 'var(--surface)', borderRadius: 'var(--r)', padding: 24, textAlign: 'center',
                color: '#6b7280', border: '1px solid var(--border)',
              }}>
                Nenhum cadastro, assinatura ou feedback nesse dia.
                {t.launches > 0 && ' Houve apenas lançamentos de quem já usava o app.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {daySummary.events.map(item => (
                  <div key={item.id} style={{
                    background: 'var(--surface)', borderRadius: 'var(--r)',
                    border: '1px solid var(--border)', borderLeft: `4px solid ${BORDER[item.type] ?? '#9ca3af'}`,
                    padding: 14, display: 'flex', gap: 12, alignItems: 'center',
                  }}>
                    <div style={{ fontSize: 22, lineHeight: 1 }}>{ICON[item.type] ?? '•'}</div>
                    <p style={{
                      flex: 1, minWidth: 0, margin: 0, fontSize: 14, color: '#111827',
                      fontWeight: 600, wordBreak: 'break-word',
                    }}>{item.description}</p>
                    <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {hourOf(item.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )
      ) : /* ── Feed dos últimos 30 dias ── */
        activityLoading ? (
          <p style={{ color: '#6b7280' }}>Carregando…</p>
        ) : activityItems.length === 0 ? (
          <div style={{
            background: 'var(--surface)', borderRadius: 'var(--r)', padding: 32, textAlign: 'center',
            color: '#6b7280', border: '1px solid var(--border)',
          }}>Nenhuma atividade nos últimos 30 dias.</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activityItems.slice(0, activityVisible).map(item => (
                <div key={item.id} style={{
                  background: 'var(--surface)', borderRadius: 'var(--r)',
                  border: '1px solid var(--border)', borderLeft: `4px solid ${BORDER[item.type] ?? '#9ca3af'}`,
                  padding: 14, display: 'flex', gap: 12, alignItems: 'center',
                }}>
                  <div style={{ fontSize: 22, lineHeight: 1 }}>{ICON[item.type] ?? '•'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 14, color: '#111827', fontWeight: 600,
                      wordBreak: 'break-word',
                    }}>{item.description}</p>
                  </div>
                  <span style={{
                    fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', fontWeight: 600,
                  }}>{fmtRelative(item.created_at)}</span>
                </div>
              ))}
            </div>
            {activityVisible < activityItems.length && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                <button
                  onClick={() => setActivityVisible(v => v + 20)}
                  style={{
                    padding: '10px 18px', background: 'var(--surface)', color: 'var(--accent)',
                    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
                  }}
                >Ver mais ({activityItems.length - activityVisible} restantes)</button>
              </div>
            )}
          </>
        )
      }
    </>
  );
}
