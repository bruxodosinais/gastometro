'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import './landing.css';

type Mode = 'mensal' | 'anual';

const PLAN_DATA: Record<Mode, {
  title: string;
  price: string;
  per: string;
  sub: string;
  ctaLabel: string;
  ctaHref: string;
}> = {
  mensal: {
    title: 'Mensal',
    price: 'R$ 19,90',
    per: '/mês',
    sub: 'Cobrança recorrente • Cancele quando quiser',
    ctaLabel: 'Assinar Pro Mensal',
    ctaHref: 'https://pay.kiwify.com.br/4FBgOAj?utm_source=landing&utm_medium=web&utm_campaign=upgrade',
  },
  anual: {
    title: 'Anual',
    price: 'R$ 147,00',
    per: '/ano',
    sub: 'Equivale a R$ 12,25/mês • Economize 38%',
    ctaLabel: 'Assinar Pro Anual',
    ctaHref: 'https://pay.kiwify.com.br/b8zdPQ6?utm_source=landing&utm_medium=web&utm_campaign=upgrade',
  },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: 'Preciso de cartão de crédito pra testar?',
    a: 'Não. O plano Free é gratuito para sempre, sem pedir cartão. Você cria a conta com email e já começa a usar.',
  },
  {
    q: 'Funciona pra quem nunca se organizou?',
    a: 'É exatamente pra isso. O app foi feito pra quem sempre quis se organizar mas nunca conseguiu manter. Sem termos técnicos, sem planilha, sem julgamento.',
  },
  {
    q: 'Meus dados ficam seguros?',
    a: 'Sim. Todos os dados são armazenados com criptografia e nunca são compartilhados com terceiros. Você é dono das suas informações.',
  },
  {
    q: 'Posso cancelar quando quiser?',
    a: 'Sim, sem fidelidade e sem burocracia. Cancela direto pelo app e continua com o plano Free pra sempre.',
  },
  {
    q: 'Qual a diferença pra outros apps?',
    a: 'Gamificação real com Missão de Poupança, GastoBot com IA, alertas inteligentes e dados confiáveis — funcionalidades pensadas pra quem quer se organizar de verdade.',
  },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('anual');
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

  const togMensalRef = useRef<HTMLButtonElement>(null);
  const togAnualRef = useRef<HTMLButtonElement>(null);
  const toggleWrapRef = useRef<HTMLDivElement>(null);

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
    // Já visível no load → revela imediatamente.
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

    // Fallback: se algo ainda não revelou em 1.2s, força.
    const fallback = window.setTimeout(() => {
      els.forEach((el) => el.classList.add('in'));
    }, 1200);

    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  // Posicionamento do pill do toggle de pricing.
  // useLayoutEffect pra evitar flash na primeira renderização e em mudanças.
  useLayoutEffect(() => {
    function reposition() {
      const activeBtn = mode === 'mensal' ? togMensalRef.current : togAnualRef.current;
      const parent = toggleWrapRef.current;
      if (!activeBtn || !parent) return;
      const r = activeBtn.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      setPill({ left: r.left - p.left, width: r.width });
    }
    reposition();
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [mode]);

  const plan = PLAN_DATA[mode];

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
          <nav className="nav-links" aria-label="Seções">
            <a href="#solucao">Como funciona</a>
            <a href="#diferencial">Missão</a>
            <a href="#pricing">Planos</a>
            <a href="#faq">FAQ</a>
          </nav>
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
            <Link
              href="/comecar"
              className="btn btn-primary"
              style={{ padding: '11px 18px', fontSize: 14, borderRadius: 10 }}
            >
              Começar grátis
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
            <span className="eyebrow"><span className="dot" /> Feito para você se organizar</span>
            <h1 className="headline">
              Seu dinheiro finalmente organizado. Sem planilha. Sem culpa. <em>Com missão.</em>
            </h1>
            <p className="sub">
              O app de finanças pessoais que transforma guardar dinheiro em uma conquista — com desafios, badges e metas que dão vontade de cumprir.
            </p>
            <div className="hero-cta">
              <Link href="/comecar" className="btn btn-primary lg">
                Comece grátis — sem cartão de crédito
              </Link>
              <span className="small"><a href="#solucao">Ver como funciona ↓</a></span>
            </div>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 12, marginBottom: 0 }}>
              Já tem conta?{' '}
              <Link href="/auth/login" style={{ color: '#5B5BD6', fontWeight: 600 }}>
                Entrar
              </Link>
            </p>
            <div className="hero-trust">
              <span><span className="check">✓</span> Grátis pra sempre</span>
              <span><span className="check">✓</span> Sem cartão</span>
              <span><span className="check">✓</span> Dados criptografados</span>
            </div>
            <div className="hero-trust">
              <span><span className="check">✓</span> Funciona offline</span>
              <span><span className="check">✓</span> Sem sync bancário — zero risco de duplicata</span>
            </div>
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

      {/* ============== PROBLEMA ============== */}
      <section id="problema">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="sec-eyebrow">Sem julgamento</span>
            <h2 style={{ marginLeft: 'auto', marginRight: 'auto' }}>Você já tentou se organizar antes.</h2>
            <p className="sec-sub">A gente sabe. E sabe também por que não rolou.</p>
          </div>
          <div className="problems reveal">
            <div className="problem">Planilha que você abandona na segunda semana</div>
            <div className="problem">App que parece trabalho, não solução</div>
            <div className="problem">Fim do mês sem entender pra onde foi o dinheiro</div>
            <div className="problem">Meta de poupança que nunca sai do papel</div>
          </div>
        </div>
      </section>

      {/* ============== SOLUÇÃO ============== */}
      <section id="solucao" style={{ background: 'linear-gradient(180deg,transparent,#FFFFFF 30%, #FFFFFF 70%, transparent)' }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="sec-eyebrow">A solução</span>
            <h2 style={{ marginLeft: 'auto', marginRight: 'auto' }}>O TôOrganizado resolve isso de um jeito diferente.</h2>
            <p className="sec-sub">Três coisas que mudam tudo no dia-a-dia.</p>
          </div>
          <div className="solutions reveal">
            <article className="solution">
              <span className="num">01 · Lançar</span>
              <h3>30 segundos pra registrar qualquer gasto</h3>
              <div className="solution-stack">
                <div className="phone" aria-hidden="true">
                  <div className="phone-screen">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/lancar.png" alt="Tela de lançar" />
                  </div>
                </div>
              </div>
            </article>
            <article className="solution">
              <span className="num">02 · Recorrentes</span>
              <h3>Todas as suas contas fixas no mesmo lugar</h3>
              <div className="solution-stack">
                <div className="phone" aria-hidden="true">
                  <div className="phone-screen">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/recorrentes.png" alt="Tela de recorrentes" />
                  </div>
                </div>
              </div>
            </article>
            <article className="solution">
              <span className="num">03 · Home</span>
              <h3>Visão clara do mês — entrou, saiu, sobrou</h3>
              <div className="solution-stack">
                <div className="phone" aria-hidden="true">
                  <div className="phone-screen">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/home.png" alt="Tela inicial" />
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ============== DIFERENCIAL ============== */}
      <section id="diferencial">
        <div className="wrap">
          <div className="feature-block reveal">
            <div className="feature-grid">
              <div>
                <span className="sec-eyebrow">O diferencial</span>
                <h2>Isso aqui é diferente.</h2>
                <p className="sec-sub">O único app de finanças que te dá vontade de abrir todo dia.</p>
                <ul className="diff-list">
                  <li><span className="star">✦</span><div><b>Missões de poupança criadas por IA</b><small>Desafios personalizados pro seu mês</small></div></li>
                  <li><span className="star">✦</span><div><b>Streak de dias consecutivos</b><small>Igual seu app de idioma, mas pra dinheiro</small></div></li>
                  <li><span className="star">✦</span><div><b>Badges de conquista desbloqueáveis</b><small>Cada meta atingida vira troféu</small></div></li>
                  <li><span className="star">✦</span><div><b>Card compartilhável no Insta e Whats</b><small>Pra mostrar a evolução pros amigos</small></div></li>
                  <li><span className="star">✦</span><div><b>GastoBot — assistente financeiro 24h</b><small>Tira dúvida, sugere corte, ajuda no mês</small></div></li>
                </ul>
                <div className="feature-cta">
                  <Link href="/comecar" className="btn btn-ghost-white">Quero testar grátis</Link>
                </div>
              </div>
              <div className="feature-phones" aria-hidden="true">
                <div className="phone p1">
                  <div className="phone-screen">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/gastobot.png" alt="GastoBot" />
                  </div>
                </div>
                <div className="phone p2">
                  <div className="phone-screen">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/card-compartilhavel.png" alt="Card compartilhável" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============== APP TRABALHA POR VOCÊ ============== */}
      <section id="alertas" data-screen-label="App trabalha por você">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="sec-eyebrow">Sempre ativo</span>
            <h2>O app trabalha por você.</h2>
            <p className="sec-sub">Enquanto você vive, o TôOrganizado monitora, alerta e resume.</p>
          </div>
          <div className="alertas-grid reveal">
            <div className="alerta-card">
              <div className="alerta-icon">🔔</div>
              <h3>Alertas inteligentes</h3>
              <p>Orçamento estourado, conta vencida, cobrança duplicada — você é avisado antes de virar problema.</p>
            </div>
            <div className="alerta-card pro">
              <span className="pro-badge">PRO</span>
              <div className="alerta-icon">📧</div>
              <h3>Relatório semanal por e-mail</h3>
              <p>Todo domingo, um resumo do seu mês: o que entrou, saiu, onde estourou e o progresso da sua missão. Sem abrir o app.</p>
            </div>
            <div className="alerta-card">
              <div className="alerta-icon">📊</div>
              <h3>Insights automáticos</h3>
              <p>O app identifica anomalias de gasto, projeta como você vai fechar o mês e mostra tendências por categoria — sem você calcular nada.</p>
            </div>
            <div className="alerta-card">
              <div className="alerta-icon">📱</div>
              <h3>Instale como app, use offline</h3>
              <p>Adicione à tela inicial do celular e acesse mesmo sem internet. Seus dados ficam em cache — o app funciona onde você estiver.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============== COMO FUNCIONA ============== */}
      <section id="como-funciona">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="sec-eyebrow">Como funciona</span>
            <h2 style={{ marginLeft: 'auto', marginRight: 'auto' }}>Começa em 2 minutos.</h2>
            <p className="sec-sub">Sem onboarding chato. Sem questionário interminável.</p>
          </div>
          <div className="steps reveal">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Crie sua conta grátis</h3>
              <p>Sem cartão, sem burocracia. Email e senha, só isso.</p>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <h3>Cadastre seus gastos e recorrentes</h3>
              <p>Em menos de 5 minutos você já tem a visão do mês.</p>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <h3>Ative sua primeira Missão</h3>
              <p>E veja o hábito se formar — uma conquista por vez.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============== PROVA SOCIAL ============== */}
      <section id="prova" style={{ background: '#FFFFFF' }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="sec-eyebrow">Quem já está dentro</span>
            <h2 style={{ marginLeft: 'auto', marginRight: 'auto' }}>Quem já está organizando.</h2>
            <p className="sec-sub">Primeiros usuários · comunidade em crescimento</p>
          </div>
          <div className="testimonials reveal">
            <article className="testimonial">
              <div className="quote-marks">&ldquo;</div>
              <p>Eu tentei umas três planilhas, dois apps caros e nada grudava. Aqui em 3 semanas já tenho R$ 800 guardados — porque virou desafio, não obrigação.</p>
              <div className="who">
                <div className="avatar a1">CF</div>
                <div>
                  <b>Carla F.</b>
                  <span>São Paulo, SP · Analista financeira</span>
                </div>
              </div>
            </article>
            <article className="testimonial">
              <div className="quote-marks">&ldquo;</div>
              <p>O GastoBot me mostrou que eu gastava R$ 380/mês em delivery sem perceber. Cortei pela metade e jogo o resto na missão. Surreal.</p>
              <div className="who">
                <div className="avatar a2">RM</div>
                <div>
                  <b>Rafael M.</b>
                  <span>Belo Horizonte, MG · Analista júnior</span>
                </div>
              </div>
            </article>
            <article className="testimonial">
              <div className="quote-marks">&ldquo;</div>
              <p>Primeira vez que termino o mês sabendo pra onde foi cada real. E o card de conquista no Insta? Meus amigos pediram o link.</p>
              <div className="who">
                <div className="avatar a3">JS</div>
                <div>
                  <b>Juliana S.</b>
                  <span>Recife, PE · Designer</span>
                </div>
              </div>
            </article>
          </div>
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

      {/* ============== PRICING ============== */}
      <section id="pricing">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="sec-eyebrow">Planos</span>
            <h2 style={{ marginLeft: 'auto', marginRight: 'auto' }}>Escolha como quer começar.</h2>
            <p className="sec-sub">Free pra sempre. Pro quando fizer sentido.</p>
          </div>

          <div className="toggle-wrap reveal">
            <div className="toggle" role="tablist" ref={toggleWrapRef}>
              <span
                className="pill"
                style={pill ? { left: pill.left, width: pill.width } : undefined}
              />
              <button
                ref={togMensalRef}
                className={mode === 'mensal' ? 'active' : ''}
                role="tab"
                aria-selected={mode === 'mensal'}
                onClick={() => setMode('mensal')}
              >
                Mensal
              </button>
              <button
                ref={togAnualRef}
                className={mode === 'anual' ? 'active' : ''}
                role="tab"
                aria-selected={mode === 'anual'}
                onClick={() => setMode('anual')}
              >
                Anual <span className="save">−38%</span>
              </button>
            </div>
          </div>

          <div className="plans reveal">
            <article className="plan">
              <span className="plan-name">Free</span>
              <h3>Pra começar</h3>
              <div className="price"><span className="num">R$ 0</span><span className="per">/sempre</span></div>
              <p className="price-sub" style={{ color: 'var(--ink-2)' }}>Sem prazo, sem pegadinha.</p>
              <ul>
                <li><span className="ic no">✕</span>20 lançamentos por mês</li>
                <li><span className="ic no">✕</span>5 recorrentes</li>
                <li><span className="ic no">✕</span>1 consulta no GastoBot/mês</li>
                <li><span className="ic no">✕</span>Sem metas financeiras</li>
                <li><span className="ic no">✕</span>Sem controle de patrimônio</li>
                <li><span className="ic no">✕</span>Sem cartões de crédito</li>
              </ul>
              <div className="plan-cta">
                <Link href="/comecar" className="btn btn-outline" style={{ width: '100%' }}>
                  Começar grátis
                </Link>
              </div>
            </article>

            <article className="plan pro">
              <span className="badge-pop">★ Mais popular</span>
              <span className="plan-name">Pro</span>
              <h3>{plan.title}</h3>
              <div className="price">
                <span className="num">{plan.price}</span>
                <span className="per">{plan.per}</span>
              </div>
              <p className="price-sub">{plan.sub}</p>
              <ul>
                <li><span className="ic yes">✓</span>Lançamentos ilimitados</li>
                <li><span className="ic yes">✓</span>Recorrentes ilimitados</li>
                <li><span className="ic yes">✓</span>Missão de Poupança com IA e badges</li>
                <li><span className="ic yes">✓</span>Relatório semanal por e-mail</li>
                <li><span className="ic yes">✓</span>GastoBot ilimitado</li>
                <li><span className="ic yes">✓</span>Metas e patrimônio</li>
                <li><span className="ic yes">✓</span>Cartões de crédito com fatura</li>
                <li><span className="ic yes">✓</span>Suporte prioritário</li>
              </ul>
              <div className="footer-note">✦ Primeiros usuários com preço de fundador</div>
              <div className="plan-cta">
                <a href={plan.ctaHref} className="btn btn-ghost-white" style={{ width: '100%' }}>
                  {plan.ctaLabel}
                </a>
              </div>
            </article>
          </div>

          <p className="pricing-bottom reveal"><b>Menos que um café por semana.</b> Cancele quando quiser.</p>
        </div>
      </section>

      {/* ============== FAQ ============== */}
      <section id="faq" style={{ background: '#FFFFFF' }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="sec-eyebrow">Perguntas</span>
            <h2 style={{ marginLeft: 'auto', marginRight: 'auto' }}>Dúvidas rápidas.</h2>
          </div>
          <div className="faq reveal" id="faqList">
            {FAQS.map((item, i) => (
              <FaqItem
                key={item.q}
                question={item.q}
                answer={item.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq((cur) => (cur === i ? null : i))}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ============== CTA FINAL ============== */}
      <section>
        <div className="wrap">
          <div className="final-cta reveal">
            <span className="sec-eyebrow">Sua missão começa aqui</span>
            <h2 style={{ fontSize: 'clamp(32px,4.4vw,52px)', margin: '0 auto 18px' }}>
              Sua próxima missão começa hoje.
            </h2>
            <p className="sec-sub">Junte-se a quem já está no controle.</p>
            <div style={{ marginTop: 32 }}>
              <Link href="/comecar" className="btn btn-primary lg">
                Criar conta grátis agora
              </Link>
            </div>
            <p className="small">Sem compromisso. Sem cartão. Cancela quando quiser.</p>
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
            <Link href="/privacidade">Política de Privacidade</Link>
            <Link href="/termos">Termos de Uso</Link>
            <a href="mailto:contato@toorganizado.com.br">Contato</a>
          </div>
          <span className="made">Feito com 💜 para quem quer se organizar de verdade</span>
        </div>
      </footer>
    </div>
  );
}

function FaqItem({
  question,
  answer,
  open,
  onToggle,
}: {
  question: string;
  answer: string;
  open: boolean;
  onToggle: () => void;
}) {
  const ansRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<string>('0px');

  useEffect(() => {
    if (open && ansRef.current) {
      setMaxHeight(ansRef.current.scrollHeight + 'px');
    } else {
      setMaxHeight('0px');
    }
  }, [open]);

  return (
    <div className={`faq-item${open ? ' open' : ''}`}>
      <button className="faq-q" onClick={onToggle} aria-expanded={open}>
        {question}
        <span className="ic" aria-hidden="true" />
      </button>
      <div className="faq-a" ref={ansRef} style={{ maxHeight }}>
        <div className="faq-a-inner">{answer}</div>
      </div>
    </div>
  );
}
