'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BigCurrencyInput,
  numberToStr,
  strToNumber,
} from '../onboarding/_components/CurrencyInput';
import { saveLocalPresignup, type PresignupMission } from '@/lib/onboarding/presignupMission';

type Template = {
  id: string;
  emoji: string;
  name: string;
  targetAmount: number;
  months: number;
};

// Subconjunto dos templates de /missao/nova (os mais comuns) + "Outra".
const TEMPLATES: Template[] = [
  { id: 'reserva', emoji: '🏠', name: 'Reserva de emergência', targetAmount: 10_000, months: 24 },
  { id: 'viagem', emoji: '🏖️', name: 'Viagem dos sonhos', targetAmount: 5_000, months: 12 },
  { id: 'carro', emoji: '🚗', name: 'Entrada do carro', targetAmount: 15_000, months: 36 },
  { id: 'outra', emoji: '✨', name: '', targetAmount: 0, months: 12 },
];

const TOTAL = 5;

export default function ComecarPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState(''); // string p/ BigCurrencyInput
  const [aporte, setAporte] = useState('');

  const targetNum = strToNumber(target);
  const aporteNum = strToNumber(aporte);
  const months = aporteNum > 0 ? Math.max(1, Math.min(60, Math.ceil(targetNum / aporteNum))) : 0;

  function pickTemplate(t: Template) {
    setTemplateId(t.id);
    if (t.id === 'outra') {
      setName('');
      setTarget('');
      setAporte('');
    } else {
      setName(t.name);
      setTarget(numberToStr(t.targetAmount));
      setAporte(numberToStr(Math.round(t.targetAmount / t.months)));
    }
  }

  function finish() {
    const m: PresignupMission = {
      templateId: templateId ?? 'outra',
      name: name.trim() || 'Minha missão',
      targetAmount: targetNum,
      monthlyTarget: aporteNum,
      months,
      committedAt: new Date().toISOString(),
    };
    saveLocalPresignup(m);
    router.push('/auth/cadastro');
  }

  const step1Ok = templateId != null && (templateId !== 'outra' || name.trim().length > 0);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: '28px 24px',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {/* progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i < step ? 'var(--accent)' : 'var(--border-2)',
                transition: 'background 250ms',
              }}
            />
          ))}
        </div>

        {/* ── Passo 1: missão ─────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: '0 0 4px' }}>
              Qual é sua missão financeira?
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 18px' }}>
              Escolha um objetivo pra começar a guardar.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {TEMPLATES.map((t) => {
                const active = templateId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pickTemplate(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 'var(--r-sm)',
                      border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent-bg)' : 'var(--bg)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 22 }} aria-hidden="true">{t.emoji}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
                      {t.id === 'outra' ? 'Outra' : t.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {templateId === 'outra' && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dê um nome pra sua missão"
                maxLength={80}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--r-sm)',
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              />
            )}
            <PrimaryBtn disabled={!step1Ok} onClick={() => setStep(2)}>
              Continuar
            </PrimaryBtn>
          </>
        )}

        {/* ── Passo 2: valor alvo ─────────────────────────────────────── */}
        {step === 2 && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: '0 0 4px' }}>
              Quanto você quer juntar?
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 8px' }}>
              {name || 'Sua missão'}
            </p>
            <BigCurrencyInput value={target} onChange={setTarget} />
            <NavRow onBack={() => setStep(1)}>
              <PrimaryBtn disabled={!(targetNum > 0)} onClick={() => setStep(3)}>
                Continuar
              </PrimaryBtn>
            </NavRow>
          </>
        )}

        {/* ── Passo 3: aporte + projeção ──────────────────────────────── */}
        {step === 3 && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: '0 0 4px' }}>
              Quanto dá pra guardar por mês?
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 8px' }}>
              Seu aporte mensal pra chegar lá.
            </p>
            <BigCurrencyInput value={aporte} onChange={setAporte} />
            {months > 0 && (
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--accent-bg)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.4,
                  textAlign: 'center',
                }}
              >
                🚀 Guardando {formatBRL(aporteNum)}/mês, você chega lá em{' '}
                <strong style={{ color: 'var(--accent)' }}>
                  {months} {months === 1 ? 'mês' : 'meses'}
                </strong>
                .
              </div>
            )}
            <NavRow onBack={() => setStep(2)}>
              <PrimaryBtn disabled={!(aporteNum > 0)} onClick={() => setStep(4)}>
                Continuar
              </PrimaryBtn>
            </NavRow>
          </>
        )}

        {/* ── Passo 4: compromisso ────────────────────────────────────── */}
        {step === 4 && (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', margin: '0 0 8px' }}>
              Comprometa-se com 1 ação por dia
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Pra bater <strong>{name || 'sua missão'}</strong>, o segredo é constância: registrar,
              acompanhar e guardar — um pouquinho todo dia.
            </p>
            <NavRow onBack={() => setStep(3)}>
              <PrimaryBtn onClick={() => setStep(5)}>Eu me comprometo 🙌</PrimaryBtn>
            </NavRow>
          </>
        )}

        {/* ── Passo 5: Dia 1 ──────────────────────────────────────────── */}
        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🔥</div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: '0 0 6px' }}>
              Dia 1 ✅
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: '0 0 22px', lineHeight: 1.5 }}>
              Sua ofensiva começou! Crie sua conta pra salvar a missão{' '}
              <strong>{name || 'sua missão'}</strong> e manter o ritmo.
            </p>
            <PrimaryBtn onClick={finish}>Criar minha conta grátis →</PrimaryBtn>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 16 }}>
              Já tem conta?{' '}
              <Link href="/auth/login" style={{ color: 'var(--accent)', fontWeight: 700 }}>
                Entrar
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function PrimaryBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        marginTop: 24,
        padding: '14px 18px',
        borderRadius: 'var(--r-sm)',
        border: 'none',
        background: disabled ? 'var(--border-2)' : 'var(--accent)',
        color: disabled ? 'var(--text-3)' : '#fff',
        fontSize: 15,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function NavRow({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div>
      {children}
      <button
        type="button"
        onClick={onBack}
        style={{
          width: '100%',
          marginTop: 10,
          padding: '8px',
          background: 'none',
          border: 'none',
          color: 'var(--text-3)',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Voltar
      </button>
    </div>
  );
}
