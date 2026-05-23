'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { formatCurrency, getMonthKey } from '@/lib/calculations';
import { getMonthlyPlan } from '@/lib/storage';
import { createMission, getMission } from '@/lib/storage/missions';
import { getCachedUser } from '@/lib/dataCache';
import { useSubscription } from '@/hooks/useSubscription';
import { ToastContainer, useToast } from '@/components/Toast';
import ConfettiAnimation from '../../_components/missao/ConfettiAnimation';

type MonthsOption = 3 | 6 | 12 | 18 | 24;
const MONTHS_OPTIONS: MonthsOption[] = [3, 6, 12, 18, 24];
const AMOUNT_PILLS = [5_000, 10_000, 20_000, 50_000];
const CUSTOM_MONTHS_MIN = 1;
const CUSTOM_MONTHS_MAX = 60;

// easeOutCubic — começa rápido, suaviza no fim. Usado para subir do 0 ao
// alvo quando uma pill de valor é tocada e para tweenar o monthly target
// ao trocar de prazo.
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function useTween(active: number, durationMs: number) {
  const [display, setDisplay] = useState(active);
  const fromRef = useRef(active);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const from = fromRef.current;
    startRef.current = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startRef.current) / durationMs);
      const v = from + (active - from) * easeOutCubic(t);
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else {
        fromRef.current = active;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, durationMs]);

  return display;
}

