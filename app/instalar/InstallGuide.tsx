'use client';

import { useEffect, useState } from 'react';

type Platform = 'android' | 'ios-safari' | 'ios-other' | 'desktop' | 'unknown';

function detect(): Platform {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  if (isAndroid) return 'android';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ relata desktop UA, mas tem touch
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (isIOS) {
    const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isSafari ? 'ios-safari' : 'ios-other';
  }
  return 'desktop';
}

const ANDROID_STEPS = [
  { icon: '🌐', text: 'Abra o site no Chrome' },
  { icon: '⋮', text: 'Toque nos 3 pontinhos no canto superior direito' },
  { icon: '➕', text: 'Toque em "Adicionar à tela inicial"' },
  { icon: '✅', text: 'Confirme e pronto!' },
];

const IOS_STEPS = [
  { icon: '🧭', text: 'Abra o site no Safari (não no Chrome)' },
  { icon: '⬆️', text: 'Toque no botão de compartilhar na barra inferior' },
  { icon: '➕', text: 'Role para baixo e toque em "Adicionar à Tela de Início"' },
  { icon: '✅', text: 'Toque em "Adicionar" e pronto!' },
];

function StepCard({ index, icon, text }: { index: number; icon: string; text: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-3"
      style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
    >
      <div
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
        style={{ background: '#5B5BD6' }}
        aria-hidden
      >
        {index}
      </div>
      <div
        className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
        style={{ background: '#F7F7F5', border: '1px solid #E5E7EB' }}
        aria-hidden
      >
        {icon}
      </div>
      <p className="text-sm leading-snug" style={{ color: '#1A1A1A' }}>
        {text}
      </p>
    </div>
  );
}

function Section({
  title,
  steps,
}: {
  title: string;
  steps: { icon: string; text: string }[];
}) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-bold mb-3" style={{ color: '#1A1A1A' }}>
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <StepCard key={i} index={i + 1} icon={s.icon} text={s.text} />
        ))}
      </div>
    </section>
  );
}

export default function InstallGuide() {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    setPlatform(detect());
  }, []);

  if (platform === 'unknown') {
    // SSR / antes do useEffect: mostra tudo (evita flash de conteúdo errado).
    return (
      <>
        <Section title="No Android" steps={ANDROID_STEPS} />
        <Section title="No iPhone ou iPad" steps={IOS_STEPS} />
      </>
    );
  }

  if (platform === 'ios-other') {
    return (
      <div
        className="mt-8 rounded-xl p-4 text-sm"
        style={{
          background: '#FFF8E6',
          border: '1px solid #FFE8A3',
          color: '#996B00',
        }}
      >
        <p className="font-semibold">Abra esta página no Safari para instalar.</p>
        <p className="mt-1 leading-relaxed" style={{ color: '#7A5500' }}>
          O Chrome e outros navegadores no iPhone/iPad não conseguem adicionar
          apps à tela inicial. Copie o link e cole na barra do Safari.
        </p>
        <Section title="No iPhone ou iPad (Safari)" steps={IOS_STEPS} />
      </div>
    );
  }

  if (platform === 'android') return <Section title="No Android" steps={ANDROID_STEPS} />;
  if (platform === 'ios-safari') return <Section title="No iPhone ou iPad" steps={IOS_STEPS} />;

  return (
    <>
      <Section title="No Android" steps={ANDROID_STEPS} />
      <Section title="No iPhone ou iPad" steps={IOS_STEPS} />
    </>
  );
}
