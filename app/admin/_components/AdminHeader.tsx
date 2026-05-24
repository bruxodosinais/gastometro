import { NAV_TABS, type TabKey } from './types';

interface Props {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  feedbackUnread: number;
}

export function AdminHeader({ tab, setTab, feedbackUnread }: Props) {
  return (
    <aside style={{
      width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
      padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 4,
      position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 10,
    }} className="admin-sidebar">
      <div style={{ padding: '0 20px 24px', fontWeight: 900, fontSize: 18, color: 'var(--accent)' }}>
        Admin
      </div>
      {NAV_TABS.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          textAlign: 'left', padding: '10px 20px', border: 'none', background: 'none',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: tab === t.key ? 700 : 500,
          color: tab === t.key ? 'var(--accent)' : 'var(--text-2)',
          borderLeft: tab === t.key ? '3px solid var(--accent)' : '3px solid transparent',
          transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{t.label}</span>
          {t.key === 'feedback' && feedbackUnread > 0 && (
            <span style={{
              background: 'var(--accent)', color: '#fff', borderRadius: 999,
              fontSize: 11, fontWeight: 800, padding: '2px 7px', minWidth: 20, textAlign: 'center',
            }}>
              {feedbackUnread}
            </span>
          )}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <a href="/app" style={{
        padding: '10px 20px', color: 'var(--text-3)', fontSize: 13, textDecoration: 'none',
      }}>← Voltar ao app</a>
    </aside>
  );
}