function monthLabel(d: Date): string {
  const m = d.toLocaleDateString('pt-BR', { month: 'long' });
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function pctColor(pct: number): { bar: string; tone: 'ok' | 'warn' | 'bad' } {
  if (pct <= 20) return { bar: '#00C37A', tone: 'ok' };
  if (pct <= 35) return { bar: '#FFB800', tone: 'warn' };
  return { bar: '#FF4757', tone: 'bad' };
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Wizard ──────────────────────────────────────────────────────────────

function NovaMissaoWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPro, loading: subLoading } = useSubscription();
  const { toasts, addToast, removeToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(() => searchParams.get('nome') ?? '');
  const [targetAmount, setTargetAmount] = useState(0);
  const [pillSeed, setPillSeed] = useState(0); // dispara tween ao tocar pill
  const [valueFocused, setValueFocused] = useState(false);
  const [months, setMonths] = useState<number | null>(null);
  const [customMonthsMode, setCustomMonthsMode] = useState(false);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [aiChallengesEnabled, setAiChallengesEnabled] = useState(true);

  const [expectedIncome, setExpectedIncome] = useState<number | null>(null);
  const [existingMission, setExistingMission] = useState<boolean>(false);
  const [bootChecking, setBootChecking] = useState(true);

  const [confettiOn, setConfettiOn] = useState(false);
  const [creating, setCreating] = useState(false);

  // Tween do display do valor alvo, disparado por click em pill. O input
  // manual mexe direto em targetAmount sem tween (digitar enquanto anima
  // ficaria errático).
  const tweenedTarget = useTween(targetAmount, 600);
  const useTweenedTarget = pillSeed > 0;

  // Tween do mensal ao trocar prazo (300ms). Quando months=null mostra 0.
  const monthlyTarget = months ? targetAmount / months : 0;
  const tweenedMonthly = useTween(monthlyTarget, 300);

  // Bootstrap: pega usuário, expected_income do mês corrente e missão ativa.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const user = await getCachedUser();
      if (!user) { if (!cancelled) setBootChecking(false); return; }
      const [plan, mission] = await Promise.all([
        getMonthlyPlan(getMonthKey(new Date())),
        getMission(user.id),
      ]);
      if (cancelled) return;
      if (plan?.expectedIncome && plan.expectedIncome > 0) {
        setExpectedIncome(Number(plan.expectedIncome));
      }
      if (mission) setExistingMission(true);
      setBootChecking(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Free users não podem ativar IA: força OFF assim que detectado.
  useEffect(() => {
    if (!subLoading && !isPro) setAiChallengesEnabled(false);
  }, [subLoading, isPro]);

  const pickPillAmount = useCallback((amount: number) => {
    setTargetAmount(amount);
    setPillSeed((s) => s + 1);
  }, []);

  const canContinueStep1 = name.trim().length > 0 && targetAmount > 0;
  const canContinueStep2 = months !== null;

  // ─── Submit ────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async () => {
    if (creating || existingMission || !months) return;
    const user = await getCachedUser();
    if (!user) {
      addToast('Você precisa estar logado para criar uma missão.', 'error');
      return;
    }

    setCreating(true);

    const start = new Date();
    const target = new Date(start);
    target.setMonth(target.getMonth() + months);

    try {
      await createMission(user.id, {
        name: name.trim(),
        targetAmount,
        months,
        monthlyTarget: targetAmount / months,
        startDate: toIsoDate(start),
        targetDate: toIsoDate(target),
        remindersEnabled,
        aiChallengesEnabled: isPro && aiChallengesEnabled,
      });
    } catch (e) {
      console.error('[missao/nova] createMission falhou:', e);
      addToast(
        e instanceof Error ? e.message : 'Erro ao criar missão. Tente novamente.',
        'error',
      );
      setCreating(false);
      return;
    }

    // Confetti é cosmético; o redirect não pode depender dele. Em prod, se o
    // setTimeout fosse engolido (tab em background, throttling), a tela ficava
    // travada no "Começar minha missão" mesmo após o INSERT bem-sucedido.
    setConfettiOn(true);
    router.replace('/missao/dashboard');
  }, [creating, existingMission, months, name, targetAmount, remindersEnabled, aiChallengesEnabled, isPro, router, addToast]);

  if (bootChecking) {
    return (
      <main
        className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 flex min-h-screen w-full items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <Loader2 className="animate-spin" color="var(--accent)" />
      </main>
    );
  }

  return (
    <main
      className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 w-full"
      style={{ background: 'var(--bg)', minHeight: '100vh' }}
    >
      {confettiOn && <ConfettiAnimation />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <header className="flex items-center gap-3 pt-5 pb-3">
        <button
          onClick={() => (step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : router.push('/missao'))}
          aria-label="Voltar"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--surface)', boxShadow: 'var(--hbtn-shadow)' }}
        >
          <ArrowLeft size={20} color="var(--text)" />
        </button>
        <h1
          className="flex-1 text-center text-[15px] font-extrabold"
          style={{ color: 'var(--text)' }}
        >
          Nova missão
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              aria-current={step === n ? 'step' : undefined}
              style={{
                width: step === n ? 22 : 8,
                height: 8,
                borderRadius: 999,
                background: step >= n ? 'var(--accent)' : 'var(--border)',
                transition: 'all 200ms ease',
              }}
            />
          ))}
        </div>
      </header>

      {step === 1 && (
        <Step1
          name={name}
          setName={setName}
          targetAmount={targetAmount}
          setTargetAmount={(v) => { setTargetAmount(v); /* zera tween de pill */ }}
          displayValue={useTweenedTarget ? tweenedTarget : targetAmount}
          valueFocused={valueFocused}
          setValueFocused={setValueFocused}
          onPickPill={pickPillAmount}
          canContinue={canContinueStep1}
          onContinue={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2
          targetAmount={targetAmount}
          months={months}
          setMonths={(m) => { setMonths(m); setCustomMonthsMode(false); }}
          customMode={customMonthsMode}
          enterCustomMode={() => { setCustomMonthsMode(true); setMonths(null); }}
          setCustomMonths={(m) => setMonths(m)}
          monthlyDisplay={tweenedMonthly}
          expectedIncome={expectedIncome}
          canContinue={canContinueStep2}
          onContinue={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3
          name={name}
          targetAmount={targetAmount}
          months={months!}
          monthlyTarget={monthlyTarget}
          remindersEnabled={remindersEnabled}
          setRemindersEnabled={setRemindersEnabled}
          aiChallengesEnabled={aiChallengesEnabled}
          setAiChallengesEnabled={setAiChallengesEnabled}
          isPro={isPro}
          existingMission={existingMission}
          creating={creating}
          onCreate={handleCreate}
        />
      )}
    </main>
  );
}

// ─── STEP 1 ──────────────────────────────────────────────────────────────

