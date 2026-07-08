'use client';

// Primitivos de UI do onboarding nativo (carousel + quiz). Recriados aqui
// (não compartilhados com /comecar, onde PrimaryBtn/NavRow são locais) reusando
// os MESMOS tokens do app → visual idêntico, zero toque no fluxo web.

import type { ReactNode } from 'react';

export const ACCENT = '#5B5BD6';
export const ACCENT_DARK = '#4A4AC4';
export const BG = '#F7F7F5';
export const INK = '#1A1A1A';
export const INK_2 = '#6B6B6B';
export const INK_3 = '#B4B4AA';
export const FONT = 'Nunito, system-ui, -apple-system, sans-serif';

export function formatBRL(n: number): string {
  return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Casca full-screen do quiz: safe-area, bg, coluna centralizada (cabeçalho fixo,
// conteúdo rolável, rodapé). Usada por todos os 8 passos.
export function QuizShell({
  header,
  footer,
  children,
}: {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: BG,
        color: INK,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 22px 24px',
          boxSizing: 'border-box',
          minHeight: 0,
        }}
      >
        {header}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* margin auto centraliza verticalmente quando o conteúdo é curto; em
              passos longos as margens colapsam e rola normal a partir do topo. */}
          <div style={{ margin: 'auto 0', width: '100%', paddingTop: 8 }}>{children}</div>
        </div>
        {footer && <div style={{ paddingTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );
}

// Cabeçalho: voltar (←) · barra de progresso n/total · "Pular" opcional.
export function QuizHeader({
  step,
  total,
  onBack,
  onSkip,
}: {
  step: number;
  total: number;
  onBack: () => void;
  onSkip?: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Voltar"
        style={{
          border: 'none',
          background: 'transparent',
          color: INK_2,
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          flexShrink: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div style={{ flex: 1, display: 'flex', gap: 5 }} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i < step ? ACCENT : '#E4E4ED',
              transition: 'background .25s',
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onSkip}
        style={{
          visibility: onSkip ? 'visible' : 'hidden',
          border: 'none',
          background: 'transparent',
          color: INK_3,
          font: `700 14px ${FONT}`,
          cursor: 'pointer',
          padding: '4px 2px',
          flexShrink: 0,
        }}
      >
        Pular
      </button>
    </div>
  );
}

export function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ font: `800 24px/1.25 ${FONT}`, color: INK, margin: 0, letterSpacing: '-.4px' }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ font: `500 15px/1.5 ${FONT}`, color: INK_2, margin: '8px 0 0' }}>{subtitle}</p>
      )}
    </div>
  );
}

// Bolha do coach/mascote (passos conversacionais: 2, 4, 5, 8).
export function Coach({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 18 }}>
      <span
        aria-hidden="true"
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: '50%',
          background: '#EDEDFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
        }}
      >
        🦊
      </span>
      <div
        style={{
          background: '#fff',
          border: '1px solid #ECECEC',
          borderRadius: 14,
          borderTopLeftRadius: 4,
          padding: '12px 14px',
          font: `600 14px/1.45 ${FONT}`,
          color: INK,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function OptionCard({
  emoji,
  label,
  active,
  onClick,
}: {
  emoji?: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '15px 16px',
        borderRadius: 14,
        border: `1.5px solid ${active ? ACCENT : '#E4E4ED'}`,
        background: active ? '#EDEDFC' : '#fff',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {emoji && <span style={{ fontSize: 22 }} aria-hidden="true">{emoji}</span>}
      <span style={{ font: `800 15px ${FONT}`, color: INK }}>{label}</span>
    </button>
  );
}

export function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        height: 54,
        borderRadius: 16,
        border: 'none',
        background: disabled ? '#E4E4ED' : ACCENT,
        color: disabled ? INK_3 : '#fff',
        font: `800 17px ${FONT}`,
        boxShadow: disabled ? 'none' : '0 8px 20px rgba(91,91,214,.40)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function GhostBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        height: 44,
        marginTop: 12,
        border: 'none',
        background: 'transparent',
        color: ACCENT_DARK,
        font: `700 15px ${FONT}`,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
