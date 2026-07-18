'use client';

// Orquestrador do onboarding nativo (rota pública, exportável estático). Vive
// numa rota só como state machine: intro (carousel) → quiz (8 passos) →
// building (antecipação) → plan (PlanReady) → cadastro. Sem rotas novas →
// proxy.ts intocado. Native-only no fluxo real (o boot effect em app/page.tsx
// só manda pra cá no nativo); na web abre se digitada.
//
// Flag `to_intro_seen` (Fatia 1): NÃO é setada ao entrar no quiz nem ao concluí-
// lo. Só quando o usuário (a) toca "Já tenho conta" (login) ou (b) toca "Criar
// conta grátis" na tela "Plano pronto" (PlanReady). Assim, quem abandona antes
// desse CTA final e reabre o app revê o carousel e pode refazer o plano, em vez
// de cair direto no login num beco sem saída. As respostas vivem em memória do
// quiz até esse CTA (intro → quiz → building → plan → cadastro).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import IntroCarousel from './_components/IntroCarousel';
import Quiz from './_components/Quiz';
import Building from './_components/Building';
import PlanReady from './_components/PlanReady';
import Paywall from './_components/Paywall';
import { isNativePlatform } from '@/lib/native';
import { initRevenueCat, getOfferings, type Offerings } from '@/lib/revenuecat';
import { saveLocalPresignup, type PresignupMission } from '@/lib/onboarding/presignupMission';

function markIntroSeen() {
  try {
    localStorage.setItem('to_intro_seen', '1');
  } catch {
    /* localStorage indisponível — segue mesmo assim */
  }
}

export default function InicioPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'building' | 'plan' | 'paywall'>('intro');
  const [mission, setMission] = useState<PresignupMission | null>(null);
  const [offerings, setOfferings] = useState<Offerings | null>(null);

  // Prefetch das offerings no NATIVO (uma vez, não-bloqueante): deixa a decisão
  // "mostra paywall?" síncrona no CTA do PlanReady. Web: no-op (getOfferings→null).
  useEffect(() => {
    if (!isNativePlatform()) return;
    let alive = true;
    void initRevenueCat()
      .then(getOfferings)
      .then((o) => { if (alive) setOfferings(o); })
      .catch(() => { /* sem offerings → paywall é pulado, cadastro segue (sem dead-end) */ });
    return () => { alive = false; };
  }, []);

  // Fecho único do funil: marca intro vista, persiste a mission e vai pro cadastro.
  // Usado tanto ao SAIR do paywall (Assinar OK ou Continuar grátis) quanto quando
  // não há paywall a mostrar.
  function finishToCadastro(m: PresignupMission) {
    markIntroSeen(); // só agora → quem abandona antes revê o carousel
    saveLocalPresignup(m);
    router.push('/auth/cadastro');
  }

  if (phase === 'quiz') {
    return (
      <Quiz
        onExitToCarousel={() => setPhase('intro')}
        // Não marca intro, não salva, não navega: segura a mission em memória e
        // segue pro payoff (building → plan). markIntroSeen/save só no CTA final.
        onComplete={(m: PresignupMission) => {
          setMission(m);
          setPhase('building');
        }}
      />
    );
  }

  if (phase === 'building' && mission) {
    return <Building mission={mission} onDone={() => setPhase('plan')} />;
  }

  if (phase === 'paywall' && mission && offerings) {
    return <Paywall offerings={offerings} onDone={() => finishToCadastro(mission)} />;
  }

  if (phase === 'plan' && mission) {
    return (
      <PlanReady
        mission={mission}
        onCreateAccount={() => {
          // Nativo + offering válida → paywall; senão vai direto pro cadastro
          // (onboarding nunca trava: sem produtos, a venda é pulada).
          if (isNativePlatform() && offerings && (offerings.monthly || offerings.annual)) {
            setPhase('paywall');
          } else {
            finishToCadastro(mission);
          }
        }}
      />
    );
  }

  return (
    <IntroCarousel
      onStart={() => setPhase('quiz')} // entra no quiz SEM marcar intro vista
      onLogin={() => {
        markIntroSeen();
        router.push('/auth/login');
      }}
    />
  );
}