function Step1(props: {
  name: string;
  setName: (v: string) => void;
  targetAmount: number;
  setTargetAmount: (v: number) => void;
  displayValue: number;
  valueFocused: boolean;
  setValueFocused: (v: boolean) => void;
  onPickPill: (v: number) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const valueInputRef = useRef<HTMLInputElement>(null);
  return (
    <section className="pt-2 pb-10">
      <h2 className="text-[24px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
        Vamos começar.
      </h2>
      <p className="mt-1 text-[14px] font-medium" style={{ color: 'var(--text-2)' }}>
        Dê um nome e diga quanto quer juntar.
      </p>

      <label className="mt-6 block">
        <span
          className="block text-[11px] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: 'var(--text-3)' }}
        >
          Nome da missão
        </span>
        <input
          type="text"
          value={props.name}
          onChange={(e) => props.setName(e.target.value)}
          placeholder="Ex: Reserva de emergência"
          className="mt-2 w-full rounded-2xl px-4 py-3 text-[15px] font-bold outline-none focus:ring-2"
          style={{
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1.5px solid var(--border)',
            borderRadius: 'var(--r)',
          }}
        />
      </label>

      <div
        role="button"
        tabIndex={-1}
        onClick={() => valueInputRef.current?.focus()}
        className="mt-6 flex cursor-text flex-col items-center justify-center rounded-2xl px-4 py-6 transition"
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r)',
          boxShadow: props.valueFocused
            ? '0 0 0 3px var(--accent-soft), 0 8px 24px var(--accent-shadow)'
            : 'var(--card-shadow)',
        }}
      >
        <span
          className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
          style={{ color: 'var(--text-3)' }}
        >
          Quanto você quer guardar
        </span>
        <span
          className="mt-2 text-[40px] font-extrabold leading-none"
          style={{ color: 'var(--accent)' }}
        >
          {formatCurrency(Math.round(props.displayValue))}
        </span>
        {/* Input invisível mas focável: tocar no card chama focus() para abrir
            o teclado numérico no mobile. sr-only mantém acessibilidade. */}
        <input
          ref={valueInputRef}
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          value={props.targetAmount || ''}
          onFocus={() => props.setValueFocused(true)}
          onBlur={() => props.setValueFocused(false)}
          onChange={(e) => {
            const n = Number(e.target.value);
            props.setTargetAmount(Number.isFinite(n) && n > 0 ? n : 0);
          }}
          placeholder="0"
          aria-label="Valor da missão"
          className="sr-only"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {AMOUNT_PILLS.map((p) => {
          const active = props.targetAmount === p;
          return (
            <button
              key={p}
              onClick={() => props.onPickPill(p)}
              className="rounded-full px-4 py-2 text-[13px] font-bold transition active:scale-95"
              style={{
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--text)',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              R$ {p.toLocaleString('pt-BR')}
            </button>
          );
        })}
      </div>

      <button
        disabled={!props.canContinue}
        onClick={props.onContinue}
        className="mt-8 flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          background: 'var(--accent)',
          borderRadius: 'var(--r)',
          boxShadow: props.canContinue ? '0 6px 20px var(--accent-shadow)' : 'none',
        }}
      >
        Continuar
        <ChevronRight size={18} />
      </button>
    </section>
  );
}

// ─── STEP 2 ──────────────────────────────────────────────────────────────

