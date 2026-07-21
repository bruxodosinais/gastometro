'use client';

// Paywall do onboarding nativo (build 5 / IAP). Entra como fase 'paywall' ENTRE
// 'plan' (PlanReady) e o cadastro, SÓ no nativo. Preços VÊM do getOfferings
// (priceString localizado da loja) — nada hardcodado. A compra é ANÔNIMA (antes
// do cadastro); o alias compra→conta acontece no logIn pós-cadastro
// (app/auth/confirmar-codigo). O orquestrador (app/inicio/page.tsx) só entra
// aqui quando há offering válida → esta tela assume ao menos 1 pacote.
//
// NÃO flipa isPro. O backend (webhook RevenueCat) segue fonte de verdade do Pro;
// esta tela só dispara a compra via StoreKit.

import { useState, type CSSProperties } from 'react';
import { purchasePackage, restorePurchases, type Offerings } from '@/lib/revenuecat';
import {
  ACCENT, INK, INK_2, INK_3, FONT, formatBRL, QuizShell, PrimaryBtn, GhostBtn,
} from './ui';

// Verde reservado a dinheiro/economia e confirmação (checks); índigo nas ações.
const GREEN = '#1E9E6A';
const GREEN_BG = '#E7F6EF';

type Cycle = 'annual' | 'monthly';

const PRO_FEATURES: string[] = [
  'Tudo do plano grátis, sem limites',
  'Assistente financeiro ilimitado',
  'Análises, previsões e relatório semanal',
  'Missão de Poupança completa (IA, metas e badges)',
  'Cartões, patrimônio e alertas personalizados',
];

const FREE_LIMITS: string[] = [
  'Assistente com limite diário',
  'Sem análises e previsões avançadas',
  'Recursos da Missão limitados',
];

