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

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import IntroCarousel from './_components/IntroCarousel';
import Quiz from './_components/Quiz';
import Building from './_components/Building';
import PlanReady from './_components/PlanReady';
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
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'building' | 'plan'>('intro');
  const [mission, setMission] = useState<PresignupMission | null>(null);

  // Fecho único do funil: marca intro vista, persiste a mission e vai pro cadastro.
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

  if (phase === 'plan' && mission) {
    return (
      <PlanReady
        mission={mission}
        onCreateAccount={() => finishToCadastro(mission)}
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
