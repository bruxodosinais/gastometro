'use client';

import { useEffect, useState, type ReactNode, type CSSProperties } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isNativePlatform } from '@/lib/native';
import { createClient } from '@/lib/supabase/client';
import './landing.css';

// Link da App Store: entra quando o app for APROVADO (env na Vercel). HOJE vazio
// → o botão vira "Em breve" (desabilitado). NUNCA inventar URL. Google Play fica
// "Em breve" por ora (Android depois).
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? '';
const PLAY_STORE_URL = '';

const FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: '🎯', title: 'Missão de Poupança', desc: 'Metas com desafios criados por IA — guardar dinheiro vira conquista, não obrigação.' },
  { icon: '🔥', title: 'Streaks e níveis', desc: 'Constância que gruda: dias seguidos, níveis e badges pra você não largar no meio.' },
  { icon: '🤖', title: 'GastôBot com IA', desc: 'Assistente financeiro 24h: tira dúvida, sugere corte e te ajuda a fechar o mês.' },
  { icon: '📊', title: 'Tudo num lugar', desc: 'Gastos, recorrentes, cartões, metas e patrimônio — a visão do mês numa tela só.' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  // ── Boot nativo (first-run) ──────────────────────────────────────────────
  // No app NATIVO, "/" não mostra esta landing: decidimos o destino no cold
  // start e mascaramos enquanto isso. Na WEB este effect é NO-OP
  // (isNativePlatform()===false) → a landing de download renderiza normal.
  const router = useRouter();
  const [booting, setBooting] = useState(false);
  useEffect(() => {
    if (!isNativePlatform()) return; // web → landing de download
    setBooting(true); // mascara já: não pisca a landing no nativo
    // IAP (RevenueCat) fora deste build FREE — o app nativo é grátis (aprovação
    // Apple enquanto o acordo de apps pagos não sai). Restaurar depois via
    // commits c12bcbe (SDK) + c40bf59 (paywall). Ver app/api/webhooks/revenuecat.
    let cancelled = false;

    (async () => {
      // getUser() é chamada de rede no cold start. Se falhar (offline/erro) ou
      // demorar, caímos no ramo "sem sessão" — nunca deixamos o splash travado.
      let user: { id?: string; user_metadata?: { onboarding_completed?: boolean } } | null = null;
      try {
        const timeout = new Promise<{ data: { user: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { user: null } }), 8000),
        );
        const result = await Promise.race([createClient().auth.getUser(), timeout]);
        user = result.data?.user ?? null;
      } catch {
        user = null; // rede indisponível → trata como sem sessão
      }
      if (cancelled) return;

      if (user) {
        const onboardingDone = user.user_metadata?.onboarding_completed === true;
        router.replace(onboardingDone ? '/app' : '/onboarding');
        return;
      }

      // Sem sessão (ou falha de rede): flag de intro já vista → login direto.
      let introSeen = false;
      try {
        introSeen = localStorage.getItem('to_intro_seen') === '1';
      } catch {
        /* localStorage indisponível → trata como não-vista */
      }
      router.replace(introSeen ? '/auth/login' : '/inicio');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Nav scroll state
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    document.addEventListener('scroll', onScroll, { passive: true });
    return () => document.removeEventListener('scroll', onScroll);
  }, []);

  // Reveal-on-scroll com IntersectionObserver
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.landing-root .reveal'));
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight - 40) el.classList.add('in');
    });

    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => {
      if (!el.classList.contains('in')) io.observe(el);
    });

    const fallback = window.setTimeout(() => {
      els.forEach((el) => el.classList.add('in'));
    }, 1200);

    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  // Máscara nativa: enquanto o boot decide o destino, não mostramos a landing —
  // placeholder mínimo da marca (sem flash branco). Web nunca entra aqui.
  if (booting) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#F7F7F5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: '#5B5BD6',
          fontFamily: 'Nunito, system-ui, -apple-system, sans-serif',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: '#5B5BD6',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" />
          </svg>
        </span>
        <span style={{ font: '800 20px Nunito, sans-serif', color: '#1A1A1A' }}>
          Tô<b style={{ color: '#5B5BD6' }}>Organizado</b>
        </span>
      </div>
    );
  }

  return (
    <div className="landing-root">
      {/* ============== NAV ============== */}
      <header className={`nav${scrolled ? ' scrolled' : ''}`} id="nav">
        <div className="wrap nav-inner">
          <a href="#top" className="brand" aria-label="TôOrganizado">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
            <span className="brand-text">Tô<b>Organizado</b></span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              href="/auth/login"
              className="btn"
              style={{
                padding: '11px 18px',
                fontSize: 14,
                borderRadius: 10,
                border: '1.5px solid #5B5BD6',
                color: '#5B5BD6',
                background: 'transparent',
              }}
            >
              Entrar
            </Link>
          </div>
        </div>
      </header>

      {/* ============== HERO ============== */}
      <section className="hero" id="top">
        <div className="hero-blob" aria-hidden="true" />
        <div className="hero-blob b2" aria-hidden="true" />
        <div className="wrap hero-inner">
          <div className="reveal">
            <span className="eyebrow"><span className="dot" /> Finanças que viram hábito</span>
            <h1 className="headline">
              Seu dinheiro organizado, <em>direto do seu bolso.</em>
            </h1>
            <p className="sub">
              O app que transforma organizar as finanças em hábito — com missões de poupança, streaks e um assistente com IA. Baixe e comece em 2 minutos.
            </p>
            <div style={{ marginTop: 28 }}>
              <StoreButtons />
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 16, marginBottom: 0, fontWeight: 600 }}>
              Grátis pra baixar · sem cartão · Pro opcional dentro do app
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 10, marginBottom: 0 }}>
              Já tem conta?{' '}
              <Link href="/auth/login" style={{ color: '#5B5BD6', fontWeight: 700 }}>
                Entrar
              </Link>
            </p>
          </div>
          <div className="hero-phones reveal">
            <div className="phone p1" aria-hidden="true">
              <div className="phone-screen">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/home.png" alt="Tela inicial do TôOrganizado" />
              </div>
            </div>
            <div className="phone p2">
              <div className="phone-screen">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/missao.png" alt="Missão de Poupança" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== FEATURES ============== */}
      <section id="recursos">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="sec-eyebrow">Por que o TôOrganizado</span>
            <h2 style={{ marginLeft: 'auto', marginRight: 'auto' }}>
              Organizar dinheiro sem parecer obrigação.
            </h2>
            <p className="sec-sub">Quatro coisas que fazem você voltar todo dia.</p>
          </div>
          <div className="alertas-grid reveal">
            {FEATURES.map((f) => (
              <div key={f.title} className="alerta-card">
                <div className="alerta-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============== PROVA SOCIAL ============== */}
      <section style={{ background: '#FFFFFF' }}>
        <div className="wrap">
          <p className="users-count reveal">
            <span className="stack" aria-hidden="true">
              <span className="a" style={{ background: 'linear-gradient(135deg,#FF8A65,#FF4757)' }} />
              <span className="a" style={{ background: 'linear-gradient(135deg,#5B5BD6,#7A5BD6)' }} />
              <span className="a" style={{ background: 'linear-gradient(135deg,#00C37A,#00A664)' }} />
              <span className="a" style={{ background: 'linear-gradient(135deg,#FFB800,#FF8A00)' }} />
            </span>
            <b>+ de 1.200 pessoas</b> já organizando as finanças.
          </p>
        </div>
      </section>

      {/* ============== CTA FINAL ============== */}
      <section>
        <div className="wrap">
          <div className="final-cta reveal">
            <span className="sec-eyebrow">Baixe agora</span>
            <h2 style={{ fontSize: 'clamp(32px,4.4vw,52px)', margin: '0 auto 18px' }}>
              Sua organização começa no próximo toque.
            </h2>
            <p className="sec-sub">Grátis pra baixar. Pro opcional dentro do app.</p>
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
              <StoreButtons center />
            </div>
          </div>
        </div>
      </section>

      {/* ============== FOOTER ============== */}
      <footer className="footer">
        <div className="wrap foot">
          <a href="#top" className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </span>
            <span className="brand-text">Tô<b>Organizado</b></span>
          </a>
          <div className="foot-links">
            <Link href="/auth/login">Entrar</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/termos">Termos</Link>
            <Link href="/suporte">Suporte</Link>
            <Link href="/excluir-conta">Excluir conta</Link>
          </div>
          <span className="made">Feito com 💜 para quem quer se organizar de verdade</span>
        </div>
      </footer>
    </div>
  );
}

// ── Botões de download das lojas ────────────────────────────────────────────
function StoreButtons({ center }: { center?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        justifyContent: center ? 'center' : 'flex-start',
      }}
    >
      <StoreBadge store="apple" url={APP_STORE_URL} />
      <StoreBadge store="google" url={PLAY_STORE_URL} />
    </div>
  );
}

