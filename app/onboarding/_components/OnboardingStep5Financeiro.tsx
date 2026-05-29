'use client';

import { Info } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';
import type { MonthlyObligation, RecurringExpense } from '@/lib/types';
import { BigCurrencyInput, InlineCurrencyInput } from './CurrencyInput';
import { OnboardingNav } from './OnboardingNav';
import { OnboardingProgress } from './OnboardingProgress';

type OnboardingStep5FinanceiroProps = {
  totalSteps: number;
  subStep: 'A' | 'B';
  // A: saldo + reserva
  balance: string;
  setBalance: (v: string) => void;
  emergency: string;
  setEmergency: (v: string) => void;
  balanceNum: number;
  // B: salário + contas pagas
  loadingB: boolean;
  salaryRec: RecurringExpense | null;
  salaryDropped: boolean;
  setSalaryDropped: (v: boolean) => void;
  obligations: MonthlyObligation[];
  paidObligationIds: Set<string>;
  togglePaidObligation: (id: string) => void;
  // navigation
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
};

export function OnboardingStep5Financeiro({
  totalSteps,
  subStep,
  balance,
  setBalance,
  emergency,
  setEmergency,
  balanceNum,
  loadingB,
  salaryRec,
  salaryDropped,
  setSalaryDropped,
  obligations,
  paidObligationIds,
  togglePaidObligation,
  onBack,
  onContinue,
  onSkip,
}: OnboardingStep5FinanceiroProps) {
  if (subStep === 'A') {
    return (
      <div className="flex flex-col gap-0">
        <OnboardingProgress
          filled={5}
          totalSteps={totalSteps}
          label={`Passo 5 de ${totalSteps} · Situação financeira`}
          subActive={0}
        />
        <h2 className="text-xl font-bold text-gray-900 text-center">
          Quanto você tem agora?
        </h2>
        <p className="text-sm text-gray-400 text-center mt-1 mb-6">
          Isso define seu ponto de partida real no app.
        </p>

        <p className="text-xs font-semibold text-gray-500 text-center mb-1">
          Saldo atual em conta
        </p>
        <BigCurrencyInput value={balance} onChange={setBalance} />

        <div className="mt-3 flex items-start gap-1.5 text-sm" style={{ color: '#6b7280' }}>
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <span className="leading-snug">
            Informe o valor que você tem na conta agora, já considerando tudo que recebeu e pagou este mês.
          </span>
        </div>

        <div className="h-6" />
        <p className="text-xs font-semibold text-gray-500 mb-1">
          Reserva de emergência{' '}
          <span className="font-normal text-gray-400">(opcional)</span>
        </p>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          <span className="text-sm text-gray-400 font-medium flex-shrink-0">R$</span>
          <InlineCurrencyInput
            value={emergency}
            onChange={setEmergency}
            aria-label="Reserva de emergência"
            className="min-w-0 flex-1 text-sm bg-transparent outline-none text-gray-900 placeholder:text-gray-300"
            style={{ caretColor: 'var(--accent)' }}
          />
        </div>

        <div className="h-7" />
        <OnboardingNav
          onBack={onBack}
          onPrimary={onContinue}
          primaryLabel="Próximo"
          primaryDisabled={balanceNum <= 0}
          onSkip={onSkip}
          skipLabel="Pular por agora"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <OnboardingProgress
        filled={5}
        totalSteps={totalSteps}
        label={`Passo 5 de ${totalSteps} · Situação financeira`}
        subActive={1}
      />
      <h2 className="text-xl font-bold text-gray-900 text-center">
        O que já aconteceu esse mês?
      </h2>
      <p className="text-sm text-gray-400 text-center mt-1 mb-5">
        Vamos deixar o app igual à sua vida real agora.
      </p>

      {loadingB ? (
        <p className="text-sm text-gray-400 text-center py-8">Carregando…</p>
      ) : (
        <div className="space-y-4">
          {(salaryRec || obligations.length > 0) && (
            <div className="flex items-start gap-1.5 text-sm" style={{ color: '#6b7280' }}>
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <span className="leading-snug">
                Marque apenas o que ainda não está refletido no saldo informado acima.
              </span>
            </div>
          )}
          {salaryRec && (
            <div className="rounded-xl border border-gray-100 p-3" style={{ background: '#f9fafb' }}>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Seu salário deste mês já caiu?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSalaryDropped(false)}
                  className="py-2 rounded-lg border text-sm font-semibold transition-colors"
                  style={
                    !salaryDropped
                      ? {
                          background: 'var(--accent-bg)',
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                        }
                      : {
                          background: '#fff',
                          borderColor: '#f3f4f6',
                          color: '#6b7280',
                        }
                  }
                >
                  Ainda não
                </button>
                <button
                  onClick={() => setSalaryDropped(true)}
                  className="py-2 rounded-lg border text-sm font-semibold transition-colors"
                  style={
                    salaryDropped
                      ? {
                          background: 'var(--accent-bg)',
                          borderColor: 'var(--accent)',
                          color: 'var(--accent)',
                        }
                      : {
                          background: '#fff',
                          borderColor: '#f3f4f6',
                          color: '#6b7280',
                        }
                  }
                >
                  Sim, já caiu
                </button>
              </div>
              {salaryDropped && (
                <p className="text-xs mt-2" style={{ color: 'var(--accent)' }}>
                  Vamos marcar {formatCurrency(salaryRec.amount)} como recebido.
                </p>
              )}
            </div>
          )}

          {obligations.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Quais contas você já pagou?
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto -mx-1 px-1">
                {obligations.map((ob) => {
                  const checked = paidObligationIds.has(ob.id);
                  return (
                    <button
                      key={ob.id}
                      onClick={() => togglePaidObligation(ob.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors"
                      style={
                        checked
                          ? {
                              background: 'var(--accent-bg)',
                              borderColor: 'var(--accent)',
                            }
                          : {
                              background: '#f9fafb',
                              borderColor: '#f3f4f6',
                            }
                      }
                    >
                      <div
                        className="w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                        style={
                          checked
                            ? { background: 'var(--accent)', borderColor: 'var(--accent)' }
                            : { background: '#fff', borderColor: '#d1d5db' }
                        }
                      >
                        {checked ? '✓' : ''}
                      </div>
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-800">
                        {ob.description}
                      </span>
                      <span className="text-sm font-semibold text-gray-600 flex-shrink-0">
                        {formatCurrency(ob.amount)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            !salaryRec && (
              <p className="text-sm text-gray-400 text-center py-6">
                Você ainda não cadastrou contas fixas. Pode seguir em frente.
              </p>
            )
          )}
        </div>
      )}

      <div className="h-7" />
      <OnboardingNav
        onBack={onBack}
        onPrimary={onContinue}
        primaryLabel="Próximo"
        primaryDisabled={loadingB}
        onSkip={onSkip}
        skipLabel="Pular por agora"
      />
    </div>
  );
}
