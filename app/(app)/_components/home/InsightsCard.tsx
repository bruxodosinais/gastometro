'use client';

import { anim, hidden } from './_anim';

type Props = {
  monthInsights: string[];
  mounted: boolean;
};

export default function InsightsCard({ monthInsights, mounted }: Props) {
  return (
    <div
      style={{
        margin: '12px 16px 0',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        ...(mounted ? anim(400) : hidden),
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          background: 'var(--accent-bg)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 15,
        }}
      >
        💡
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--text)',
            margin: 0,
            marginBottom: monthInsights.length > 0 ? 6 : 4,
          }}
        >
          Seu mês em números
        </p>
        {monthInsights.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {monthInsights.map((text, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-2)',
                  marginTop: i === 0 ? 0 : 4,
                  lineHeight: 1.4,
                }}
              >
                • {text}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', margin: 0, lineHeight: 1.4 }}>
            Lance seus primeiros gastos para ver insights personalizados.
          </p>
        )}
      </div>
    </div>
  );
}
