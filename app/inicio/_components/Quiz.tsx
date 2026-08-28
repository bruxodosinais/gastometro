'use client';

// Quiz nativo de 8 passos (Fatia 2). State machine numa rota só (sem rotas
// novas → proxy intocado). Ordem: 1 Nome⭐ · 2 Missão · 3 Salário⭐ · 4 Valor
// · 5 Slider%⭐ · 6 Dor · 7 Projeção · 8 Pacto. (⭐ = passo conversacional com
// coach.) Respostas vivem em memória até o Pacto (Q8), que monta o
// PresignupMission estendido e devolve via onComplete (o orquestrador salva +
// navega pro cadastro).

import { useEffect, useState } from 'react';
import { trackOnboarding } from '@/lib/onboarding/track';
import { BigCurrencyInput, numberToStr, strToNumber } from '../../onboarding/_components/CurrencyInput';
import type { PresignupMission } from '@/lib/onboarding/presignupMission';
import { hourlyRate, minutesOfWork, projectAccumulated, monthsToTarget, formatMonths } from '@/lib/onboarding/reframe';
import {
  ACCENT,
  INK,
  INK_2,
  FONT,
  formatBRL,
  QuizShell,
  QuizHeader,
  StepTitle,
  Coach,
  OptionCard,
  PrimaryBtn,
  GhostBtn,
} from './ui';

const TOTAL = 8;
const COFFEE = 8; // R$ de referência do reframe (café)

// Telemetria: passo interno → chave do funil (lib/onboarding/steps.ts). Chave
// fora do allowlist = 400 na rota e evento perdido em silêncio, então mexer
// aqui é mexer lá também.
const TRACK_KEY: Record<number, string> = {
  1: 'quiz_nome',
  2: 'quiz_missao',
  3: 'quiz_renda',
  4: 'quiz_meta',
  5: 'quiz_aporte',
  6: 'quiz_dor',
  7: 'quiz_projecao',
  8: 'quiz_pacto',
};

type Template = { id: string; emoji: string; name: string; targetAmount: number; months: number };

// Mesmos templates do /comecar (subconjunto de /missao/nova) + "Outra".
const TEMPLATES: Template[] = [
  { id: 'reserva', emoji: '🏠', name: 'Reserva de emergência', targetAmount: 10_000, months: 24 },
  { id: 'viagem', emoji: '🏖️', name: 'Viagem dos sonhos', targetAmount: 5_000, months: 12 },
  { id: 'carro', emoji: '🚗', name: 'Entrada do carro', targetAmount: 15_000, months: 36 },
  { id: 'outra', emoji: '✨', name: '', targetAmount: 0, months: 12 },
];

const PAINS: { id: string; emoji: string; label: string }[] = [
  { id: 'sem_visao', emoji: '🤷', label: 'Não sei pra onde vai meu dinheiro' },
  { id: 'sem_constancia', emoji: '📉', label: 'Não consigo manter constância' },
  { id: 'imprevistos', emoji: '⚡', label: 'Sempre aparece um imprevisto' },
  { id: 'sobra_pouco', emoji: '😮‍💨', label: 'Sinto que sobra pouco pra guardar' },
];

const MIN_PCT = 5;
const MAX_PCT = 30;

function percentLabel(p: number): string {
  if (p < 10) return 'Conservador';
  if (p <= 20) return 'Recomendado';
  return 'Acelerado';
}