export default function Paywall({
  offerings,
  onDone,
  zIndex,
}: {
  offerings: Offerings;
  onDone: () => void;
  // Só quem renderiza o paywall dentro do chrome do app passa (ver QuizShell).
  zIndex?: number;
}) {
  const monthly = offerings.monthly;
  const annual = offerings.annual;
  const hasBoth = !!monthly && !!annual;

  const [cycle, setCycle] = useState<Cycle>(annual ? 'annual' : 'monthly');
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  // Preços numéricos da loja (podem ser null se o produto vier incompleto).
  const monthlyNum = monthly?.pkg.product.price ?? null;
  const annualNum = annual?.pkg.product.price ?? null;

  const annualPerMonth = annualNum != null ? annualNum / 12 : null;
  const savings =
    monthlyNum != null && annualNum != null ? monthlyNum * 12 - annualNum : null;
  const freeMonths =
    savings != null && monthlyNum ? Math.round(savings / monthlyNum) : 0;
  const discountPct =
    monthlyNum != null && annualNum != null && monthlyNum > 0
      ? Math.round((1 - annualNum / (monthlyNum * 12)) * 100)
      : 0;

  const selected = cycle === 'annual' ? annual : monthly;
  const renewalPrice = cycle === 'annual' ? annual?.priceString : monthly?.priceString;
  const renewalPeriod = cycle === 'annual' ? 'por ano' : 'por mês';

  async function handleSubscribe() {
    if (!selected || purchasing) return;
    setError('');
    setNote('');
    setPurchasing(true);
    try {
      const { cancelled } = await purchasePackage(selected.pkg);
      if (cancelled) {
        setPurchasing(false); // usuário desistiu na folha da loja — fica no paywall
        return;
      }
      onDone(); // sucesso: o webhook confirma o Pro; segue pro cadastro
    } catch {
      setError('Não foi possível concluir a compra. Tente de novo.');
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    if (purchasing) return;
    setError('');
    setNote('');
    try {
      const { proActive } = await restorePurchases();
      if (proActive) {
        onDone(); // já tem Pro → segue; o logIn pós-cadastro aliasa à conta
      } else {
        setNote('Nenhuma compra encontrada pra restaurar.');
      }
    } catch {
      setNote('Não foi possível restaurar agora. Tente mais tarde.');
    }
  }

  return (
    <QuizShell
      zIndex={zIndex}
      footer={
        <div>
          {error && (
            <p style={{ font: `700 13px ${FONT}`, color: '#D14343', textAlign: 'center', margin: '0 0 10px' }}>
              {error}
            </p>
          )}
          <PrimaryBtn onClick={handleSubscribe} disabled={purchasing || !selected}>
            {purchasing ? 'Processando…' : 'Assinar Pro'}
          </PrimaryBtn>
          <GhostBtn onClick={onDone}>Continuar no grátis</GhostBtn>

          <p style={{ font: `500 11px/1.5 ${FONT}`, color: INK_3, textAlign: 'center', margin: '10px 0 0' }}>
            {renewalPrice
              ? `A assinatura renova automaticamente por ${renewalPrice} ${renewalPeriod} até você cancelar. Cancele quando quiser nas configurações da App Store.`
              : 'Cancele quando quiser nas configurações da App Store.'}
          </p>
          {note && (
            <p style={{ font: `600 12px ${FONT}`, color: INK_2, textAlign: 'center', margin: '8px 0 0' }}>
              {note}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <button type="button" onClick={handleRestore} style={LINK_BTN}>Restaurar compra</button>
            <span style={{ color: INK_3 }}>·</span>
            <a href="/termos" target="_blank" rel="noopener noreferrer" style={LINK_A}>Termos</a>
            <span style={{ color: INK_3 }}>·</span>
            <a href="/privacidade" target="_blank" rel="noopener noreferrer" style={LINK_A}>Privacidade</a>
          </div>
        </div>
      }
    >
      {/* Header */}
      <span
        style={{
          display: 'inline-block',
          padding: '3px 10px',
          borderRadius: 999,
          background: '#EDEDFC',
          color: ACCENT,
          font: `900 11px ${FONT}`,
          letterSpacing: '.4px',
        }}
      >
        PLANO PRO
      </span>
      <h1 style={{ font: `800 25px/1.2 ${FONT}`, color: INK, margin: '12px 0 0', letterSpacing: '-.4px' }}>
        Tudo liberado. Sem limites.
      </h1>
      <p style={{ font: `500 15px/1.5 ${FONT}`, color: INK_2, margin: '8px 0 0' }}>
        Desbloqueie o TôOrganizado completo e leve sua organização financeira ao máximo.
      </p>

      {/* Toggle Mensal/Anual (só quando existem os dois ciclos) */}
      {hasBoth && (
        <div style={{ display: 'flex', gap: 8, background: '#EAEAEA', borderRadius: 14, padding: 4, marginTop: 20 }}>
          <CycleTab label="Mensal" active={cycle === 'monthly'} onClick={() => setCycle('monthly')} />
          <CycleTab
            label="Anual"
            active={cycle === 'annual'}
            onClick={() => setCycle('annual')}
            badge={discountPct > 0 ? `−${discountPct}%` : undefined}
          />
        </div>
      )}

      {/* Card Pro em destaque */}
      <div
        style={{
          marginTop: 16,
          border: `2px solid ${ACCENT}`,
          borderRadius: 18,
          background: '#fff',
          padding: 18,
          boxShadow: '0 10px 24px rgba(91,91,214,.14)',
        }}
      >
        {cycle === 'annual' ? (
          <>
            {monthly && (
              <div style={{ font: `700 14px ${FONT}`, color: INK_3, textDecoration: 'line-through' }}>
                {monthly.priceString}/mês
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
              <span style={{ font: `900 34px ${FONT}`, color: INK, letterSpacing: '-1px' }}>
                {annualPerMonth != null ? formatBRL(annualPerMonth) : annual?.priceString}
              </span>
              <span style={{ font: `700 15px ${FONT}`, color: INK_2 }}>/mês</span>
            </div>
            {savings != null && savings > 0 && (
              <div
                style={{
                  display: 'inline-block',
                  marginTop: 10,
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: GREEN_BG,
                  color: GREEN,
                  font: `800 12px ${FONT}`,
                }}
              >
                Economize {formatBRL(savings)}
                {freeMonths > 0 ? ` · ${freeMonths} ${freeMonths === 1 ? 'mês' : 'meses'} grátis` : ''}
              </div>
            )}
            <div style={{ font: `500 12px/1.5 ${FONT}`, color: INK_2, marginTop: 10 }}>
              {annual?.priceString} cobrados uma vez por ano · cancele quando quiser
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ font: `900 34px ${FONT}`, color: INK, letterSpacing: '-1px' }}>
                {monthly?.priceString}
              </span>
              <span style={{ font: `700 15px ${FONT}`, color: INK_2 }}>/mês</span>
            </div>
            <div style={{ font: `500 12px/1.5 ${FONT}`, color: INK_2, marginTop: 10 }}>
              Cobrado mensalmente · cancele quando quiser
            </div>
          </>
        )}

        <div style={{ height: 1, background: '#F0F0F0', margin: '16px 0' }} />

        <div style={{ display: 'grid', gap: 9 }}>
          {PRO_FEATURES.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: GREEN_BG,
                  color: GREEN,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: `900 11px ${FONT}`,
                  marginTop: 1,
                }}
              >
                ✓
              </span>
              <span style={{ font: `600 14px/1.35 ${FONT}`, color: INK }}>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Card Free */}
      <div style={{ marginTop: 12, border: '1px solid #E4E4ED', borderRadius: 18, background: '#fff', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ font: `800 15px ${FONT}`, color: INK }}>Grátis</span>
          <span style={{ font: `800 15px ${FONT}`, color: INK_2 }}>{formatBRL(0)}</span>
        </div>
        <div style={{ display: 'grid', gap: 7, marginTop: 10 }}>
          {FREE_LIMITS.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  borderRadius: '50%',
                  background: '#F0F0F0',
                  color: INK_3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  font: `900 12px ${FONT}`,
                  marginTop: 1,
                }}
              >
                –
              </span>
              <span style={{ font: `600 14px/1.35 ${FONT}`, color: INK_2 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </QuizShell>
  );
}

const LINK_BTN: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: INK_2,
  font: `700 12px ${FONT}`,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
};

const LINK_A: CSSProperties = { color: INK_2, font: `700 12px ${FONT}`, textDecoration: 'underline' };

function CycleTab({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        height: 40,
        border: 'none',
        borderRadius: 11,
        background: active ? '#fff' : 'transparent',
        color: active ? INK : INK_2,
        font: `800 14px ${FONT}`,
        cursor: 'pointer',
        boxShadow: active ? '0 2px 6px rgba(0,0,0,.10)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {label}
      {badge && (
        <span style={{ font: `900 10px ${FONT}`, color: GREEN, background: GREEN_BG, borderRadius: 999, padding: '1px 6px' }}>
          {badge}
        </span>
      )}
    </button>
  );
}
