'use client';

// Orquestrador do onboarding nativo (rota pública, exportável estático). Vive
// numa rota só como state machine: fase 'intro' (carousel) → 'quiz' (8 passos).
// Sem rotas novas → proxy.ts intocado. Native-only no fluxo real (o boot effect
// em app/page.tsx só manda pra cá no nativo); na web abre se digitada.
//
// Flag `to_intro_seen` (Fatia 1): NÃO é mais setada ao entrar no quiz. Só quando
// o usuário (a) toca "Já tenho conta" ou (b) conclui o quiz (Q8 → cadastro).
// Assim, quem abandona o quiz e reabre o app revê o carousel e pode refazer o
// plano, em vez de cair direto no login num beco sem saída (respostas são
// efêmeras, vivem em memória até o Q8).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import IntroCarousel from './_components/IntroCarousel';
import Quiz from './_components/Quiz';
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
  const [phase, setPhase] = useState<'intro' | 'quiz'>('intro');

  if (phase === 'quiz') {
    return (
      <Quiz
        onExitToCarousel={() => setPhase('intro')}
        onComplete={(mission: PresignupMission) => {
          markIntroSeen(); // quiz concluído → não repetir o carousel no relaunch
          saveLocalPresignup(mission);
          router.push('/auth/cadastro');
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
