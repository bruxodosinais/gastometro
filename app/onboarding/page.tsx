'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  addRecurringExpense,
  addObligationForNewRecurring,
  upsertMonthlyPlan,
} from '@/lib/storage';
import { formatCurrency } from '@/lib/calculations';
import type { ExpenseCategory } from '@/lib/types';

// ─── Dados dos chips de contas fixas ─────────────────────────────────────────

type ChipDef = {
  id: string;
  label: string;
  icon: string;
  category: ExpenseCategory;
};

const CHIPS: ChipDef[] = [
  { id: 'aluguel',   label: 'Aluguel',         icon: '🏠', category: 'Moradia' },
  { id: 'internet',  label: 'Internet',         icon: '📡', category: 'Internet' },
  { id: 'energia',   label: 'Energia',          icon: '💡', category: 'Moradia' },
  { id: 'agua',      label: 'Água',             icon: '💧', category: 'Moradia' },
  { id: 'academia',  label: 'Academia',         icon: '🏋️', category: 'Saúde' },
  { id: 'streaming', label: 'Streaming',        icon: '📺', category: 'Assinaturas' },
  { id: 'escola',    label: 'Escola/Faculdade', icon: '🎓', category: 'Educação' },
  { id: 'saude',     label: 'Plano de saúde',   icon: '🏥', category: 'Saúde' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAmount(str: string): number {
  if (!str) return 0;
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

function numToStr(n: number): string {
  if (!n) return '';
  return n.toFixed(0);
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function ProgressDots({ filled }: { filled: number }) {
  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
            i < filled ? 'bg-mint' : 'border-2 border-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function BigCurrencyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <span className="text-3xl font-semibold text-mint-500">R$</span>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ''))}
          onFocus={(e) => { if (e.target.value === '0') onChange(''); }}
          placeholder="0"
          className="text-6xl font-bold bg-transparent border-none outline-none text-center w-48 pb-2 text-gray-900 placeholder:text-gray-300"
          style={{ caretColor: '#00b87a' }}
        />
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-100" />
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-mint" />
      </div>
    </div>
  );
}

function SkipLink({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      onClick={onSkip}
      className="mt-4 text-gray-400 text-sm text-center w-full"
    >
      Pular
    </button>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-3.5 bg-mint hover:bg-mint-700 disabled:opacity-50 rounded-xl font-semibold text-gray-900 transition-colors"
    >
      {loading ? 'Salvando...' : children}
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dados do usuário
  const [userName, setUserName] = useState('');

  // Passo 1 — renda
  const [income, setIncome] = useState('');
  const [incomeDay, setIncomeDay] = useState('');

  // Passo 2 — contas fixas
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());
  const [chipValues, setChipValues] = useState<Record<string, string>>({});
  const [chipDueDays, setChipDueDays] = useState<Record<string, string>>({});
  const [customName, setCustomName] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [customDueDay, setCustomDueDay] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Passo 3 — meta de poupança
  const [savings, setSavings] = useState('');

  // Resumo para passo 4
  const [savedIncome, setSavedIncome] = useState(0);
  const [savedRecurringCount, setSavedRecurringCount] = useState(0);
  const [savedSavings, setSavedSavings] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta = u.user_metadata as Record<string, string> | undefined;
      const raw =
        meta?.display_name ||
        meta?.full_name?.split(' ')[0] ||
        meta?.name?.split(' ')[0] ||
        u.email?.split('@')[0] ||
        '';
      setUserName(raw.charAt(0).toUpperCase() + raw.slice(1));
    });
  }, []);

  function goTo(next: 0 | 1 | 2 | 3 | 4) {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
    }, 180);
  }

  async function completeOnboarding() {
    // Cria o plano mensal consolidando os valores dos passos 1 e 3
    if (savedIncome > 0 || savedSavings > 0) {
      try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        await upsertMonthlyPlan(currentMonth, savedIncome, savedSavings);
      } catch (e) {
        console.error('Onboarding: erro ao salvar plano mensal:', e);
      }
    }
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { onboarding_completed: true } });
    router.push('/');
    router.refresh();
  }

  // Tela 0 — pular tudo
  async function handleSkipAll() {
    await completeOnboarding();
  }

  // Tela 1 — renda
  async function handleStep1Continue() {
    const amount = parseAmount(income);
    if (amount > 0) {
      const parsedDay = parseInt(incomeDay, 10);
      const day = parsedDay >= 1 && parsedDay <= 31 ? parsedDay : 1;
      try {
        await addRecurringExpense({
          description: 'Salário',
          amount,
          category: 'Salário',
          type: 'income',
          dayOfMonth: day,
          active: true,
        });
        setSavedIncome(amount);
      } catch (e) {
        console.error('Onboarding: erro ao salvar renda:', e);
      }
    }
    goTo(2);
  }

  // Tela 2 — contas fixas
  function toggleChip(id: string) {
    setSelectedChips((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setChipValues((v) => { const c = { ...v }; delete c[id]; return c; });
        setChipDueDays((v) => { const c = { ...v }; delete c[id]; return c; });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleStep2Continue() {
    setSaving(true);
    let count = 0;
    for (const chip of CHIPS) {
      if (!selectedChips.has(chip.id)) continue;
      const amount = parseAmount(chipValues[chip.id] || '');
      const day = parseInt(chipDueDays[chip.id] || '', 10);
      if (amount <= 0 || !day || day < 1 || day > 31) continue;
      try {
        const rec = await addRecurringExpense({
          description: chip.label,
          amount,
          category: chip.category,
          type: 'expense',
          dayOfMonth: day,
          dueDay: day,
          active: true,
        });
        await addObligationForNewRecurring(rec);
        count++;
      } catch (e) {
        console.error(`Onboarding: erro ao salvar ${chip.label}:`, e);
      }
    }
    if (showCustomForm && customName && parseAmount(customValue) > 0) {
      const customDay = parseInt(customDueDay, 10);
      if (customDay >= 1 && customDay <= 31) {
        try {
          const rec = await addRecurringExpense({
            description: customName,
            amount: parseAmount(customValue),
            category: 'Outros',
            type: 'expense',
            dayOfMonth: customDay,
            dueDay: customDay,
            active: true,
          });
          await addObligationForNewRecurring(rec);
          count++;
        } catch (e) {
          console.error('Onboarding: erro ao salvar item personalizado:', e);
        }
      }
    }
    setSavedRecurringCount(count);
    setSaving(false);
    goTo(3);
  }

  // Tela 3 — meta de poupança
  function handleStep3Continue() {
    const amount = parseAmount(savings);
    if (amount > 0) {
      setSavedSavings(amount);
    }
    goTo(4);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const incomeNum = parseAmount(income);
  const savingsMax = savedIncome > 0 ? savedIncome * 0.5 : 5000;
  const savingsNum = parseAmount(savings);

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-8 relative">
      {/* Botão voltar — telas 1, 2, 3 */}
      {(step === 1 || step === 2 || step === 3) && (
        <button
          onClick={() => goTo((step - 1) as 0 | 1 | 2 | 3 | 4)}
          className="absolute top-4 left-4 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft size={22} />
        </button>
      )}
      <div
        className="w-full max-w-sm flex flex-col"
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      >
        {/* ── Tela 0 — Boas-vindas ─────────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center gap-0">
            <div className="text-5xl mb-6">📊</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Olá, {userName || '…'}! 👋
            </h1>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              Vamos configurar seu Gastômetro em 3 passos rápidos.
            </p>
            <ProgressDots filled={0} />
            <div className="h-10" />
            <PrimaryButton onClick={() => goTo(1)}>Começar</PrimaryButton>
            <button
              onClick={handleSkipAll}
              className="mt-5 text-gray-400 text-sm text-center"
            >
              Pular tudo e explorar sozinho
            </button>
          </div>
        )}

        {/* ── Tela 1 — Renda mensal ────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-0">
            <ProgressDots filled={1} />
            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
              Passo 1 de 3
            </p>
            <div className="h-3" />
            <h2 className="text-xl font-bold text-gray-900 text-center">
              Qual é sua renda mensal?
            </h2>
            <p className="text-sm text-gray-400 text-center mt-1 mb-8">
              Pode ser salário, aposentadoria ou qualquer entrada fixa mensal.
            </p>
            <BigCurrencyInput value={income} onChange={setIncome} />
            <div className="h-4" />
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-gray-400">Recebo todo dia</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={incomeDay}
                onChange={(e) => setIncomeDay(e.target.value)}
                placeholder="1"
                className="w-16 text-center bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-mint transition-colors"
              />
              <span className="text-sm text-gray-400">do mês</span>
            </div>
            <div className="h-6" />
            <PrimaryButton
              onClick={handleStep1Continue}
              disabled={incomeNum <= 0}
            >
              Continuar
            </PrimaryButton>
            <SkipLink onSkip={() => goTo(2)} />
          </div>
        )}

        {/* ── Tela 2 — Contas fixas ────────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-0">
            <ProgressDots filled={2} />
            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
              Passo 2 de 3
            </p>
            <div className="h-3" />
            <h2 className="text-xl font-bold text-gray-900 text-center">
              Você tem contas fixas todo mês?
            </h2>
            <p className="text-sm text-gray-400 text-center mt-1 mb-5">
              Selecione as que se aplicam e informe o valor.
            </p>

            {/* Grid de chips */}
            <div className="overflow-y-auto max-h-64 -mx-1 px-1">
              <div className="grid grid-cols-2 gap-2">
                {CHIPS.map((chip) => {
                  const selected = selectedChips.has(chip.id);
                  return (
                    <div key={chip.id}>
                      <button
                        onClick={() => toggleChip(chip.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                          selected
                            ? 'bg-mint-50 border-mint text-mint-700'
                            : 'bg-gray-50 border-gray-100 text-gray-700'
                        }`}
                      >
                        <span>{chip.icon}</span>
                        <span className="truncate">{chip.label}</span>
                      </button>
                      {selected && (
                        <div className="mt-1 flex gap-1">
                          {/* Valor */}
                          <div className="flex items-center gap-1 flex-1 min-w-0 px-2 py-1.5 bg-mint-50 rounded-xl border border-mint/20">
                            <span className="text-xs text-mint-700 font-medium flex-shrink-0">R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={chipValues[chip.id] || ''}
                              onChange={(e) =>
                                setChipValues((prev) => ({
                                  ...prev,
                                  [chip.id]: e.target.value.replace(/[^0-9.,]/g, ''),
                                }))
                              }
                              placeholder="0,00"
                              className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                            />
                          </div>
                          {/* Vence dia */}
                          <div className="flex items-center gap-1 px-2 py-1.5 bg-mint-50 rounded-xl border border-mint/20 w-[88px] flex-shrink-0">
                            <span className="text-[10px] text-mint-700 font-medium leading-tight flex-shrink-0">Vence<br/>dia</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={31}
                              value={chipDueDays[chip.id] || ''}
                              onChange={(e) =>
                                setChipDueDays((prev) => ({
                                  ...prev,
                                  [chip.id]: e.target.value,
                                }))
                              }
                              placeholder="ex: 10"
                              className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Item personalizado */}
              {showCustomForm ? (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Nome da conta"
                    className="w-full bg-white border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-mint transition-colors"
                  />
                  <div className="flex gap-1">
                    <div className="flex items-center gap-1 flex-1 min-w-0 bg-white border border-gray-100 rounded-xl px-3 py-2">
                      <span className="text-xs text-gray-400 font-medium flex-shrink-0">R$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customValue}
                        onChange={(e) =>
                          setCustomValue(e.target.value.replace(/[^0-9.,]/g, ''))
                        }
                        placeholder="0,00"
                        className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl px-2 py-2 w-[88px] flex-shrink-0">
                      <span className="text-[10px] text-gray-400 font-medium leading-tight flex-shrink-0">Vence<br/>dia</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={31}
                        value={customDueDay}
                        onChange={(e) => setCustomDueDay(e.target.value)}
                        placeholder="ex: 10"
                        className="min-w-0 flex-1 text-sm bg-transparent outline-none text-center text-gray-900 placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCustomForm(true)}
                  className="mt-3 w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-mint-500 hover:text-mint-500 transition-colors"
                >
                  + Adicionar outra
                </button>
              )}
            </div>

            <div className="h-5" />
            <PrimaryButton onClick={handleStep2Continue} loading={saving}>
              Continuar
            </PrimaryButton>
            <SkipLink onSkip={() => goTo(3)} />
          </div>
        )}

        {/* ── Tela 3 — Meta de poupança ────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col gap-0">
            <ProgressDots filled={3} />
            <div className="h-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center">
              Passo 3 de 3
            </p>
            <div className="h-3" />
            <h2 className="text-xl font-bold text-gray-900 text-center">
              Quanto quer guardar por mês?
            </h2>
            <p className="text-sm text-gray-400 text-center mt-1 mb-4">
              Sua meta de poupança mensal.
            </p>

            {savedIncome > 0 && (
              <div className="bg-mint-50 border border-mint/20 rounded-xl px-4 py-3 mb-4">
                <p className="text-xs text-mint-700 text-center leading-relaxed">
                  Com{' '}
                  <span className="font-semibold">{formatCurrency(savedIncome)}</span>,
                  guardar{' '}
                  <span className="font-semibold">
                    {formatCurrency(savedIncome * 0.2)}
                  </span>{' '}
                  representa 20% — uma boa referência.
                </p>
              </div>
            )}

            <BigCurrencyInput value={savings} onChange={setSavings} />

            {/* Slider */}
            <div className="mt-4 px-1">
              <input
                type="range"
                min={0}
                max={savingsMax}
                step={savingsMax > 1000 ? 50 : 10}
                value={savingsNum}
                onChange={(e) => setSavings(numToStr(Number(e.target.value)))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #00b87a ${
                    (savingsNum / savingsMax) * 100
                  }%, #e5e7eb ${(savingsNum / savingsMax) * 100}%)`,
                  accentColor: '#00b87a',
                }}
              />
              <div className="flex justify-between mt-1 text-xs text-gray-400">
                <span>R$ 0</span>
                <span>{formatCurrency(savingsMax)}</span>
              </div>
            </div>

            <div className="h-8" />
            <PrimaryButton onClick={handleStep3Continue} loading={saving}>
              Concluir configuração
            </PrimaryButton>
            <SkipLink onSkip={() => goTo(4)} />
          </div>
        )}

        {/* ── Tela 4 — Tudo pronto ─────────────────────────────────────── */}
        {step === 4 && (
          <div className="flex flex-col items-center text-center gap-0">
            {/* Ícone animado */}
            <div
              className="w-20 h-20 rounded-full bg-mint-50 border-2 border-mint flex items-center justify-center text-4xl mb-6"
              style={{ animation: 'fade-in-scale 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
            >
              ✓
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Tudo configurado!
            </h2>

            {/* Resumo dinâmico — só mostra o que foi salvo */}
            {(savedIncome > 0 || savedRecurringCount > 0 || savedSavings > 0) && (
              <div className="w-full bg-gray-50 rounded-xl px-4 py-4 mb-8 space-y-2.5 text-left">
                {savedIncome > 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="text-mint font-bold">✓</span>
                    <span>
                      Renda de{' '}
                      <span className="font-semibold">{formatCurrency(savedIncome)}</span>{' '}
                      cadastrada
                    </span>
                  </div>
                )}
                {savedRecurringCount > 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="text-mint font-bold">✓</span>
                    <span>
                      <span className="font-semibold">{savedRecurringCount}</span>{' '}
                      conta{savedRecurringCount > 1 ? 's' : ''} fixa
                      {savedRecurringCount > 1 ? 's' : ''} cadastrada
                      {savedRecurringCount > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {savedSavings > 0 && (
                  <div className="flex items-center gap-2.5 text-sm text-gray-700">
                    <span className="text-mint font-bold">✓</span>
                    <span>
                      Meta de{' '}
                      <span className="font-semibold">{formatCurrency(savedSavings)}</span>{' '}
                      por mês definida
                    </span>
                  </div>
                )}
              </div>
            )}

            {savedIncome === 0 && savedRecurringCount === 0 && savedSavings === 0 && (
              <p className="text-gray-400 text-sm mb-8">
                Você pode configurar tudo isso a qualquer momento nas configurações.
              </p>
            )}

            <PrimaryButton onClick={completeOnboarding}>
              Ver meu Gastômetro →
            </PrimaryButton>
          </div>
        )}
      </div>
    </main>
  );
}