function StoreBadge({ store, url }: { store: 'apple' | 'google'; url: string }) {
  const available = url.length > 0;
  const label = store === 'apple' ? 'App Store' : 'Google Play';
  const topLine = available ? 'Baixar na' : 'Em breve na';

  const inner: ReactNode = (
    <>
      <span aria-hidden="true" style={{ display: 'flex', flexShrink: 0 }}>
        {store === 'apple' ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.365 1.43c0 1.14-.417 2.2-1.11 2.98-.84.95-2.2 1.68-3.32 1.6-.14-1.1.42-2.28 1.06-3 .72-.82 2.02-1.44 3.12-1.5.02.31.02.62.02.92zM20.5 17.02c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.53-4.12 3.54-1.54.02-1.93-1-4.02-.99-2.09.01-2.52 1.01-4.06.99-1.73-.01-3.05-1.77-4.04-3.34C-.03 16.9-.33 12.02 1.4 9.4c1.23-1.86 3.17-2.95 5-2.95 1.86 0 3.03 1.02 4.57 1.02 1.49 0 2.4-1.02 4.57-1.02 1.63 0 3.36.89 4.59 2.42-4.03 2.21-3.38 7.97.37 8.15z" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#EA4335" d="M3.6 2.2C3.3 2.5 3.1 3 3.1 3.6v16.8c0 .6.2 1.1.5 1.4l9-9.9-9-9.7z" opacity="0" />
            <path fill="currentColor" d="M4 2.1c-.3.16-.5.45-.6.83v18.14c.1.38.3.67.6.83l9.9-9.9L4 2.1zm11.1 6.9L5.9 3.7l7.9 7.9 2.3-2.3-1-.3zM17.9 10.4l-2.3-1.3-2.5 2.5 2.5 2.5 2.4-1.3c.7-.4.7-1.7 0-2.4zM5.9 20.4l9.2-5.3-2.3-2.3-6.9 7.6z" />
          </svg>
        )}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, textAlign: 'left' }}>
        <small style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>{topLine}</small>
        <b style={{ fontSize: 16, fontWeight: 800 }}>{label}</b>
      </span>
    </>
  );

  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 18px',
    borderRadius: 12,
    background: '#1A1A1A',
    color: '#fff',
    textDecoration: 'none',
    border: 'none',
  };

  if (available) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={baseStyle}>
        {inner}
      </a>
    );
  }
  return (
    <span
      aria-disabled="true"
      title="Em breve"
      style={{ ...baseStyle, opacity: 0.5, cursor: 'default' }}
    >
      {inner}
    </span>
  );
}
