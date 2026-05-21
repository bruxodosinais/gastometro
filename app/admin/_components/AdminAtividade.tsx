import { fmtRelative } from './utils';
import type { ActivityItem } from './types';

interface Props {
  activityItems: ActivityItem[];
  activityLoading: boolean;
  activityVisible: number;
  setActivityVisible: (fn: (v: number) => number) => void;
  onFetchActivity: () => void;
}

export function AdminAtividade({
  activityItems, activityLoading,
  activityVisible, setActivityVisible,
  onFetchActivity,
}: Props) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Atividade recente</h1>
        <button onClick={onFetchActivity} style={{
          padding: '8px 14px', background: 'var(--accent-bg)', color: 'var(--accent)', border: 'none',
          borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
        }}>↻ Atualizar</button>
      </div>
      {activityLoading ? (
        <p style={{ color: 'var(--text-3)' }}>Carregando…</p>
      ) : activityItems.length === 0 ? (
        <div style={{
          background: 'var(--surface)', borderRadius: 'var(--r)', padding: 32, textAlign: 'center',
          color: 'var(--text-3)', border: '1px solid var(--border)',
        }}>Nenhuma atividade nos últimos 30 dias.</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activityItems.slice(0, activityVisible).map(item => {
              const icon = item.type === 'signup' ? '👤'
                : item.type === 'upgrade' ? '⭐'
                : item.type === 'cancel' ? '❌' : '💬';
              const borderColor = item.type === 'signup' ? '#6366F1'
                : item.type === 'upgrade' ? '#10B981'
                : item.type === 'cancel' ? '#EF4444' : '#F59E0B';
              return (
                <div key={item.id} style={{
                  background: 'var(--surface)', borderRadius: 'var(--r)',
                  border: '1px solid var(--border)', borderLeft: `4px solid ${borderColor}`,
                  padding: 14, display: 'flex', gap: 12, alignItems: 'center',
                }}>
                  <div style={{ fontSize: 22, lineHeight: 1 }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: 14, color: 'var(--text)', fontWeight: 600,
                      wordBreak: 'break-word',
                    }}>{item.description}</p>
                  </div>
                  <span style={{
                    fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap', fontWeight: 600,
                  }}>{fmtRelative(item.created_at)}</span>
                </div>
              );
            })}
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
      )}
    </>
  );
}
