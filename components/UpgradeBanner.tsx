'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';

interface UpgradeBannerProps {
  message: string;
  feature: string;
  variant?: 'inline' | 'fullpage';
}

export default function UpgradeBanner({ message, feature, variant = 'inline' }: UpgradeBannerProps) {
  if (variant === 'fullpage') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '70vh',
          padding: 32,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'var(--accent-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            boxShadow: '0 8px 24px rgba(91,91,214,0.15)',
          }}
        >
          <Sparkles size={36} color="var(--accent)" />
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: 'var(--text)',
            margin: 0,
            marginBottom: 8,
          }}
        >
          Recurso Pro
        </h1>
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-2)',
            margin: 0,
            marginBottom: 24,
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
        <Link
          href={`/upgrade?from=${encodeURIComponent(feature)}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 28px',
            borderRadius: 12,
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 800,
            textDecoration: 'none',
            boxShadow: '0 4px 12px rgba(91,91,214,0.30)',
          }}
        >
          <Sparkles size={16} />
          Ver planos
        </Link>
        <p
          style={{
            marginTop: 18,
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-3)',
          }}
        >
          A partir de R$ 19,90/mês • Cancele quando quiser
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        borderRadius: 'var(--r-sm)',
        background: 'var(--accent-bg)',
        border: '1.5px solid rgba(91,91,214,0.25)',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
        }}
      >
        <Lock size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--text)',
            margin: 0,
            marginBottom: 2,
          }}
        >
          Limite atingido
        </p>
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-2)',
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {message}
        </p>
      </div>
      <Link
        href={`/upgrade?from=${encodeURIComponent(feature)}`}
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: 8,
          background: 'var(--accent)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 800,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Assinar Pro
      </Link>
    </div>
  );
}