function Step2(props: {
  targetAmount: number;
  months: number | null;
  setMonths: (m: MonthsOption) => void;
  customMode: boolean;
  enterCustomMode: () => void;
  setCustomMonths: (m: number | null) => void;
  monthlyDisplay: number;
  expectedIncome: number | null;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const pct = useMemo(() => {
    if (!props.expectedIncome || !props.months) return null;
    return (props.targetAmount / props.months / props.expectedIncome) * 100;
  }, [props.expectedIncome, props.months, props.targetAmount]);

  const colorCfg = pct == null ? null : pctColor(pct);
  const barWidth = pct == null ? 0 : Math.min(100, pct);

  const feedback = useMemo(() => {
    if (!colorCfg) return null;
    if (colorCfg.tone === 'ok') {
      return { bg: 'var(--green-bg)', color: 'var(--green-text)', icon: '🎉', text: 'Tranquilo! Cabe folgado no seu orçamento.' };
    }
    if (colorCfg.tone === 'warn') {
      return { bg: 'var(--yellow-bg)', color: 'var(--yellow-text)', icon: '⚠️', text: 'Vai exigir disciplina, mas dá pra fazer.' };
    }
    return { bg: 'var(--red-bg)', color: 'var(--red)', icon: '🚨', text: 'Pesado pro seu salário. Considere um prazo maior.' };
  }, [colorCfg]);

  return (
    <section className="pt-2 pb-10">
      <h2 className="text-[24px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
        Em quanto tempo?
      </h2>
      <p className="mt-1 text-[14px] font-medium" style={{ color: 'var(--text-2)' }}>
        Escolha o prazo da missão.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {MONTHS_OPTIONS.map((m) => {
          const active = !props.customMode && props.months === m;
          return (
            <button
              key={m}
              onClick={() => props.setMonths(m)}
              className="flex flex-col items-center rounded-2xl px-4 py-3 transition active:scale-95"
              style={{
                background: active ? 'var(--accent)' : 'var(--surface)',
                color: active ? '#fff' : 'var(--text)',
                border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--r-sm)',
                minWidth: 60,
              }}
            >
              <span className="text-[18px] font-extrabold leading-none">{m}</span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wider opacity-80">
                meses
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {props.customMode ? (
          <CustomMonthsInput
            value={props.months}
            onChange={props.setCustomMonths}
          />
        ) : (
          <button
            type="button"
            onClick={props.enterCustomMode}
            className="text-[13px] font-bold underline-offset-2 hover:underline"
            style={{ color: 'var(--text-3)' }}
          >
            Outro prazo
          </button>
        )}
      </div>

      <div
        className="mt-6 rounded-2xl px-5 py-5 text-white"
        style={{ background: '#4040B0', borderRadius: 'var(--r)' }}
      >
        <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] opacity-80">
          Você precisa guardar
        </span>
        <div className="mt-1 text-[32px] font-extrabold leading-tight">
          {formatCurrency(props.monthlyDisplay || 0)}
          <span className="ml-1 text-[14px] font-bold opacity-70">/mês</span>
        </div>

        {pct != null && props.expectedIncome ? (
          <>
            <p className="mt-2 text-[13px] font-bold opacity-90">
              ≈ {pct.toFixed(1).replace('.', ',')}% do seu salário
            </p>
            <div
              className="mt-3 h-2 w-full overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,0.18)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${barWidth}%`, background: colorCfg!.bar }}
              />
            </div>
          </>
        ) : (
          props.months && (
            <p className="mt-2 text-[12px] font-medium opacity-80">
              Cadastre sua renda esperada para ver o impacto no salário.
            </p>
          )
        )}
      </div>

      {feedback && (
        <div
          className="mt-3 flex items-start gap-2 rounded-2xl px-4 py-3"
          style={{ background: feedback.bg, color: feedback.color, borderRadius: 'var(--r-sm)' }}
        >
          <span className="text-[18px] leading-none">{feedback.icon}</span>
          <span className="text-[13px] font-bold">{feedback.text}</span>
        </div>
      )}

      <button
        disabled={!props.canContinue}
        onClick={props.onContinue}
        className="mt-8 flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        style={{
          background: 'var(--accent)',
          borderRadius: 'var(--r)',
          boxShadow: props.canContinue ? '0 6px 20px var(--accent-shadow)' : 'none',
        }}
      >
        Continuar
        <ChevronRight size={18} />
      </button>
    </section>
  );
}

function CustomMonthsInput(props: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState<string>(props.value != null ? String(props.value) : '');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commit = (text: string) => {
    setRaw(text);
    if (text === '') {
      props.onChange(null);
      return;
    }
    const n = Number(text);
    if (!Number.isFinite(n)) {
      props.onChange(null);
      return;
    }
    // Clamp em [1, 60]: digitar 0 ou 99 não deve passar o valor inválido pra
    // baixo (o tween e o INSERT precisam de número válido).
    const clamped = Math.min(CUSTOM_MONTHS_MAX, Math.max(CUSTOM_MONTHS_MIN, Math.round(n)));
    props.onChange(clamped);
  };

  return (
    <div
      className="flex items-center gap-2 rounded-2xl px-3 py-2"
      style={{
        background: 'var(--surface)',
        border: '1.5px solid var(--accent)',
        borderRadius: 'var(--r-sm)',
        width: 'fit-content',
      }}
    >
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min={CUSTOM_MONTHS_MIN}
        max={CUSTOM_MONTHS_MAX}
        value={raw}
        onChange={(e) => commit(e.target.value)}
        placeholder="12"
        aria-label="Prazo personalizado em meses"
        className="w-14 bg-transparent text-center text-[16px] font-extrabold outline-none"
        style={{ color: 'var(--text)' }}
      />
      <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>
        meses
      </span>
    </div>
  );
}

// ─── STEP 3 ──────────────────────────────────────────────────────────────

function Step3(props: {
  name: string;
  targetAmount: number;
  months: number;
  monthlyTarget: number;
  remindersEnabled: boolean;
  setRemindersEnabled: (v: boolean) => void;
  aiChallengesEnabled: boolean;
  setAiChallengesEnabled: (v: boolean) => void;
  isPro: boolean;
  existingMission: boolean;
  creating: boolean;
  onCreate: () => void;
}) {
  const targetDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + props.months);
    return d;
  }, [props.months]);

  return (
    <section className="pt-2 pb-10">
      <h2 className="text-[24px] font-extrabold leading-tight" style={{ color: 'var(--text)' }}>
        Pronto pra começar?
      </h2>
      <p className="mt-1 text-[14px] font-medium" style={{ color: 'var(--text-2)' }}>
        Revise sua missão antes de confirmar.
      </p>

      <div
        className="mt-6 rounded-2xl p-5"
        style={{ background: 'var(--surface)', boxShadow: 'var(--card-shadow)', borderRadius: 'var(--r)' }}
      >
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: 'var(--text-3)' }}>
          Sua missão
        </p>
        <p className="mt-1 text-[18px] font-extrabold" style={{ color: 'var(--text)' }}>
          {props.name}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Valor alvo
            </p>
            <p className="mt-1 text-[16px] font-extrabold" style={{ color: 'var(--text)' }}>
              {formatCurrency(props.targetAmount)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Prazo
            </p>
            <p className="mt-1 text-[16px] font-extrabold" style={{ color: 'var(--text)' }}>
              {props.months} meses
            </p>
          </div>
        </div>

        <div
          className="mt-4 rounded-xl px-4 py-3"
          style={{ background: 'var(--accent-bg)', borderRadius: 'var(--r-sm)' }}
        >
          <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
            Guardar por mês
          </p>
          <p className="mt-1 text-[22px] font-extrabold" style={{ color: 'var(--accent)' }}>
            {formatCurrency(props.monthlyTarget)}
          </p>
        </div>

        <p className="mt-4 text-[13px] font-bold" style={{ color: 'var(--text-2)' }}>
          Meta atinge em <span style={{ color: 'var(--text)' }}>{monthLabel(targetDate)} · {targetDate.getFullYear()}</span>
        </p>
      </div>

      <Toggle
        label="Lembretes mensais"
        sub="Te avisamos quando for hora de guardar."
        enabled={props.remindersEnabled}
        onChange={props.setRemindersEnabled}
      />

      <Toggle
        label="Desafios com IA"
        sub="Sugestões pra acelerar a meta a partir dos seus gastos."
        enabled={props.aiChallengesEnabled}
        onChange={props.setAiChallengesEnabled}
        disabled={!props.isPro}
        badge="PRO"
      />

      {props.existingMission && (
        <div
          className="mt-5 flex items-start gap-2 rounded-2xl px-4 py-3"
          style={{ background: 'var(--yellow-bg)', color: 'var(--yellow-text)', borderRadius: 'var(--r-sm)' }}
        >
          <AlertTriangle size={18} />
          <div className="text-[13px] font-bold">
            Você já tem uma missão ativa.{' '}
            <Link href="/missao/dashboard" className="underline">
              Abrir missão
            </Link>
          </div>
        </div>
      )}

      <button
        disabled={props.creating || props.existingMission}
        onClick={props.onCreate}
        className="mt-8 flex h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-extrabold text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: 'var(--accent)',
          borderRadius: 'var(--r)',
          boxShadow: '0 6px 20px var(--accent-shadow)',
        }}
      >
        {props.creating ? (
          <Loader2 className="animate-spin" size={18} />
        ) : (
          <>Começar minha missão 🚀</>
        )}
      </button>
    </section>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────

