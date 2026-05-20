'use client';

import type { CSSProperties } from 'react';

export const fieldLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
  display: 'block',
};

export const fieldStyle: CSSProperties = {
  width: '100%',
  background: 'var(--bg)',
  border: '1.5px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  padding: '12px 15px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text)',
  fontFamily: 'Nunito, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

export const menuItemStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'Nunito, sans-serif',
  textAlign: 'left',
};

export function Switch({
  on,
  onToggle,
  ariaLabel,
}: {
  on: boolean;
  onToggle: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        flexShrink: 0,
        borderRadius: 11,
        border: on ? 'none' : '1.5px solid var(--border)',
        background: on ? 'var(--accent)' : 'var(--bg)',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: on ? 3 : 2,
          left: on ? 21 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: on ? 'white' : 'var(--text-3)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          transition: 'left 0.2s ease, background 0.2s ease',
        }}
      />
    </button>
  );
}
