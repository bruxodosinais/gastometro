'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

type Props = {
  title: string;
  description: string;
  feature: string; // ex: 'analise-donut' — vira ?from= no /upgrade
};

/**
 * Card de paywall inline para substituir gráficos PRO no plano free.
 * Visual segue o mesmo idioma do UpgradeBanner (variant="fullpage") mas em
 * formato compacto dimensionado pro slot do gráfico.
 */
export default function ProGateCard({ title, description, feature }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        background: 'var(--surface)',
        border: '1.5px dashed var(--accent-soft)',
        borderRadius: 'var(--r)',
        padding: '28px 20px',
        minHeight: 200,
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'var(--accent-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Sparkles size={26} color="var(--accent)" />
      </div>
      <p
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: 0,
          marginBottom: 4,
        }}
      >
        Recurso Pro
      </p>
      <p
        style={{
          fontSize: 15,
          fontWeight: 800,
          color: 'var(--text)',
          margin: 0,
          marginBottom: 6,
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-2)',
          margin: 0,
          marginBottom: 14,
          maxWidth: 320,
          lineHeight: 1.45,
        }}
      >
        {description}
      </p>
      <Link
        href={`/upgrade?from=${encodeURIComponent(feature)}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 20px',
          borderRadius: 10,
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 800,
          textDecoration: 'none',
          boxShadow: '0 4px 12px var(--accent-shadow)',
        }}
      >
        <Sparkles size={14} />
        Ver planos
      </Link>
    </div>
  );
}
