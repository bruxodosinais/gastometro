'use client';

import { AlertTriangle, BarChart3, Bell } from 'lucide-react';
import { PrimaryButton, SkipLink } from './OnboardingNav';

// Tela de PRÉ-permissão (step 8, fora da contagem de passos). No iOS o diálogo
// do sistema aparece UMA vez na vida do app — negou, só nos Ajustes do iPhone.
// Por isso aqui só se explica o valor: quem dispara o pedido é o toque em
// "Ativar notificações", nunca a montagem da tela. Componente puro: nenhuma
// chamada ao hook de push mora aqui.

type OnboardingNotificacoesProps = {
  onEnable: () => void;
  onSkip: () => void;
  loading: boolean;
  /** true depois de uma tentativa recusada — a tela vira só saída. */
  denied: boolean;
};

// Mesmos rótulos do Perfil (app/(app)/perfil/page.tsx), pra pessoa reconhecer
// os toggles depois.
const ITEMS = [
  { Icon: Bell, label: 'Conta vencendo amanhã' },
  { Icon: AlertTriangle, label: 'Limite de categoria estourado' },
  { Icon: BarChart3, label: 'Resumo semanal' },
];

export function OnboardingNotificacoes({
  onEnable,
  onSkip,
  loading,
  denied,
}: OnboardingNotificacoesProps) {
  return (
    <div className="flex flex-col items-center text-center gap-0">
      <div
        className="w-16 h-16 rounded-full border-2 flex items-center justify-center mb-4"
        style={{
          background: 'var(--accent-bg)',
          borderColor: 'var(--accent)',
          color: 'var(--accent)',
          animation: 'fade-in-scale 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        <Bell size={28} />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-1">
        Quer que eu te avise?
      </h2>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        Agora que suas contas e limites estão cadastrados, posso te avisar antes
        de virar problema.
      </p>

      <div className="w-full bg-gray-50 rounded-xl px-4 py-4 mb-6 space-y-3 text-left">
        {ITEMS.map(({ Icon, label }) => (
          <div key={label} className="flex items-center gap-2.5 text-sm text-gray-700">
            <Icon size={16} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {denied ? (
        <>
          <p className="text-sm text-gray-400 mb-4">
            Sem problema — dá pra ativar depois no Perfil.
          </p>
          <PrimaryButton onClick={onSkip}>Continuar</PrimaryButton>
        </>
      ) : (
        <>
          <PrimaryButton onClick={onEnable} loading={loading} loadingLabel="Ativando...">
            Ativar notificações
          </PrimaryButton>
          <SkipLink label="Agora não" onSkip={onSkip} />
        </>
      )}
    </div>
  );
}
