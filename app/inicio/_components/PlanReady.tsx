'use client';

// Payoff do funil nativo (Fatia 3): FUNDE recap personalizado + vitrine de
// features + o ÚNICO CTA "Criar conta" do fluxo. Sem rota nova; o orquestrador
// (app/inicio/page.tsx) segura a mission em memória e navega no CTA.
//
// COMPLIANCE (Apple 3.1.1): no nativo NÃO há preço, plano pago, "teste grátis",
// botão de compra nem prompt de avaliação/push. A vitrine lista TUDO como
// "Incluído" (✓). O bloco de preço/pagamento é o <PricingSlot/> isolado, que só
// renderiza na web ({!isNativePlatform()}). No v1 ele é um stub (null).

import { useEffect } from 'react';
import { trackOnboarding } from '@/lib/onboarding/track';
import type { PresignupMission } from '@/lib/onboarding/presignupMission';
import { monthsToTarget, formatMonths } from '@/lib/onboarding/reframe';
import { isNativePlatform } from '@/lib/native';
import { ACCENT, INK, INK_2, FONT, formatBRL, QuizShell, PrimaryBtn } from './ui';

// Vitrine — TODAS incluídas (sem trava Free-vs-Pro). Copy rebranded (TôOrganizado).
const FEATURES: string[] = [
  'Lançamentos ilimitados',
  'Missão de Poupança com IA, metas e badges',
  'Streaks, níveis e desafios diários',
  'Assistente financeiro ilimitado',
  'Relatório semanal por e-mail',
  'Cartões de crédito e controle de patrimônio',
  'Insights e alertas personalizados',
];

// Linha motivacional opcional amarrada à dor do Q5 (chaveada pelo label gravado).
const PAIN_LINES: Record<string, string> = {
  'Não sei pra onde vai meu dinheiro': 'Agora você vai enxergar cada real — sem sustos no fim do mês.',
  'Não consigo manter constância': 'Um passo por dia. A constância a gente constrói junto. 💪',
  'Sempre aparece um imprevisto': 'Sua reserva vai te blindar dos imprevistos.',
  'Sinto que sobra pouco pra guardar': 'No seu ritmo, o pouco de hoje vira muito amanhã.',
};

// Bloco de preço/pagamento — ISOLADO e SÓ web. Stub no v1 (nada renderizado).
// Quando houver checkout web, o conteúdo entra AQUI, sem tocar no resto da tela.
function PricingSlot() {
  return null;
}

export default function PlanReady({
  mission,
  onCreateAccount,
}: {
  mission: PresignupMission;
  onCreateAccount: () => void;
}) {
  const months = monthsToTarget(mission.targetAmount, mission.monthlyTarget);
  const painLine = mission.painPoint ? PAIN_LINES[mission.painPoint] : undefined;

  // Telemetria: chegou no payoff. Montagem, fire-and-forget.
  useEffect(() => {
    trackOnboarding('plan_ready');
  }, []);

  return (
    <QuizShell
      footer={
        <PrimaryBtn
          onClick={() => {
            trackOnboarding('plan_cta', 'complete');
            onCreateAccount();
          }}
        >
          Criar conta grátis
        </PrimaryBtn>
      }
    >
      <h1 style={{ font: `800 24px/1.25 ${FONT}`, color: INK, margin: '4px 0 0', letterSpacing: '-.4px' }}>
        {mission.userFirstName ? `${mission.userFirstName}, seu plano está pronto 🎉` : 'Seu plano está pronto 🎉'}
      </h1>
      {painLine && (
        <p style={{ font: `500 15px/1.5 ${FONT}`, color: INK_2, margin: '8px 0 0' }}>{painLine}</p>
      )}

      {/* Recap — bate com a projeção do Q6 (monthsToTarget, não mission.months). */}
      <div
        style={{
          marginTop: 18,
          padding: '18px 18px 6px',
          borderRadius: 16,
          background: '#fff',
          border: '1px solid #ECECEC',
        }}
      >
        <div style={{ font: `800 17px ${FONT}`, color: INK, marginBottom: 4 }}>{mission.name}</div>
        <RecapRow label="Meta" value={formatBRL(mission.targetAmount)} />
        <RecapRow
          label="Por mês"
          value={
            formatBRL(mission.monthlyTarget) +
            (mission.savingsPercent ? ` • ${mission.savingsPercent}% do seu salário` : '')
          }
        />
        {months > 0 && <RecapRow label="Prazo" value={formatMonths(months)} />}
      </div>

      {/* Vitrine de features — todas como "Incluído". */}
      <div style={{ font: `800 13px ${FONT}`, color: INK_2, letterSpacing: '.3px', margin: '24px 0 10px' }}>
        TUDO INCLUÍDO NA SUA CONTA
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {FEATURES.map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                borderRadius: '50%',
                background: '#EDEDFC',
                color: ACCENT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: `900 12px ${FONT}`,
                marginTop: 1,
              }}
            >
              ✓
            </span>
            <span style={{ font: `600 15px/1.35 ${FONT}`, color: INK }}>{f}</span>
          </div>
        ))}
      </div>

      {/* Preço/pagamento: isolado e SÓ web (compliance Apple 3.1.1). */}
      {!isNativePlatform() && <PricingSlot />}
    </QuizShell>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderTop: '1px solid #F0F0F0',
      }}
    >
      <span style={{ font: `600 14px ${FONT}`, color: INK_2, flexShrink: 0 }}>{label}</span>
      <span style={{ font: `800 15px ${FONT}`, color: INK, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
