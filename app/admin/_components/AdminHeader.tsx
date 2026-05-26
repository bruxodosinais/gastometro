'use client';

import { useState } from 'react';
import { NAV_TABS, type TabKey } from './types';

interface Props {
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  feedbackUnread: number;
}

export function AdminHeader({ tab, setTab, feedbackUnread }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelect = (key: TabKey) => {
    setTab(key);
    setDrawerOpen(false);
  };

  const navItems = (
    <>
      <div style={{ padding: '0 20px 24px', fontWeight: 900, fontSize: 18, color: 'var(--accent)' }}>
        Admin
      </div>
      {NAV_TABS.map(t => (
        <button key={t.key} onClick={() => handleSelect(t.key)} style={{
          textAlign: 'left', padding: '10px 20px', border: 'none', background: 'none',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: tab === t.key ? 700 : 500,
          color: tab === t.key ? 'var(--accent)' : '#374151',
          borderLeft: tab === t.key ? '3px solid var(--accent)' : '3px solid transparent',
          transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {t.icon && <span aria-hidden="true">{t.icon}</span>}
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
        padding: '10px 20px', color: '#6b7280', fontSize: 13, textDecoration: 'none',
      }}>← Voltar ao app</a>
    </>
  );

  return (
    <>
      {/* Sidebar desktop */}
      <aside style={{
        width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: '32px 0', display: 'flex', flexDirection: 'column', gap: 4,
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 10,
      }} className="admin-sidebar">
        {navItems}
      </aside>

      {/* Topbar mobile */}
      <header className="admin-topbar" style={{
        display: 'none',
        position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: 50,
        background: '#ffffff', borderBottom: '1px solid #e5e7eb',
        alignItems: 'center', padding: '0 12px', gap: 12,
      }}>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menu"
          style={{
            width: 40, height: 40, borderRadius: 10, border: 'none',
            background: '#5B5BD6', color: '#fff', cursor: 'pointer',
            fontSize: 20, lineHeight: 1, fontFamily: 'inherit', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >☰</button>

        <div style={{
          flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 15,
          color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          Admin · TôOrganizado
        </div>

        <div style={{ width: 40, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          {feedbackUnread > 0 && (
            <span
              aria-label={`${feedbackUnread} feedback não lido`}
              style={{
                background: '#5B5BD6', color: '#fff', borderRadius: 999,
                fontSize: 11, fontWeight: 800, padding: '3px 9px', minWidth: 22, textAlign: 'center',
              }}
            >
              {feedbackUnread}
            </span>
          )}
        </div>
      </header>

      {/* Overlay mobile */}
      {drawerOpen && (
        <div
          className="admin-overlay"
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99,
          }}
        />
      )}

      {/* Drawer mobile */}
      <aside
        className="admin-drawer"
        aria-hidden={!drawerOpen}
        style={{
          display: 'none',
          position: 'fixed', top: 0, bottom: 0, left: 0, width: 280, zIndex: 100,
          background: '#ffffff', flexDirection: 'column', gap: 4, padding: '32px 0',
          boxShadow: '4px 0 16px rgba(0,0,0,0.12)',
          transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s ease',
        }}
      >
        {navItems}
      </aside>
    </>
  );
}