export default function Quiz({
  onExitToCarousel,
  onComplete,
}: {
  onExitToCarousel: () => void;
  onComplete: (mission: PresignupMission) => void;
}) {
  const [step, setStep] = useState(1);

  // View do passo na MONTAGEM dele (não no clique do anterior): quem clica e a
  // tela quebra no meio não chegou no passo. O tracker deduplica por carga de
  // página, então voltar e avançar de novo não conta duas vezes.
  useEffect(() => {
    const key = TRACK_KEY[step];
    if (key) trackOnboarding(key);
  }, [step]);

  // Respostas
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [missionName, setMissionName] = useState('');
  const [income, setIncome] = useState('');
  const [incomeSkipped, setIncomeSkipped] = useState(false);
  const [target, setTarget] = useState('');
  const [percent, setPercent] = useState(15); // default "Recomendado"
  const [monthlyAbs, setMonthlyAbs] = useState(''); // fallback se salário pulado
  const [painPoint, setPainPoint] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');

  // Derivados
  const incomeNum = strToNumber(income);
  const targetNum = strToNumber(target);
  const monthlyTarget = incomeSkipped
    ? strToNumber(monthlyAbs)
    : Math.round((incomeNum * percent) / 100);
  // months obrigatório no presignup (coerce clampa 1–60). Derivado como no /comecar.
  const months = monthlyTarget > 0 ? Math.max(1, Math.min(60, Math.round(targetNum / monthlyTarget))) : 0;

  function next() {
    setStep((s) => Math.min(TOTAL, s + 1));
  }
  function back() {
    if (step === 1) onExitToCarousel();
    else setStep((s) => s - 1);
  }

  function pickTemplate(t: Template) {
    setTemplateId(t.id);
    if (t.id === 'outra') {
      setMissionName('');
      setTarget('');
    } else {
      setMissionName(t.name);
      setTarget(numberToStr(t.targetAmount));
    }
  }

  function skipIncome() {
    trackOnboarding('quiz_renda', 'skip');
    setIncomeSkipped(true);
    setIncome('');
    next();
  }

  // Digitar um salário válido e confirmar cancela um skip anterior (reconcilia a
  // flag pra não cair no numpad de R$ do Q5 nem descartar o salário no finish()).
  function confirmIncome() {
    setIncomeSkipped(false);
    next();
  }

  function finish() {
    trackOnboarding('quiz_pacto', 'complete');
    const mission: PresignupMission = {
      templateId: templateId ?? 'outra',
      name: missionName.trim() || 'Minha missão',
      targetAmount: targetNum,
      monthlyTarget,
      months,
      committedAt: new Date().toISOString(),
      ...(incomeSkipped
        ? { incomeSkipped: true }
        : { monthlyIncome: incomeNum, savingsPercent: percent }),
      ...(painPoint ? { painPoint } : {}),
      ...(firstName.trim() ? { userFirstName: firstName.trim() } : {}),
    };
    onComplete(mission);
  }

  // Pular dos passos 6 e 7: mesma navegação de antes (next), só com o evento.
  function skipStep() {
    const key = TRACK_KEY[step];
    if (key) trackOnboarding(key, 'skip');
    next();
  }

  const header = (
    <QuizHeader
      step={step}
      total={TOTAL}
      onBack={back}
      onSkip={step === 6 || step === 7 ? skipStep : undefined}
    />
  );

  // ── Q1 · Nome (coach) ───────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <QuizShell
        header={header}
        footer={<PrimaryBtn disabled={firstName.trim().length === 0} onClick={next}>Continuar</PrimaryBtn>}
      >
        <Coach>Antes de começar, como posso te chamar? 😊</Coach>
        <StepTitle title="Qual é o seu nome?" />
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Seu primeiro nome"
          autoComplete="given-name"
          maxLength={40}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '16px 18px',
            borderRadius: 14,
            border: '1.5px solid #E4E4ED',
            background: '#fff',
            color: INK,
            font: `800 18px ${FONT}`,
            outline: 'none',
            textAlign: 'center',
          }}
        />
      </QuizShell>
    );
  }

  // ── Q2 · Missão ────────────────────────────────────────────────────────────
  if (step === 2) {
    const ok = templateId != null && (templateId !== 'outra' || missionName.trim().length > 0);
    return (
      <QuizShell header={header} footer={<PrimaryBtn disabled={!ok} onClick={next}>Continuar</PrimaryBtn>}>
        <StepTitle title="Qual é a sua missão?" subtitle="Escolha um objetivo pra começar a guardar." />
        <div style={{ display: 'grid', gap: 10 }}>
          {TEMPLATES.map((t) => (
            <OptionCard
              key={t.id}
              emoji={t.emoji}
              label={t.id === 'outra' ? 'Outra' : t.name}
              active={templateId === t.id}
              onClick={() => pickTemplate(t)}
            />
          ))}
        </div>
        {templateId === 'outra' && (
          <input
            type="text"
            value={missionName}
            onChange={(e) => setMissionName(e.target.value)}
            placeholder="Dê um nome pra sua missão"
            maxLength={80}
            style={{
              marginTop: 12,
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              borderRadius: 14,
              border: '1.5px solid #E4E4ED',
              background: '#fff',
              color: INK,
              font: `700 15px ${FONT}`,
              outline: 'none',
            }}
          />
        )}
      </QuizShell>
    );
  }

  // ── Q3 · Salário (coach + reframe) ──────────────────────────────────────────
  if (step === 3) {
    const hr = hourlyRate(incomeNum);
    const coffeeMin = minutesOfWork(COFFEE, hr);
    return (
      <QuizShell
        header={header}
        footer={
          <>
            <PrimaryBtn disabled={!(incomeNum > 0)} onClick={confirmIncome}>Continuar</PrimaryBtn>
            <GhostBtn onClick={skipIncome}>Prefiro não dizer</GhostBtn>
          </>
        }
      >
        <Coach>Pra deixar isso real, me conta: quanto entra por mês pra você? 👀</Coach>
        <StepTitle title="Quanto você ganha por mês?" subtitle="Fica só no seu aparelho. Serve pra personalizar seu plano." />
        <BigCurrencyInput value={income} onChange={setIncome} />
        {incomeNum > 0 && hr > 0 && (
          <div
            style={{
              marginTop: 18,
              padding: '14px 16px',
              borderRadius: 14,
              background: '#EDEDFC',
              font: `700 15px/1.5 ${FONT}`,
              color: INK,
              textAlign: 'center',
            }}
          >
            Você ganha{' '}
            <strong style={{ color: ACCENT }}>R$ {hr.toFixed(2).replace('.', ',')}/h</strong>.
            <br />
            Um café de {formatBRL(COFFEE)} custa <strong style={{ color: ACCENT }}>~{coffeeMin} min</strong> do seu trabalho. ☕
          </div>
        )}
      </QuizShell>
    );
  }

  // ── Q4 · Valor alvo ─────────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <QuizShell
        header={header}
        footer={<PrimaryBtn disabled={!(targetNum > 0)} onClick={next}>Continuar</PrimaryBtn>}
      >
        <StepTitle title="Quanto você quer juntar?" subtitle={missionName || 'Sua missão'} />
        <BigCurrencyInput value={target} onChange={setTarget} />
      </QuizShell>
    );
  }

  // ── Q5 · Slider % (coach) — ou fallback R$ se salário pulado ─────────────────
  if (step === 5) {
    if (incomeSkipped) {
      const absNum = strToNumber(monthlyAbs);
      return (
        <QuizShell
          header={header}
          footer={<PrimaryBtn disabled={!(absNum > 0)} onClick={next}>Continuar</PrimaryBtn>}
        >
          <Coach>Sem problema não ter falado o salário. Quanto dá pra guardar por mês? 💪</Coach>
          <StepTitle title="Quanto dá pra guardar por mês?" subtitle="Seu aporte mensal pra chegar na meta." />
          <BigCurrencyInput value={monthlyAbs} onChange={setMonthlyAbs} />
        </QuizShell>
      );
    }
    return (
      <QuizShell header={header} footer={<PrimaryBtn disabled={!(monthlyTarget > 0)} onClick={next}>Continuar</PrimaryBtn>}>
        <Coach>Quanto do seu salário dá pra separar todo mês? Arrasta aí. 👇</Coach>
        <StepTitle title="Quanto guardar por mês?" />
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <div style={{ font: `900 40px ${FONT}`, color: ACCENT }}>{percent}%</div>
          <div style={{ font: `800 15px ${FONT}`, color: INK_2, marginTop: 2 }}>{percentLabel(percent)}</div>
          <div style={{ font: `700 16px ${FONT}`, color: INK, marginTop: 10 }}>
            = <strong style={{ color: ACCENT }}>{formatBRL(monthlyTarget)}</strong>/mês
          </div>
        </div>
        <input
          type="range"
          min={MIN_PCT}
          max={MAX_PCT}
          step={1}
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          style={{ width: '100%', marginTop: 22, accentColor: ACCENT }}
          aria-label="Porcentagem do salário a guardar"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 12px ${FONT}`, color: INK_2, marginTop: 4 }}>
          <span>{MIN_PCT}%</span>
          <span>{MAX_PCT}%</span>
        </div>
      </QuizShell>
    );
  }

  // ── Q6 · Dor (coach + Pular) ────────────────────────────────────────────────
  if (step === 6) {
    return (
      <QuizShell
        header={header}
        footer={<PrimaryBtn disabled={!painPoint} onClick={next}>Continuar</PrimaryBtn>}
      >
        <Coach>O que mais te atrapalha hoje? Sem julgamento — é pra te ajudar. 🤝</Coach>
        <StepTitle title="O que mais te impede de guardar?" />
        <div style={{ display: 'grid', gap: 10 }}>
          {PAINS.map((p) => (
            <OptionCard
              key={p.id}
              emoji={p.emoji}
              label={p.label}
              active={painPoint === p.label}
              onClick={() => setPainPoint(p.label)}
            />
          ))}
        </div>
      </QuizShell>
    );
  }

  // ── Q7 · Projeção (Pular) ───────────────────────────────────────────────────
  if (step === 7) {
    const proj = [1, 5, 10].map((y) => ({ y, v: projectAccumulated(monthlyTarget, y) }));
    const m = monthsToTarget(targetNum, monthlyTarget);
    return (
      <QuizShell header={header} footer={<PrimaryBtn onClick={next}>Continuar</PrimaryBtn>}>
        <StepTitle title="Olha onde isso te leva 🚀" subtitle={`Guardando ${formatBRL(monthlyTarget)} por mês:`} />
        <div style={{ display: 'grid', gap: 10 }}>
          {proj.map(({ y, v }) => (
            <div
              key={y}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '15px 16px',
                borderRadius: 14,
                background: '#fff',
                border: '1px solid #ECECEC',
              }}
            >
              <span style={{ font: `700 15px ${FONT}`, color: INK_2 }}>
                Em {y} {y === 1 ? 'ano' : 'anos'}
              </span>
              <span style={{ font: `900 18px ${FONT}`, color: ACCENT }}>{formatBRL(v)}</span>
            </div>
          ))}
        </div>
        {m > 0 && (
          <p style={{ font: `700 15px/1.5 ${FONT}`, color: INK, textAlign: 'center', marginTop: 18 }}>
            No seu ritmo, você atinge <strong>{missionName || 'sua missão'}</strong> em{' '}
            <strong style={{ color: ACCENT }}>{formatMonths(m)}</strong>.
          </p>
        )}
      </QuizShell>
    );
  }

  // ── Q8 · Pacto (último passo → fecha o quiz) ────────────────────────────────
  return (
    <QuizShell header={header} footer={<PrimaryBtn onClick={finish}>Eu me comprometo 🙌</PrimaryBtn>}>
      <div style={{ textAlign: 'center', paddingTop: 12 }}>
        <div style={{ fontSize: 56, marginBottom: 12 }} aria-hidden="true">🤝</div>
        <StepTitle title="Combinado?" />
        <p style={{ font: `600 16px/1.6 ${FONT}`, color: INK_2, margin: 0 }}>
          O segredo é constância: registrar, acompanhar e guardar um pouquinho{' '}
          <strong style={{ color: INK }}>todo dia</strong>. Topa se comprometer com 1 ação por dia pra
          bater <strong style={{ color: INK }}>{missionName || 'sua missão'}</strong>?
        </p>
      </div>
    </QuizShell>
  );
}