function Toggle(props: {
  label: string;
  sub: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: string;
}) {
  return (
    <div
      className="mt-4 flex items-center justify-between gap-3 rounded-2xl p-4"
      style={{
        background: 'var(--surface)',
        boxShadow: 'var(--card-shadow)',
        borderRadius: 'var(--r)',
        opacity: props.disabled ? 0.55 : 1,
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-bold" style={{ color: 'var(--text)' }}>
            {props.label}
          </span>
          {props.badge && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white"
              style={{ background: '#7C3AED' }}
            >
              {props.badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>
          {props.sub}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.enabled}
        disabled={props.disabled}
        onClick={() => !props.disabled && props.onChange(!props.enabled)}
        className="relative h-7 w-12 shrink-0 rounded-full transition disabled:cursor-not-allowed"
        style={{
          background: props.enabled && !props.disabled ? 'var(--accent)' : 'var(--border)',
        }}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all"
          style={{ left: props.enabled ? 22 : 2 }}
        />
      </button>
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────

export default function NovaMissaoPage() {
  return (
    <Suspense
      fallback={
        <main
          className="max-w-lg md:max-w-[1100px] mx-auto px-4 md:px-8 flex min-h-screen w-full items-center justify-center"
          style={{ background: 'var(--bg)' }}
        >
          <Loader2 className="animate-spin" color="var(--accent)" />
        </main>
      }
    >
      <NovaMissaoWizard />
    </Suspense>
  );
}
